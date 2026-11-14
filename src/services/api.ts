import {
  DirectoryListing,
  DriveInfo,
  QuickDirectory,
  StorageXRayReport,
  DuplicateGroup,
  ScanMode,
  ScanProgress,
  InstalledApp,
  AppStorageBreakdown,
  AppFileTreeNode,
  AppLargestFile,
  UninstallPlan,
  UninstallVerificationReport,
  AppComparisonResult,
  LeftoverCandidate,
  LargeFileItem,
  EmptyFolderItem,
  TempCategoryItem,
  FolderComparisonResult,
  RenameRule,
  RenameItemPreview,
  StartupItem,
  DiskHardwareInfo,
  RecycleBinItem,
  DevCleanerItem,
  PermissionReport,
  DiskBenchmarkResult,
  AppSettings,
} from '../types';

// Connect directly to local Windows filesystem bridge on port 3579
const API_BASE = 'http://127.0.0.1:3579/api';

async function fetchWithRetry(url: string, options?: RequestInit, retries = 3, delayMs = 300): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (i === retries - 1) return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return fetch(url, options);
}

export class ApiService {
  static async getDrives(): Promise<{ drives: DriveInfo[]; quickDirs: QuickDirectory[]; userHome: string }> {
    try {
      const res = await fetchWithRetry(`${API_BASE}/drives`);
      if (!res.ok) throw new Error('Failed to fetch drives');
      return await res.json();
    } catch (err) {
      console.warn('Backend connecting or error, retrying...', err);
      // Fallback if initial probe
      const fallback = await fetchWithRetry(`${API_BASE}/drives`, undefined, 5, 500);
      if (fallback.ok) return await fallback.json();
      throw err;
    }
  }

