import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  FileCategory,
  FileItem,
  DirectoryListing,
  CategorySummary,
  BloatItem,
  TreemapNode,
  StorageXRayReport,
  DuplicateGroup,
} from './types.js';
import { WindowsBridge } from './windows-bridge.js';

export const CATEGORY_COLORS: Record<FileCategory, string> = {
  media: '#8B5CF6',     // Violet
  code: '#F59E0B',      // Amber
  archive: '#EC4899',   // Rose
  document: '#3B82F6',  // Blue
  executable: '#10B981',// Emerald
  system: '#64748B',    // Slate
  other: '#94A3B8',     // Muted Slate
};

const DEV_BLOAT_NAMES = new Set([
  'node_modules',
  '.venv',
  'venv',
  '__pycache__',
  '.next',
  '.nuxt',
  'target',
  'dist',
  'build',
  '.gradle',
  '.cargo',
  '.turbo',
  'vendor',
  '.cache',
  'temp',
  'tmp',
]);

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function getFileCategory(filename: string, isDirectory: boolean): FileCategory {
  if (isDirectory) {
    const lower = filename.toLowerCase();
    if (DEV_BLOAT_NAMES.has(lower) || lower.startsWith('.git')) return 'code';
    if (lower === '$recycle.bin' || lower.includes('system volume information')) return 'system';
    return 'other';
  }

  const ext = path.extname(filename).toLowerCase().replace('.', '');
  if (!ext) return 'other';

  const mediaExts = new Set([
    'mp4', 'mkv', 'mov', 'avi', 'webm', 'flv', 'wmv', 'm4v',
    'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'tiff', 'ico', 'raw', 'cr2', 'nef', 'psd', 'ai',
    'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus',
  ]);

  const codeExts = new Set([
    'js', 'ts', 'jsx', 'tsx', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'rb',
    'html', 'css', 'scss', 'sass', 'less', 'json', 'yaml', 'yml', 'xml', 'sql', 'sh', 'bash', 'ps1',
    'bat', 'cmd', 'toml', 'env', 'prisma', 'graphql',
  ]);

  const archiveExts = new Set([
    'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'dmg', 'vhd', 'vhdx', 'cab', 'tgz',
  ]);

  const docExts = new Set([
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'tsv', 'txt', 'md', 'rtf', 'odt', 'ods', 'odp',
  ]);

  const execExts = new Set([
    'exe', 'msi', 'dll', 'sys', 'bin', 'appx', 'msix', 'apk',
  ]);

  if (mediaExts.has(ext)) return 'media';
  if (codeExts.has(ext)) return 'code';
  if (archiveExts.has(ext)) return 'archive';
  if (docExts.has(ext)) return 'document';
  if (execExts.has(ext)) return 'executable';

  return 'other';
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  return date.toLocaleDateString(undefined, {
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export class Scanner {
  /**
   * Fast non-blocking listing of a directory for instant navigation.
   */
  static async listDirectory(targetPath: string): Promise<DirectoryListing> {
    const normalized = path.resolve(targetPath);
    const rootParsed = path.parse(normalized);
    const isRoot = normalized.toLowerCase() === rootParsed.root.toLowerCase();
    const parentPath = isRoot ? null : path.dirname(normalized);

    let entries: fsSync.Dirent[] = [];
    let isLocked = false;

    try {
      entries = await fs.readdir(normalized, { withFileTypes: true });
    } catch (err: any) {
      if (err.code === 'EPERM' || err.code === 'EACCES') {
        isLocked = true;
      } else {
        throw err;
      }
    }

    const items: FileItem[] = [];
    let totalSize = 0;
    let totalFiles = 0;
    let totalFolders = 0;

    for (const entry of entries) {
      const fullItemPath = path.join(normalized, entry.name);
      const isDirectory = entry.isDirectory();
      const isFile = entry.isFile();
      const isSymbolicLink = entry.isSymbolicLink();
      const ext = isDirectory ? '' : path.extname(entry.name).toLowerCase();
      const category = getFileCategory(entry.name, isDirectory);
      const isDevCache = isDirectory && DEV_BLOAT_NAMES.has(entry.name.toLowerCase());

      let size: number | null = null;
      let createdAt = new Date().toISOString();
      let modifiedAt = new Date().toISOString();
      let relativeTime = 'Recently';
      let itemLocked = false;

      try {
        const stats = await fs.stat(fullItemPath);
        if (isFile) {
          size = stats.size;
          totalSize += stats.size;
          totalFiles++;
        } else if (isDirectory) {
          totalFolders++;
        }
        createdAt = stats.birthtime.toISOString();
        modifiedAt = stats.mtime.toISOString();
        relativeTime = formatRelativeTime(stats.mtime);
      } catch (err: any) {
        if (err.code === 'EPERM' || err.code === 'EACCES' || err.code === 'EBUSY') {
          itemLocked = true;
        }
      }

      items.push({
        id: fullItemPath,
        name: entry.name,
        path: fullItemPath,
        isDirectory,
        isFile,
        isSymbolicLink,
        isLocked: itemLocked,
        isDevCache,
        size,
        formattedSize: size !== null ? formatBytes(size) : undefined,
        extension: ext,
        category,
        createdAt,
        modifiedAt,
        relativeTime,
      });
    }

    // Check project status
    const projectInfo = await WindowsBridge.checkProject(normalized);

    return {
      currentPath: normalized,
      parentPath,
      exists: true,
      isLocked,
      items,
      totalFiles,
      totalFolders,
      totalSize,
      isProject: projectInfo.isProject,
      projectType: projectInfo.projectType,
    };
  }

  /**
   * Recursively computes folder sizes for all subfolders in targetPath
   * and yields updates through the onProgress callback.
   */
  static async computeSubfolderSizes(
    targetPath: string,
    onProgress: (info: { folderPath: string; size: number; formattedSize: string; fileCount: number; folderCount: number }) => void,
    abortSignal?: { isAborted: boolean }
  ): Promise<void> {
    const normalized = path.resolve(targetPath);
    let entries: fsSync.Dirent[] = [];
    try {
      entries = await fs.readdir(normalized, { withFileTypes: true });
    } catch {
      return;
    }

    const subfolders = entries.filter((e) => e.isDirectory());

    for (const folder of subfolders) {
      if (abortSignal?.isAborted) break;

      const folderPath = path.join(normalized, folder.name);
      try {
        const result = await this.calculateFolderTotal(folderPath, abortSignal);
        if (abortSignal?.isAborted) break;

        onProgress({
          folderPath,
          size: result.totalBytes,
          formattedSize: formatBytes(result.totalBytes),
          fileCount: result.fileCount,
          folderCount: result.folderCount,
        });
      } catch {
        // Skip inaccessible subfolders
      }
    }
  }

  /**
   * Fast recursive folder accumulator.
   */
  static async calculateFolderTotal(
    folderPath: string,
    abortSignal?: { isAborted: boolean }
  ): Promise<{ totalBytes: number; fileCount: number; folderCount: number }> {
    let totalBytes = 0;
    let fileCount = 0;
    let folderCount = 0;

    const queue: string[] = [folderPath];

    while (queue.length > 0) {
      if (abortSignal?.isAborted) break;
      const current = queue.shift()!;

      try {
        const entries = await fs.readdir(current, { withFileTypes: true });
        for (const entry of entries) {
          const itemPath = path.join(current, entry.name);
          try {
            if (entry.isDirectory()) {
              folderCount++;
              // Don't recurse deeply into huge dev bloats to save CPU during quick folder sizing
              queue.push(itemPath);
            } else if (entry.isFile()) {
              const stats = await fs.stat(itemPath);
              totalBytes += stats.size;
              fileCount++;
            }
          } catch {
            // Ignore locked files
          }
        }
      } catch {
        // Ignore unreadable dirs
      }
    }

    return { totalBytes, fileCount, folderCount };
  }

  /**
   * Full Storage X-Ray Analyzer:
   * Categorizes all storage, identifies top 50 largest files,
   * highlights dev bloat & cache reclaim opportunities, and builds treemap nodes.
   */
  static async scanStorageXRay(
    targetPath: string,
    maxDepth = 5,
    onProgress?: (scannedFiles: number, totalBytes: number) => void,
    abortSignal?: { isAborted: boolean }
  ): Promise<StorageXRayReport> {
    const startTime = Date.now();
    const normalized = path.resolve(targetPath);

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
    let grandTotalBytes = 0;
    let grandTotalFiles = 0;
    let grandTotalFolders = 0;
    let progressCounter = 0;

    // Recursive walk that builds TreemapNode
    async function walk(
      currentPath: string,
      currentDepth: number
    ): Promise<TreemapNode> {
      const name = path.basename(currentPath) || currentPath;
      let nodeTotalBytes = 0;
      let nodeItemCount = 0;
      const childNodes: TreemapNode[] = [];

      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          if (abortSignal?.isAborted) break;

          const itemPath = path.join(currentPath, entry.name);
          const isDir = entry.isDirectory();
          const category = getFileCategory(entry.name, isDir);
          const isBloatDir = isDir && DEV_BLOAT_NAMES.has(entry.name.toLowerCase());

          try {
            if (isDir) {
              grandTotalFolders++;

              // Check if it's a known bloat directory
              if (isBloatDir) {
                const bloatStats = await Scanner.calculateFolderTotal(itemPath, abortSignal);
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
                grandTotalFiles += bloatStats.fileCount;
                grandTotalBytes += bloatStats.totalBytes;
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
              } else if (currentDepth < maxDepth) {
                // Regular subfolder: recurse
                const subNode = await walk(itemPath, currentDepth + 1);
                nodeTotalBytes += subNode.size;
                nodeItemCount += (subNode.itemCount || 0) + 1;
                childNodes.push(subNode);
              } else {
                // Depth exceeded: estimate summary
                const shallowStats = await Scanner.calculateFolderTotal(itemPath, abortSignal);
                nodeTotalBytes += shallowStats.totalBytes;
                nodeItemCount += shallowStats.fileCount;
                grandTotalBytes += shallowStats.totalBytes;
                grandTotalFiles += shallowStats.fileCount;

                categoryMap[category].totalBytes += shallowStats.totalBytes;
                categoryMap[category].fileCount += shallowStats.fileCount;

                childNodes.push({
                  id: itemPath,
                  name: entry.name,
                  path: itemPath,
                  size: shallowStats.totalBytes,
                  formattedSize: formatBytes(shallowStats.totalBytes),
                  category,
                  color: CATEGORY_COLORS[category],
                  isDirectory: true,
                  itemCount: shallowStats.fileCount,
                  children: [],
                });
              }
            } else if (entry.isFile()) {
              const stats = await fs.stat(itemPath);
              const size = stats.size;
              grandTotalFiles++;
              grandTotalBytes += size;
              nodeTotalBytes += size;
              nodeItemCount++;

              categoryMap[category].totalBytes += size;
              categoryMap[category].fileCount++;

              // Large file tracking (files > 10MB or top candidates)
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
                  createdAt: stats.birthtime.toISOString(),
                  modifiedAt: stats.mtime.toISOString(),
                  relativeTime: formatRelativeTime(stats.mtime),
                });
              }

              // Add significant files as treemap leaf nodes
              if (size > 5 * 1024 * 1024 || currentDepth <= 2) {
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

              progressCounter++;
              if (progressCounter % 250 === 0 && onProgress) {
                onProgress(grandTotalFiles, grandTotalBytes);
              }
            }
          } catch {
            // Ignore locked files/dirs
          }
        }
      } catch {
        // Inaccessible root
      }

      // Sort children by descending size
      childNodes.sort((a, b) => b.size - a.size);

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
    }

    const treemapRoot = await walk(normalized, 0);

    // Build category summaries
    const categoryLabels: Record<FileCategory, string> = {
      media: 'Video & Media',
      code: 'Code & Dev Bloat',
      archive: 'Archives & Disk Images',
      document: 'Documents & Data',
      executable: 'Apps & Executables',
      system: 'System & Reserved',
      other: 'Other Files',
    };

    const categories: CategorySummary[] = (Object.keys(categoryMap) as FileCategory[])
      .map((cat) => {
        const data = categoryMap[cat];
        const percentage = grandTotalBytes > 0 ? (data.totalBytes / grandTotalBytes) * 100 : 0;
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

    // Sort largest files descending & limit to 50
    allLargeFiles.sort((a, b) => (b.size || 0) - (a.size || 0));
    const largestFiles = allLargeFiles.slice(0, 50);

    // Bloat items sorted by descending size
    bloatItems.sort((a, b) => b.size - a.size);
    const potentialReclaimBytes = bloatItems.reduce((acc, curr) => acc + curr.size, 0);

    const durationMs = Date.now() - startTime;

    return {
      rootPath: normalized,
      totalBytes: grandTotalBytes,
      formattedTotalSize: formatBytes(grandTotalBytes),
      totalFiles: grandTotalFiles,
      totalFolders: grandTotalFolders,
      durationMs,
      categories,
      treemapRoot,
      largestFiles,
      bloatItems,
      potentialReclaimBytes,
      formattedPotentialReclaim: formatBytes(potentialReclaimBytes),
    };
  }

  /**
   * Scans a path for duplicate files using size grouping, partial hashing, and full SHA-256.
   */
  static async findDuplicates(
    targetPath: string,
    abortSignal?: { isAborted: boolean }
  ): Promise<DuplicateGroup[]> {
    const normalized = path.resolve(targetPath);
    const sizeMap = new Map<number, string[]>();

    // Step 1: Collect files by size
    const queue = [normalized];
    while (queue.length > 0) {
      if (abortSignal?.isAborted) break;
      const current = queue.shift()!;
      try {
        const entries = await fs.readdir(current, { withFileTypes: true });
        for (const entry of entries) {
          const itemPath = path.join(current, entry.name);
          if (entry.isDirectory()) {
            if (!DEV_BLOAT_NAMES.has(entry.name.toLowerCase())) {
              queue.push(itemPath);
            }
          } else if (entry.isFile()) {
            try {
              const stat = await fs.stat(itemPath);
              if (stat.size > 1024) {
                // Only consider files > 1KB
                const list = sizeMap.get(stat.size) || [];
                list.push(itemPath);
                sizeMap.set(stat.size, list);
              }
            } catch {}
          }
        }
      } catch {}
    }

    // Step 2: For sizes with > 1 file, compute SHA-256 hash
    const duplicateGroups: DuplicateGroup[] = [];

    for (const [size, filePaths] of sizeMap.entries()) {
      if (filePaths.length <= 1 || abortSignal?.isAborted) continue;

      const hashMap = new Map<string, string[]>();

      for (const filePath of filePaths) {
        try {
          const hash = await this.hashFile(filePath);
          const list = hashMap.get(hash) || [];
          list.push(filePath);
          hashMap.set(hash, list);
        } catch {}
      }

      for (const [hash, matchingPaths] of hashMap.entries()) {
        if (matchingPaths.length > 1) {
          const items: FileItem[] = [];
          for (const p of matchingPaths) {
            try {
              const stat = await fs.stat(p);
              items.push({
                id: p,
                name: path.basename(p),
                path: p,
                isDirectory: false,
                isFile: true,
                size,
                formattedSize: formatBytes(size),
                extension: path.extname(p).toLowerCase(),
                category: getFileCategory(path.basename(p), false),
                createdAt: stat.birthtime.toISOString(),
                modifiedAt: stat.mtime.toISOString(),
                relativeTime: formatRelativeTime(stat.mtime),
              });
            } catch {}
          }

          const wasteBytes = size * (matchingPaths.length - 1);
          duplicateGroups.push({
            hash,
            size,
            formattedSize: formatBytes(size),
            wasteBytes,
            formattedWaste: formatBytes(wasteBytes),
            items,
          });
        }
      }
    }

    // Sort by largest wasted space first
    duplicateGroups.sort((a, b) => b.wasteBytes - a.wasteBytes);
    return duplicateGroups;
  }

  private static async hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fsSync.createReadStream(filePath);
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }
}
