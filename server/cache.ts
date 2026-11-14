import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export interface CachedFolderSize {
  path: string;
  size: number;
  formattedSize: string;
  fileCount: number;
  folderCount: number;
  timestamp: number;
}

export class StorageCache {
  private static memoryCache = new Map<string, CachedFolderSize>();
  private static cacheDir = path.join(process.cwd(), '.cache');
  private static cacheFilePath = path.join(process.cwd(), '.cache', 'storage-cache.json');
  private static isInitialized = false;

  static async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      if (!fsSync.existsSync(this.cacheDir)) {
        await fs.mkdir(this.cacheDir, { recursive: true });
      }
      if (fsSync.existsSync(this.cacheFilePath)) {
        const raw = await fs.readFile(this.cacheFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        for (const [key, val] of Object.entries(parsed)) {
          this.memoryCache.set(key.toLowerCase(), val as CachedFolderSize);
        }
      }
      this.isInitialized = true;
    } catch (e) {
      console.warn('StorageCache init failed, continuing in-memory:', e);
      this.isInitialized = true;
    }
  }

  static get(folderPath: string, maxAgeMs = 10 * 60 * 1000): CachedFolderSize | null {
    const key = folderPath.toLowerCase();
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > maxAgeMs) {
      return null; // Stale
    }
    return entry;
  }

  static set(folderPath: string, data: Omit<CachedFolderSize, 'timestamp' | 'path'>): void {
    const key = folderPath.toLowerCase();
    const entry: CachedFolderSize = {
      path: folderPath,
      ...data,
      timestamp: Date.now(),
    };
    this.memoryCache.set(key, entry);
    this.debounceSave();
  }

  static invalidate(targetPath: string): void {
    const key = targetPath.toLowerCase();
    // Invalidate exact item and all parents
    for (const cachedPath of this.memoryCache.keys()) {
      if (cachedPath.startsWith(key) || key.startsWith(cachedPath)) {
        this.memoryCache.delete(cachedPath);
      }
    }
    this.debounceSave();
  }

  static getStats(): { entryCount: number; memoryBytesEstimate: number } {
    const entryCount = this.memoryCache.size;
    // Estimate ~120 bytes per cache entry
    const memoryBytesEstimate = entryCount * 120;
    return { entryCount, memoryBytesEstimate };
  }

  static async clear(): Promise<void> {
    this.memoryCache.clear();
    try {
      if (fsSync.existsSync(this.cacheFilePath)) {
        await fs.unlink(this.cacheFilePath);
      }
    } catch {}
  }

  private static saveTimeout: NodeJS.Timeout | null = null;
  private static debounceSave(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(async () => {
      try {
        const obj: Record<string, CachedFolderSize> = {};
        for (const [k, v] of this.memoryCache.entries()) {
          obj[k] = v;
        }
        await fs.writeFile(this.cacheFilePath, JSON.stringify(obj, null, 2), 'utf8');
      } catch (err) {
        console.warn('Failed to persist storage cache to disk:', err);
      }
    }, 2000);
  }
}