  static async listDirectory(targetPath: string): Promise<DirectoryListing> {
    const res = await fetchWithRetry(`${API_BASE}/directory?path=${encodeURIComponent(targetPath)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to read directory' }));
      throw new Error(err.error || 'Failed to read directory');
    }
    return await res.json();
  }

  /**
   * Listens to asynchronous folder size calculations via Server-Sent Events.
   */
  static streamFolderSizes(
    targetPath: string,
    onProgress: (info: { folderPath: string; size: number; formattedSize: string; fileCount: number; folderCount: number }) => void,
    onDone: (totalComputed: number) => void
  ): () => void {
    const eventSource = new EventSource(`${API_BASE}/folder-sizes?path=${encodeURIComponent(targetPath)}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
          onProgress(data);
        } else if (data.type === 'done') {
          onDone(data.totalComputed || 0);
          eventSource.close();
        }
      } catch (err) {
        console.error('Error parsing SSE folder size data:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }

  static async getStorageXRay(targetPath: string, depth = 5): Promise<StorageXRayReport> {
    const res = await fetchWithRetry(`${API_BASE}/storage-xray?path=${encodeURIComponent(targetPath)}&depth=${depth}`);
    if (!res.ok) throw new Error('Failed to scan storage X-Ray');
    return await res.json();
  }

  /**
   * Starts a live storage scan session using Server-Sent Events with progress metrics and pause/cancel support.
   */
  static startScan(
    targetPath: string,
    mode: ScanMode = 'standard',
    scanId: string,
    onProgress: (progress: ScanProgress) => void,
    onError: (err: any) => void
  ): () => void {
    const eventSource = new EventSource(
      `${API_BASE}/scan/start?path=${encodeURIComponent(targetPath)}&mode=${mode}&scanId=${encodeURIComponent(scanId)}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data: ScanProgress = JSON.parse(event.data);
        onProgress(data);
        if (data.status === 'completed' || data.status === 'cancelled' || data.status === 'error') {
          eventSource.close();
        }
      } catch (err) {
        console.error('Error parsing scan SSE data:', err);
      }
    };

    eventSource.onerror = (err) => {
      onError(err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }

  static async pauseScan(scanId: string): Promise<boolean> {
    try {
      const res = await fetchWithRetry(`${API_BASE}/scan/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanId }),
      });
      const data = await res.json().catch(() => ({ success: false }));
      return data.success;
    } catch {
      return false;
    }
  }

  static async resumeScan(scanId: string): Promise<boolean> {
    try {
      const res = await fetchWithRetry(`${API_BASE}/scan/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanId }),
      });
      const data = await res.json().catch(() => ({ success: false }));
      return data.success;
    } catch {
      return false;
    }
  }

  static async cancelScan(scanId: string): Promise<boolean> {
    try {
      const res = await fetchWithRetry(`${API_BASE}/scan/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanId }),
      });
      const data = await res.json().catch(() => ({ success: false }));
      return data.success;
    } catch {
      return false;
    }
  }

  static async getDuplicates(targetPath: string): Promise<DuplicateGroup[]> {
    const res = await fetchWithRetry(`${API_BASE}/duplicates?path=${encodeURIComponent(targetPath)}`);
    if (!res.ok) throw new Error('Failed to find duplicates');
    const data = await res.json();
    return data.duplicates || [];
  }

  static async search(targetPath: string, query: string, filter = 'all'): Promise<any[]> {
    const res = await fetchWithRetry(
      `${API_BASE}/search?path=${encodeURIComponent(targetPath)}&query=${encodeURIComponent(query)}&filter=${encodeURIComponent(filter)}`
    );
    if (!res.ok) throw new Error('Failed to search');
    const data = await res.json();
    return data.results || [];
  }

  static async fileAction(params: {
    action: 'open' | 'reveal' | 'openTerminal' | 'openVSCode' | 'trash' | 'rename' | 'createFolder' | 'createFile' | 'copy' | 'move' | 'duplicate';
    source: string;
    destination?: string;
    newName?: string;
    conflict?: 'replace' | 'rename' | 'skip';
  }): Promise<any> {
    const res = await fetchWithRetry(`${API_BASE}/file-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Action failed' }));
      throw new Error(err.error || 'Action failed');
    }
    return await res.json();
  }

  // ==========================================
  // Phase 1: Core Navigation, Search & System APIs
  // ==========================================
  static async getPathAutocomplete(prefix: string): Promise<string[]> {
    try {
      const res = await fetchWithRetry(`${API_BASE}/path-autocomplete?prefix=${encodeURIComponent(prefix)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.suggestions || [];
    } catch {
      return [];
    }
  }

  static async deepSearch(rootPath: string, query: string, maxResults = 250): Promise<any[]> {
    const res = await fetchWithRetry(`${API_BASE}/search/deep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootPath, query, maxResults }),
    });
    if (!res.ok) throw new Error('Deep search failed');
    const data = await res.json();
    return data.results || [];
  }

  static async getFileProperties(filePath: string, computeHashes = false): Promise<any> {
    const res = await fetchWithRetry(
      `${API_BASE}/file-properties?path=${encodeURIComponent(filePath)}&hashes=${computeHashes ? 'true' : 'false'}`
    );
    if (!res.ok) throw new Error('Failed to retrieve file properties');
    return await res.json();
  }

  static async setAttributes(filePath: string, updates: { readOnly?: boolean; hidden?: boolean }): Promise<{ success: boolean }> {
    const res = await fetchWithRetry(`${API_BASE}/set-attributes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, ...updates }),
    });
    if (!res.ok) throw new Error('Failed to update file attributes');
    return await res.json();
  }

  static async getTransfers(): Promise<any[]> {
    try {
      const res = await fetchWithRetry(`${API_BASE}/transfers`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.tasks || [];
    } catch {
      return [];
    }
  }

  static async cancelTransfer(id: string): Promise<boolean> {
    try {
      const res = await fetchWithRetry(`${API_BASE}/transfers/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      return !!data.success;
    } catch {
      return false;
    }
  }

  static async clearTransfers(): Promise<void> {
    await fetchWithRetry(`${API_BASE}/transfers/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  static async undo(): Promise<{ success: boolean; message: string; affectedPath?: string }> {
    const res = await fetchWithRetry(`${API_BASE}/undo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return await res.json();
  }

  static async redo(): Promise<{ success: boolean; message: string; affectedPath?: string }> {
    const res = await fetchWithRetry(`${API_BASE}/redo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return await res.json();
  }

  static async getFilePreview(filePath: string, mode?: 'text' | 'media'): Promise<any> {
    if (mode === 'text') {
      const res = await fetchWithRetry(`${API_BASE}/preview?path=${encodeURIComponent(filePath)}&mode=text`);
      if (!res.ok) throw new Error('Failed to load text preview');
      return await res.json();
    }
    return `${API_BASE}/preview?path=${encodeURIComponent(filePath)}`;
  }

  // ==========================================
  // Phase 2: Storage Intelligence, Large Files & Scan History APIs
  // ==========================================
  static async getLargeFiles(params?: {
    path?: string;
    minSize?: number;
    category?: string;
    staleOnly?: boolean;
    limit?: number;
  }): Promise<{ files: LargeFileItem[]; count: number; totalBytes: number; formattedTotalBytes: string }> {
    const query = new URLSearchParams();
    if (params?.path) query.set('path', params.path);
    if (params?.minSize) query.set('minSize', String(params.minSize));
    if (params?.category) query.set('category', params.category);
    if (params?.staleOnly) query.set('staleOnly', 'true');
    if (params?.limit) query.set('limit', String(params.limit));

    const res = await fetchWithRetry(`${API_BASE}/large-files?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch large files');
    return await res.json();
  }

  static async getScanHistory(limit = 50): Promise<ScanHistoryRecord[]> {
    try {
      const res = await fetchWithRetry(`${API_BASE}/scan-history?limit=${limit}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.history || [];
    } catch {
      return [];
    }
  }

  static async getScanHistoryByPath(path: string): Promise<ScanHistoryRecord[]> {
    try {
      const res = await fetchWithRetry(`${API_BASE}/scan-history/by-path?path=${encodeURIComponent(path)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.history || [];
    } catch {
      return [];
    }
  }

  static async compareScanHistory(idA: string, idB: string): Promise<ScanComparisonResult | null> {
    try {
      const res = await fetchWithRetry(`${API_BASE}/scan-history/compare?idA=${encodeURIComponent(idA)}&idB=${encodeURIComponent(idB)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  static async deleteScanHistory(id: string): Promise<boolean> {
    try {
      const res = await fetchWithRetry(`${API_BASE}/scan-history/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      return !!data.success;
    } catch {
      return false;
    }
  }

  static async clearScanHistory(): Promise<boolean> {
    try {
      const res = await fetchWithRetry(`${API_BASE}/scan-history/clear`, {
        method: 'POST',
      });
      const data = await res.json();
      return !!data.success;
    } catch {
      return false;
    }
  }

  static async getCacheStats(): Promise<{ entryCount: number; memoryBytesEstimate: number }> {
    try {
      const res = await fetchWithRetry(`${API_BASE}/cache/stats`);
      if (!res.ok) return { entryCount: 0, memoryBytesEstimate: 0 };
      return await res.json();
    } catch {
      return { entryCount: 0, memoryBytesEstimate: 0 };
    }
  }

  static async clearCache(): Promise<boolean> {
    try {
      const res = await fetchWithRetry(`${API_BASE}/cache/clear`, {
        method: 'POST',
      });
      const data = await res.json();
      return !!data.success;
    } catch {
      return false;
    }
  }

  // ==========================================
  // Applications API
  // ==========================================
  static async getApps(refresh = false): Promise<{ apps: InstalledApp[]; total: number }> {
    const res = await fetchWithRetry(`${API_BASE}/apps?refresh=${refresh}`);
    if (!res.ok) throw new Error('Failed to fetch installed applications');
    return await res.json();
  }

  static async getAppFootprint(appId: string): Promise<AppStorageBreakdown> {
    const res = await fetchWithRetry(`${API_BASE}/apps/${encodeURIComponent(appId)}/footprint`);
    if (!res.ok) throw new Error('Failed to measure application footprint');
    return await res.json();
  }

  static async getAppTree(appId: string, depth = 4): Promise<{ tree: AppFileTreeNode[] }> {
    const res = await fetchWithRetry(`${API_BASE}/apps/${encodeURIComponent(appId)}/tree?depth=${depth}`);
    if (!res.ok) throw new Error('Failed to load application folder tree');
    return await res.json();
  }

  static async getAppLargestFiles(appId: string, limit = 50): Promise<{ largestFiles: AppLargestFile[] }> {
    const res = await fetchWithRetry(`${API_BASE}/apps/${encodeURIComponent(appId)}/largest-files?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to load largest application files');
    return await res.json();
  }

  static async prepareUninstall(appId: string): Promise<UninstallPlan> {
    const res = await fetchWithRetry(`${API_BASE}/apps/uninstall/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId }),
    });
    if (!res.ok) throw new Error('Failed to prepare uninstall plan');
    return await res.json();
  }

  static async executeUninstall(appId: string, useQuiet = false): Promise<{ success: boolean; message: string }> {
    const res = await fetchWithRetry(`${API_BASE}/apps/uninstall/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, useQuiet }),
    });
    if (!res.ok) throw new Error('Failed to execute uninstaller');
    return await res.json();
  }

  static async scanLeftovers(appId: string, preLocations: string[]): Promise<{ leftovers: LeftoverCandidate[] }> {
    const res = await fetchWithRetry(`${API_BASE}/apps/uninstall/leftovers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, preLocations }),
    });
    if (!res.ok) throw new Error('Failed to scan for leftovers');
    return await res.json();
  }

  static async cleanLeftovers(candidates: LeftoverCandidate[]): Promise<UninstallVerificationReport> {
    const res = await fetchWithRetry(`${API_BASE}/apps/uninstall/clean`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidates }),
    });
    if (!res.ok) throw new Error('Failed to clean leftovers');
    return await res.json();
  }

  static async launchApp(appId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetchWithRetry(`${API_BASE}/apps/${encodeURIComponent(appId)}/launch`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to launch application');
    return await res.json();
  }

  static async openAppLocation(appId: string): Promise<{ success: boolean; path: string }> {
    const res = await fetchWithRetry(`${API_BASE}/apps/${encodeURIComponent(appId)}/open-location`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to open application location');
    return await res.json();
  }

  static async compareApps(appAId: string, appBId: string): Promise<AppComparisonResult> {
    const res = await fetchWithRetry(
      `${API_BASE}/apps/compare?appA=${encodeURIComponent(appAId)}&appB=${encodeURIComponent(appBId)}`
    );
    if (!res.ok) throw new Error('Failed to compare applications');
    return await res.json();
  }

  static async exportApps(format: 'csv' | 'json'): Promise<string> {
    const res = await fetchWithRetry(`${API_BASE}/apps/export?format=${format}`);
    if (!res.ok) throw new Error('Failed to export installed applications');
    return await res.text();
  }

  // ==========================================
  // System Utilities API
  // ==========================================
  static async getLargeFiles(targetPath: string, minSize?: number): Promise<{ files: LargeFileItem[]; count: number }> {
    const url = minSize
      ? `${API_BASE}/utils/large-files?path=${encodeURIComponent(targetPath)}&minSize=${minSize}`
      : `${API_BASE}/utils/large-files?path=${encodeURIComponent(targetPath)}`;
    const res = await fetchWithRetry(url);
    if (!res.ok) throw new Error('Failed to find large files');
    return await res.json();
  }

  static async getEmptyFolders(targetPath: string): Promise<{ folders: EmptyFolderItem[]; count: number }> {
    const res = await fetchWithRetry(`${API_BASE}/utils/empty-folders?path=${encodeURIComponent(targetPath)}`);
    if (!res.ok) throw new Error('Failed to find empty folders');
    return await res.json();
  }

  static async cleanEmptyFolders(paths: string[]): Promise<{ success: boolean; cleanedCount: number }> {
    const res = await fetchWithRetry(`${API_BASE}/utils/empty-folders/clean`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    });
    if (!res.ok) throw new Error('Failed to clean empty folders');
    return await res.json();
  }

  static async getTempFiles(): Promise<{ totalBytes: number; formattedTotalBytes: string; categories: TempCategoryItem[] }> {
    const res = await fetchWithRetry(`${API_BASE}/utils/temp-files`);
    if (!res.ok) throw new Error('Failed to scan temporary files');
    return await res.json();
  }

  static async cleanTempCategory(dirPath: string): Promise<{ success: boolean; cleanedBytes: number; cleanedCount: number }> {
    const res = await fetchWithRetry(`${API_BASE}/utils/temp-files/clean`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dirPath }),
    });
    if (!res.ok) throw new Error('Failed to clean temporary files');
    return await res.json();
  }

  static async compareFolders(pathA: string, pathB: string): Promise<FolderComparisonResult> {
    const res = await fetchWithRetry(
      `${API_BASE}/utils/compare-folders?pathA=${encodeURIComponent(pathA)}&pathB=${encodeURIComponent(pathB)}`
    );
    if (!res.ok) throw new Error('Failed to compare folders');
    return await res.json();
  }

  static async previewBatchRename(filePaths: string[], rule: RenameRule): Promise<{ previews: RenameItemPreview[] }> {
    const res = await fetchWithRetry(`${API_BASE}/utils/batch-rename/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePaths, rule }),
    });
    if (!res.ok) throw new Error('Failed to preview rename');
    return await res.json();
  }

  static async applyBatchRename(previews: RenameItemPreview[]): Promise<{ renamed: number; errors: string[] }> {
    const res = await fetchWithRetry(`${API_BASE}/utils/batch-rename/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ previews }),
    });
    if (!res.ok) throw new Error('Failed to apply rename');
    return await res.json();
  }

  static async getFileChecksum(filePath: string): Promise<{
    filePath: string;
    fileName: string;
    size: number;
    formattedSize: string;
    md5: string;
    sha1: string;
    sha256: string;
    sha512: string;
  }> {
    const res = await fetchWithRetry(`${API_BASE}/utils/checksum?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) throw new Error('Failed to compute checksums');
    return await res.json();
  }

  static async getStartupItems(): Promise<{ items: StartupItem[]; count: number }> {
    const res = await fetchWithRetry(`${API_BASE}/utils/startup`);
    if (!res.ok) throw new Error('Failed to fetch startup items');
    return await res.json();
  }

  static async toggleStartupItem(item: StartupItem, enable: boolean): Promise<{ success: boolean }> {
    const res = await fetchWithRetry(`${API_BASE}/utils/startup/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, enable }),
    });
    if (!res.ok) throw new Error('Failed to toggle startup item');
    return await res.json();
  }

  static async getDisksHardwareInfo(): Promise<{ disks: DiskHardwareInfo[]; count: number }> {
    const res = await fetchWithRetry(`${API_BASE}/utils/disks-info`);
    if (!res.ok) throw new Error('Failed to fetch disk hardware info');
    return await res.json();
  }

  static async getRecycleBin(): Promise<{ items: RecycleBinItem[]; totalBytes: number; formattedTotalBytes: string }> {
    const res = await fetchWithRetry(`${API_BASE}/recycle-bin`);
    if (!res.ok) throw new Error('Failed to retrieve Recycle Bin items');
    return await res.json();
  }

  static async restoreRecycleBinItem(name: string): Promise<{ success: boolean; message: string }> {
    const res = await fetchWithRetry(`${API_BASE}/recycle-bin/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Failed to restore item from Recycle Bin');
    return await res.json();
  }

  static async emptyRecycleBin(): Promise<{ success: boolean; message: string }> {
    const res = await fetchWithRetry(`${API_BASE}/recycle-bin/empty`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to empty Recycle Bin');
    return await res.json();
  }

  static async getDevCaches(searchRoot?: string, maxResults = 100): Promise<{ items: DevCleanerItem[]; totalBytes: number; formattedTotalBytes: string }> {
    const url = searchRoot
      ? `${API_BASE}/dev-cleaner?path=${encodeURIComponent(searchRoot)}&maxResults=${maxResults}`
      : `${API_BASE}/dev-cleaner?maxResults=${maxResults}`;
    const res = await fetchWithRetry(url);
    if (!res.ok) throw new Error('Failed to scan development caches');
    return await res.json();
  }

  static async cleanDevCaches(paths: string[]): Promise<{ success: boolean; cleanedCount: number; reclaimedBytes: number; formattedReclaimedBytes: string }> {
    const res = await fetchWithRetry(`${API_BASE}/dev-cleaner/clean`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    });
    if (!res.ok) throw new Error('Failed to clean development caches');
    return await res.json();
  }

  // ==========================================
  // Phase 5: Permissions & Access API (Section 21)
  // ==========================================
  static async getPermissions(targetPath: string): Promise<PermissionReport> {
    const res = await fetchWithRetry(`${API_BASE}/permissions?path=${encodeURIComponent(targetPath)}`);
    if (!res.ok) throw new Error('Failed to inspect permissions');
    return await res.json();
  }

  static async exportPermissions(targetPath: string, format: 'csv' | 'json'): Promise<string> {
    const res = await fetchWithRetry(
      `${API_BASE}/permissions/export?path=${encodeURIComponent(targetPath)}&format=${format}`
    );
    if (!res.ok) throw new Error('Failed to export permissions report');
    return await res.text();
  }

  // ==========================================
  // Phase 5: Startup Extensions API (Section 20)
  // ==========================================
  static async exportStartup(format: 'csv' | 'json'): Promise<string> {
    const res = await fetchWithRetry(`${API_BASE}/startup/export?format=${format}`);
    if (!res.ok) throw new Error('Failed to export startup items');
    return await res.text();
  }

  static async openStartupLocation(itemPath: string): Promise<{ success: boolean }> {
    const res = await fetchWithRetry(`${API_BASE}/startup/open-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: itemPath }),
    });
    if (!res.ok) throw new Error('Failed to open location');
    return await res.json();
  }

  // ==========================================
  // Phase 5: Drive Read Benchmark API (Section 5)
  // ==========================================
  static async benchmarkDrive(drivePath: string): Promise<DiskBenchmarkResult> {
    const res = await fetchWithRetry(`${API_BASE}/drives/benchmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drivePath }),
    });
    if (!res.ok) throw new Error('Failed to execute drive benchmark');
    return await res.json();
  }

  // ==========================================
  // Phase 5: Global Settings & Preferences API (Section 27)
  // ==========================================
  static async getSettings(): Promise<AppSettings> {
    const res = await fetchWithRetry(`${API_BASE}/settings`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return await res.json();
  }

  static async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    const res = await fetchWithRetry(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return await res.json();
  }

  static async resetSettings(): Promise<AppSettings> {
    const res = await fetchWithRetry(`${API_BASE}/settings/reset`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to reset settings');
    return await res.json();
  }

  static async clearSettingsCache(): Promise<{ success: boolean; message: string }> {
    const res = await fetchWithRetry(`${API_BASE}/settings/clear-cache`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to clear cache and history');
    return await res.json();
  }
}
