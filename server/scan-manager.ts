import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { EventEmitter } from 'events';
import {
  FileCategory,
  FileItem,
  CategorySummary,
  BloatItem,
  TreemapNode,
  StorageXRayReport,
} from './types.js';
import { formatBytes, getFileCategory, CATEGORY_COLORS } from './scanner.js';
import { StorageCache } from './cache.js';
import { ScanHistoryEngine } from './scan-history.js';

export type ScanMode = 'quick' | 'standard' | 'deep';
export type ScanStatus = 'idle' | 'running' | 'paused' | 'completed' | 'cancelled' | 'error';

export interface ScanProgress {
  scanId: string;
  status: ScanStatus;
  mode: ScanMode;
  currentPath: string;
  scannedFiles: number;
  scannedFolders: number;
  totalBytes: number;
  formattedTotalBytes: string;
  speedFilesPerSec: number;
  elapsedMs: number;
  report?: StorageXRayReport;
}

export class ScanSession extends EventEmitter {
  public scanId: string;
  public rootPath: string;
  public mode: ScanMode;
  public status: ScanStatus = 'idle';

  private isPaused = false;
  private isCancelled = false;
  private pausePromiseResolve: (() => void) | null = null;

  public scannedFiles = 0;
  public scannedFolders = 0;
  public totalBytes = 0;
  public currentScanningPath = '';
  public startTime = 0;
  public lastProgressEmit = 0;

  constructor(scanId: string, rootPath: string, mode: ScanMode = 'standard') {
    super();
    this.scanId = scanId;
    this.rootPath = path.resolve(rootPath);
    this.mode = mode;
  }

  public pause(): void {
    if (this.status === 'running') {
      this.isPaused = true;
      this.status = 'paused';
      this.emitProgress();
    }
  }

  public resume(): void {
    if (this.status === 'paused') {
      this.isPaused = false;
      this.status = 'running';
      if (this.pausePromiseResolve) {
        this.pausePromiseResolve();
        this.pausePromiseResolve = null;
      }
      this.emitProgress();
    }
  }

  public cancel(): void {
    this.isCancelled = true;
    this.status = 'cancelled';
    if (this.pausePromiseResolve) {
      this.pausePromiseResolve();
      this.pausePromiseResolve = null;
    }
    this.emitProgress();
  }

  private async checkPauseOrCancel(): Promise<boolean> {
    if (this.isCancelled) return true;
    if (this.isPaused) {
      await new Promise<void>((resolve) => {
        this.pausePromiseResolve = resolve;
      });
    }
    return this.isCancelled;
  }

  public async run(): Promise<StorageXRayReport | null> {
    this.status = 'running';
    this.startTime = Date.now();
    this.lastProgressEmit = Date.now();
    this.emitProgress();

    const maxDepth = this.mode === 'quick' ? 1 : this.mode === 'standard' ? 4 : 10;
    const report = await this.executeTraversal(maxDepth);

    if (this.isCancelled) {
      this.status = 'cancelled';
      this.emitProgress();
      return null;
    }

    this.status = 'completed';
    this.emitProgress(report);
    return report;
  }

  private emitProgress(finalReport?: StorageXRayReport): void {
    const elapsedMs = Math.max(1, Date.now() - this.startTime);
    const speedFilesPerSec = Math.round((this.scannedFiles / elapsedMs) * 1000);

    const progress: ScanProgress = {
      scanId: this.scanId,
      status: this.status,
      mode: this.mode,
      currentPath: this.currentScanningPath || this.rootPath,
      scannedFiles: this.scannedFiles,
      scannedFolders: this.scannedFolders,
      totalBytes: this.totalBytes,
      formattedTotalBytes: formatBytes(this.totalBytes),
      speedFilesPerSec,
      elapsedMs,
      report: finalReport,
    };

    this.emit('progress', progress);
  }

