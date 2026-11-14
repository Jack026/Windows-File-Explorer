import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { StorageXRayReport, FileCategory } from './types.js';
import { ScanMode } from './scan-manager.js';
import { formatBytes } from './scanner.js';

export interface ScanHistoryRecord {
  id: string;
  timestamp: string;
  targetPath: string;
  mode: ScanMode;
  totalBytes: number;
  formattedTotalBytes: string;
  totalFiles: number;
  totalFolders: number;
  durationMs: number;
  categories: Record<
    FileCategory,
    {
      totalBytes: number;
      fileCount: number;
      percent: number;
    }
  >;
  topConsumers: {
    name: string;
    path: string;
    size: number;
    formattedSize: string;
    category: FileCategory;
  }[];
}

export interface ScanComparisonResult {
  scanA: ScanHistoryRecord;
  scanB: ScanHistoryRecord;
  deltaBytes: number;
  formattedDeltaBytes: string;
  isGrowth: boolean;
  deltaPercent: number;
  deltaFiles: number;
  deltaFolders: number;
  categoryDeltas: Record<
    string,
    {
      deltaBytes: number;
      formattedDeltaBytes: string;
      percentChange: number;
    }
  >;
}

export class ScanHistoryEngine {
  private static cacheDir = path.join(process.cwd(), '.cache');
  private static historyFilePath = path.join(process.cwd(), '.cache', 'storage-history.json');
  private static records: ScanHistoryRecord[] = [];
  private static isInitialized = false;

  static async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      if (!fsSync.existsSync(this.cacheDir)) {
        await fs.mkdir(this.cacheDir, { recursive: true });
      }
      if (fsSync.existsSync(this.historyFilePath)) {
        const raw = await fs.readFile(this.historyFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.records = parsed;
        }
      }
      this.isInitialized = true;
    } catch (err) {
      console.warn('[ScanHistoryEngine] Failed to initialize history:', err);
      this.records = [];
      this.isInitialized = true;
    }
  }

  private static async persist(): Promise<void> {
    try {
      if (!fsSync.existsSync(this.cacheDir)) {
        await fs.mkdir(this.cacheDir, { recursive: true });
      }
      await fs.writeFile(this.historyFilePath, JSON.stringify(this.records, null, 2), 'utf8');
    } catch (err) {
      console.warn('[ScanHistoryEngine] Failed to persist scan history:', err);
    }
  }

  static async recordScan(report: StorageXRayReport, mode: ScanMode = 'standard'): Promise<ScanHistoryRecord> {
    await this.init();

    const grandTotal = Math.max(1, report.totalBytes);
    const categoryBreakdown: any = {};

    if (Array.isArray(report.categories)) {
      for (const item of report.categories) {
        categoryBreakdown[item.category] = {
          totalBytes: item.totalBytes,
          fileCount: item.fileCount,
          percent: item.percentage || Math.round((item.totalBytes / grandTotal) * 1000) / 10,
        };
      }
    } else if (report.categories && typeof report.categories === 'object') {
      for (const [cat, data] of Object.entries(report.categories as any)) {
        categoryBreakdown[cat] = {
          totalBytes: (data as any).totalBytes,
          fileCount: (data as any).fileCount,
          percent: Math.round(((data as any).totalBytes / grandTotal) * 1000) / 10,
        };
      }
    }

    const rawList = report.largestFiles || (report as any).topFiles || [];
    const topConsumers = rawList.slice(0, 10).map((f: any) => ({
      name: f.name,
      path: f.path,
      size: f.size || 0,
      formattedSize: f.formattedSize || formatBytes(f.size || 0),
      category: f.category,
    }));

    const record: ScanHistoryRecord = {
      id: `history_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      targetPath: report.rootPath || (report as any).scannedPath || '',
      mode,
      totalBytes: report.totalBytes,
      formattedTotalBytes: report.formattedTotalSize || formatBytes(report.totalBytes),
      totalFiles: report.totalFiles,
      totalFolders: report.totalFolders,
      durationMs: report.durationMs || (report as any).scanDurationMs || 0,
      categories: categoryBreakdown,
      topConsumers,
    };

    // Keep up to 100 records, newest first
    this.records.unshift(record);
    if (this.records.length > 100) {
      this.records = this.records.slice(0, 100);
    }

    await this.persist();
    return record;
  }

  static async getAll(limit = 50): Promise<ScanHistoryRecord[]> {
    await this.init();
    return this.records.slice(0, limit);
  }

  static async getByPath(targetPath: string): Promise<ScanHistoryRecord[]> {
    await this.init();
    const normalized = targetPath.toLowerCase().trim();
    return this.records.filter((r) => r.targetPath.toLowerCase().trim() === normalized);
  }

  static async getById(id: string): Promise<ScanHistoryRecord | null> {
    await this.init();
    return this.records.find((r) => r.id === id) || null;
  }

  static async deleteById(id: string): Promise<boolean> {
    await this.init();
    const initLen = this.records.length;
    this.records = this.records.filter((r) => r.id !== id);
    if (this.records.length !== initLen) {
      await this.persist();
      return true;
    }
    return false;
  }

  static async clearAll(): Promise<boolean> {
    await this.init();
    this.records = [];
    await this.persist();
    return true;
  }

  static async compare(idA: string, idB: string): Promise<ScanComparisonResult | null> {
    await this.init();
    const scanA = this.records.find((r) => r.id === idA);
    const scanB = this.records.find((r) => r.id === idB);
    if (!scanA || !scanB) return null;

    // A is usually older, B is newer
    const deltaBytes = scanB.totalBytes - scanA.totalBytes;
    const isGrowth = deltaBytes >= 0;
    const deltaPercent = scanA.totalBytes > 0 ? Math.round((deltaBytes / scanA.totalBytes) * 1000) / 10 : 0;
    const deltaFiles = scanB.totalFiles - scanA.totalFiles;
    const deltaFolders = scanB.totalFolders - scanA.totalFolders;

    const categoryDeltas: Record<string, { deltaBytes: number; formattedDeltaBytes: string; percentChange: number }> = {};
    const allCategories = new Set([...Object.keys(scanA.categories), ...Object.keys(scanB.categories)]);

    for (const cat of allCategories) {
      const bytesA = scanA.categories[cat as FileCategory]?.totalBytes || 0;
      const bytesB = scanB.categories[cat as FileCategory]?.totalBytes || 0;
      const diff = bytesB - bytesA;
      const pct = bytesA > 0 ? Math.round((diff / bytesA) * 1000) / 10 : bytesB > 0 ? 100 : 0;
      categoryDeltas[cat] = {
        deltaBytes: diff,
        formattedDeltaBytes: (diff > 0 ? '+' : '') + formatBytes(diff),
        percentChange: pct,
      };
    }

    return {
      scanA,
      scanB,
      deltaBytes,
      formattedDeltaBytes: (deltaBytes > 0 ? '+' : '') + formatBytes(deltaBytes),
      isGrowth,
      deltaPercent,
      deltaFiles,
      deltaFolders,
      categoryDeltas,
    };
  }
}