  private async executeTraversal(maxDepth: number): Promise<StorageXRayReport> {
    const DEV_BLOAT_NAMES = new Set([
      'node_modules', '.venv', 'venv', '__pycache__', '.next', '.nuxt',
      'target', 'dist', 'build', '.gradle', '.cargo', '.turbo', 'vendor',
      '.cache', 'temp', 'tmp',
    ]);

    const categoryMap: Record<FileCategory, { totalBytes: number; fileCount: number }> = {
      media: { totalBytes: 0, fileCount: 0 },
      code: { totalBytes: 0, fileCount: 0 },
      archive: { totalBytes: 0, fileCount: 0 },
      document: { totalBytes: 0, fileCount: 0 },
      executable: { totalBytes: 0, fileCount: 0 },
      system: { totalBytes: 0, fileCount: 0 },
      other: { totalBytes: 0, fileCount: 0 },
    };

    const allLargeFiles: FileItem[] = [];
    const bloatItems: BloatItem[] = [];

    const walk = async (currentPath: string, depth: number): Promise<TreemapNode> => {
      this.currentScanningPath = currentPath;

      if (await this.checkPauseOrCancel()) {
        return {
          id: currentPath,
          name: path.basename(currentPath) || currentPath,
          path: currentPath,
          size: 0,
          formattedSize: '0 B',
          category: 'other',
          color: CATEGORY_COLORS.other,
          isDirectory: true,
          children: [],
        };
      }

      // Throttle SSE progress events to at most once every 120ms
      if (Date.now() - this.lastProgressEmit > 120) {
        this.emitProgress();
        this.lastProgressEmit = Date.now();
      }

      const name = path.basename(currentPath) || currentPath;
      let nodeTotalBytes = 0;
      let nodeItemCount = 0;
      const childNodes: TreemapNode[] = [];

      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          if (await this.checkPauseOrCancel()) break;

          const itemPath = path.join(currentPath, entry.name);
          const isDir = entry.isDirectory();
          const category = getFileCategory(entry.name, isDir);
          const isBloatDir = isDir && DEV_BLOAT_NAMES.has(entry.name.toLowerCase());

          try {
            if (isDir) {
              this.scannedFolders++;

              if (isBloatDir) {
                // Measure bloat directory
                const bloatStats = await this.shallowMeasureFolder(itemPath);
                const stat = await fs.stat(itemPath).catch(() => null);
                const lastMod = stat ? stat.mtime : new Date();
                const daysOld = Math.floor((Date.now() - lastMod.getTime()) / (1000 * 60 * 60 * 24));

                bloatItems.push({
                  id: itemPath,
                  name: entry.name,
                  path: itemPath,
                  type: entry.name,
                  size: bloatStats.totalBytes,
                  formattedSize: formatBytes(bloatStats.totalBytes),
                  fileCount: bloatStats.fileCount,
                  lastModified: lastMod.toISOString(),
                  daysOld,
                  selected: true,
                });

                categoryMap.code.totalBytes += bloatStats.totalBytes;
                categoryMap.code.fileCount += bloatStats.fileCount;
                this.scannedFiles += bloatStats.fileCount;
                this.totalBytes += bloatStats.totalBytes;
                nodeTotalBytes += bloatStats.totalBytes;
                nodeItemCount += bloatStats.fileCount;

                childNodes.push({
                  id: itemPath,
                  name: entry.name,
                  path: itemPath,
                  size: bloatStats.totalBytes,
                  formattedSize: formatBytes(bloatStats.totalBytes),
                  category: 'code',
                  color: CATEGORY_COLORS.code,
                  isDirectory: true,
                  itemCount: bloatStats.fileCount,
                  children: [],
                });
              } else if (depth < maxDepth) {
                const subNode = await walk(itemPath, depth + 1);
                nodeTotalBytes += subNode.size;
                nodeItemCount += (subNode.itemCount || 0) + 1;
                childNodes.push(subNode);
              } else {
                // Depth limit reached: shallow measurement
                const shallow = await this.shallowMeasureFolder(itemPath);
                nodeTotalBytes += shallow.totalBytes;
                nodeItemCount += shallow.fileCount;
                this.totalBytes += shallow.totalBytes;
                this.scannedFiles += shallow.fileCount;

                categoryMap[category].totalBytes += shallow.totalBytes;
                categoryMap[category].fileCount += shallow.fileCount;

                childNodes.push({
                  id: itemPath,
                  name: entry.name,
                  path: itemPath,
                  size: shallow.totalBytes,
                  formattedSize: formatBytes(shallow.totalBytes),
                  category,
                  color: CATEGORY_COLORS[category],
                  isDirectory: true,
                  itemCount: shallow.fileCount,
                  children: [],
                });
              }
            } else if (entry.isFile()) {
              const stat = await fs.stat(itemPath);
              const size = stat.size;
              this.scannedFiles++;
              this.totalBytes += size;
              nodeTotalBytes += size;
              nodeItemCount++;

              categoryMap[category].totalBytes += size;
              categoryMap[category].fileCount++;

              if (size > 10 * 1024 * 1024) {
                allLargeFiles.push({
                  id: itemPath,
                  name: entry.name,
                  path: itemPath,
                  isDirectory: false,
                  isFile: true,
                  size,
                  formattedSize: formatBytes(size),
                  extension: path.extname(entry.name).toLowerCase(),
                  category,
                  createdAt: stat.birthtime.toISOString(),
                  modifiedAt: stat.mtime.toISOString(),
                  relativeTime: `${Math.floor((Date.now() - stat.mtime.getTime()) / (1000 * 60 * 60 * 24))}d ago`,
                });
              }

              if (size > 5 * 1024 * 1024 || depth <= 2) {
                childNodes.push({
                  id: itemPath,
                  name: entry.name,
                  path: itemPath,
                  size,
                  formattedSize: formatBytes(size),
                  category,
                  color: CATEGORY_COLORS[category],
                  isDirectory: false,
                });
              }
            }
          } catch {
            // Skip restricted files/folders
          }
        }
      } catch {
        // Skip inaccessible folders
      }

      childNodes.sort((a, b) => b.size - a.size);

      // Cache folder size
      StorageCache.set(currentPath, {
        size: nodeTotalBytes,
        formattedSize: formatBytes(nodeTotalBytes),
        fileCount: nodeItemCount,
        folderCount: childNodes.filter((c) => c.isDirectory).length,
      });

      return {
        id: currentPath,
        name,
        path: currentPath,
        size: nodeTotalBytes,
        formattedSize: formatBytes(nodeTotalBytes),
        category: getFileCategory(name, true),
        color: CATEGORY_COLORS.other,
        isDirectory: true,
        itemCount: nodeItemCount,
        children: childNodes,
      };
    };

    const treemapRoot = await walk(this.rootPath, 0);

    const categoryLabels: Record<FileCategory, string> = {
      media: 'Images & Videos',
      code: 'Development & Build',
      archive: 'Compressed Archives',
      document: 'Documents & Data',
      executable: 'Applications',
      system: 'System & Reserved',
      other: 'Other Files',
    };

    const categories: CategorySummary[] = (Object.keys(categoryMap) as FileCategory[])
      .map((cat) => {
        const data = categoryMap[cat];
        const percentage = this.totalBytes > 0 ? (data.totalBytes / this.totalBytes) * 100 : 0;
        return {
          category: cat,
          label: categoryLabels[cat],
          color: CATEGORY_COLORS[cat],
          totalBytes: data.totalBytes,
          fileCount: data.fileCount,
          percentage: Math.round(percentage * 10) / 10,
        };
      })
      .filter((c) => c.totalBytes > 0)
      .sort((a, b) => b.totalBytes - a.totalBytes);

    allLargeFiles.sort((a, b) => (b.size || 0) - (a.size || 0));
    const largestFiles = allLargeFiles.slice(0, 50);

    bloatItems.sort((a, b) => b.size - a.size);
    const potentialReclaimBytes = bloatItems.reduce((acc, curr) => acc + curr.size, 0);

    const finalReport: StorageXRayReport = {
      rootPath: this.rootPath,
      totalBytes: this.totalBytes,
      formattedTotalSize: formatBytes(this.totalBytes),
      totalFiles: this.scannedFiles,
      totalFolders: this.scannedFolders,
      durationMs: Date.now() - this.startTime,
      categories,
      treemapRoot,
      largestFiles,
      bloatItems,
      potentialReclaimBytes,
      formattedPotentialReclaim: formatBytes(potentialReclaimBytes),
    };

    // Automatically persist scan into historical growth tracker
    ScanHistoryEngine.recordScan(finalReport, this.mode).catch(() => {});

    return finalReport;
  }

  private async shallowMeasureFolder(
    folderPath: string
  ): Promise<{ totalBytes: number; fileCount: number }> {
    let totalBytes = 0;
    let fileCount = 0;
    const queue = [folderPath];

    while (queue.length > 0) {
      if (await this.checkPauseOrCancel()) break;
      const curr = queue.shift()!;
      try {
        const entries = await fs.readdir(curr, { withFileTypes: true });
        for (const entry of entries) {
          const itemPath = path.join(curr, entry.name);
          try {
            if (entry.isDirectory()) {
              queue.push(itemPath);
            } else if (entry.isFile()) {
              const stat = await fs.stat(itemPath);
              totalBytes += stat.size;
              fileCount++;
            }
          } catch {}
        }
      } catch {}
    }

    return { totalBytes, fileCount };
  }
}

export class ScanManager {
  private static activeSessions = new Map<string, ScanSession>();

  static createSession(scanId: string, rootPath: string, mode: ScanMode): ScanSession {
    const existing = this.activeSessions.get(scanId);
    if (existing) {
      existing.cancel();
    }
    const session = new ScanSession(scanId, rootPath, mode);
    this.activeSessions.set(scanId, session);
    return session;
  }

  static getSession(scanId: string): ScanSession | undefined {
    return this.activeSessions.get(scanId);
  }

  static pause(scanId: string): boolean {
    const session = this.activeSessions.get(scanId);
    if (session) {
      session.pause();
      return true;
    }
    return false;
  }

  static resume(scanId: string): boolean {
    const session = this.activeSessions.get(scanId);
    if (session) {
      session.resume();
      return true;
    }
    return false;
  }

  static cancel(scanId: string): boolean {
    const session = this.activeSessions.get(scanId);
    if (session) {
      session.cancel();
      this.activeSessions.delete(scanId);
      return true;
    }
    return false;
  }
}
