import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { formatBytes, getFileCategory } from './scanner.js';
import { WindowsBridge } from './windows-bridge.js';
import { runPowerShellScript } from './powershell-runner.js';

const execAsync = promisify(exec);

// ==========================================
// 1. Path Autocomplete Engine
// ==========================================
export class PathAutocomplete {
  static async getSuggestions(inputPath: string): Promise<string[]> {
    if (!inputPath || inputPath.trim().length === 0) {
      return ['C:\\', 'D:\\', os.homedir()];
    }

    try {
      let normalized = inputPath.trim().replace(/\//g, '\\');
      let searchDir: string;
      let filterPrefix = '';

      if (normalized.endsWith('\\')) {
        searchDir = normalized;
      } else {
        searchDir = path.dirname(normalized);
        filterPrefix = path.basename(normalized).toLowerCase();
      }

      if (!fsSync.existsSync(searchDir)) {
        return [];
      }

      const entries = await fs.readdir(searchDir, { withFileTypes: true });
      const suggestions: string[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!filterPrefix || entry.name.toLowerCase().startsWith(filterPrefix)) {
            suggestions.push(path.join(searchDir, entry.name));
            if (suggestions.length >= 15) break;
          }
        }
      }

      return suggestions;
    } catch {
      return [];
    }
  }
}

// ==========================================
// 2. Advanced Search Engine with Filter Syntax
// ==========================================
export interface SearchFilterCriteria {
  rawQuery: string;
  nameTerm: string;
  extensions: string[];
  minSizeBytes: number | null;
  maxSizeBytes: number | null;
  category: string | null;
  modifiedSinceMs: number | null;
  contentTerm: string | null;
  includeHidden: boolean;
}

export class AdvancedSearchEngine {
  static parseQuery(query: string): SearchFilterCriteria {
    const tokens = query.trim().split(/\s+/);
    const criteria: SearchFilterCriteria = {
      rawQuery: query,
      nameTerm: '',
      extensions: [],
      minSizeBytes: null,
      maxSizeBytes: null,
      category: null,
      modifiedSinceMs: null,
      contentTerm: null,
      includeHidden: false,
    };

    const nameParts: string[] = [];

    for (const token of tokens) {
      const lower = token.toLowerCase();

      // Wildcard extensions like *.pdf, *.mp4
      if (lower.startsWith('*.') && lower.length > 2) {
        criteria.extensions.push('.' + lower.slice(2));
      } else if (lower.startsWith('ext:') || lower.startsWith('extension:')) {
        const ext = lower.split(':')[1];
        if (ext) criteria.extensions.push(ext.startsWith('.') ? ext : '.' + ext);
      }
      // Size filters like size:>100MB, size:<500KB, size:>1GB
      else if (lower.startsWith('size:>')) {
        criteria.minSizeBytes = this.parseSizeStringToBytes(lower.replace('size:>', ''));
      } else if (lower.startsWith('size:<')) {
        criteria.maxSizeBytes = this.parseSizeStringToBytes(lower.replace('size:<', ''));
      }
      // Category / Type filter: type:image, type:video, type:document, type:code
      else if (lower.startsWith('type:')) {
        criteria.category = lower.replace('type:', '');
      }
      // Modified date filter: modified:today, modified:7days, modified:30days
      else if (lower.startsWith('modified:')) {
        const mod = lower.replace('modified:', '');
        const now = Date.now();
        if (mod === 'today') criteria.modifiedSinceMs = now - 24 * 60 * 60 * 1000;
        else if (mod === '7days' || mod === 'week') criteria.modifiedSinceMs = now - 7 * 24 * 60 * 60 * 1000;
        else if (mod === '30days' || mod === 'month') criteria.modifiedSinceMs = now - 30 * 24 * 60 * 60 * 1000;
        else if (mod === 'year') criteria.modifiedSinceMs = now - 365 * 24 * 60 * 60 * 1000;
      }
      // Content search inside text/code: content:word
      else if (lower.startsWith('content:')) {
        criteria.contentTerm = token.slice('content:'.length);
      }
      // Hidden files filter
      else if (lower === 'hidden:true' || lower === 'is:hidden') {
        criteria.includeHidden = true;
      } else {
        nameParts.push(token);
      }
    }

    criteria.nameTerm = nameParts.join(' ').toLowerCase();
    return criteria;
  }

  private static parseSizeStringToBytes(str: string): number | null {
    const match = str.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)?$/i);
    if (!match) return null;
    const num = parseFloat(match[1]);
    const unit = (match[2] || 'b').toUpperCase();
    switch (unit) {
      case 'KB': return num * 1024;
      case 'MB': return num * 1024 * 1024;
      case 'GB': return num * 1024 * 1024 * 1024;
      case 'TB': return num * 1024 * 1024 * 1024 * 1024;
      default: return num;
    }
  }

  static async deepSearch(
    rootPath: string,
    rawQuery: string,
    maxResults = 250
  ): Promise<any[]> {
    const criteria = this.parseQuery(rawQuery);
    const results: any[] = [];
    const queue = [path.resolve(rootPath)];

    while (queue.length > 0 && results.length < maxResults) {
      const current = queue.shift()!;
      try {
        const entries = await fs.readdir(current, { withFileTypes: true });

        for (const entry of entries) {
          if (results.length >= maxResults) break;

          const itemPath = path.join(current, entry.name);
          const isDir = entry.isDirectory();
          const ext = path.extname(entry.name).toLowerCase();
          const nameLower = entry.name.toLowerCase();

          // Skip protected / dev bloat subdirectories from recursing unless explicitly targeted
          if (isDir) {
            if (
              !entry.name.startsWith('$') &&
              entry.name !== 'node_modules' &&
              entry.name !== '.git' &&
              entry.name !== 'System Volume Information'
            ) {
              queue.push(itemPath);
            }
          }

          // Evaluate Criteria Matches
          if (criteria.nameTerm && !nameLower.includes(criteria.nameTerm)) {
            continue;
          }

          if (criteria.extensions.length > 0 && !criteria.extensions.includes(ext)) {
            continue;
          }

          const category = getFileCategory(entry.name, isDir);
          if (criteria.category && criteria.category !== 'all') {
            if (category !== criteria.category) {
              continue;
            }
          }

          let stat: any = null;
          try {
            stat = await fs.stat(itemPath);
          } catch {
            continue;
          }

          if (criteria.minSizeBytes !== null && stat.size < criteria.minSizeBytes) {
            continue;
          }

          if (criteria.maxSizeBytes !== null && stat.size > criteria.maxSizeBytes) {
            continue;
          }

          if (criteria.modifiedSinceMs !== null && stat.mtimeMs < criteria.modifiedSinceMs) {
            continue;
          }

          // Optional content search in text files < 2MB
          if (criteria.contentTerm && !isDir && stat.size <= 2 * 1024 * 1024) {
            const isText = ['.txt', '.md', '.json', '.js', '.ts', '.py', '.rs', '.html', '.css', '.xml', '.csv'].includes(ext);
            if (isText) {
              try {
                const text = await fs.readFile(itemPath, 'utf8');
                if (!text.toLowerCase().includes(criteria.contentTerm.toLowerCase())) {
                  continue;
                }
              } catch {
                continue;
              }
            } else {
              continue;
            }
          }

          results.push({
            id: itemPath,
            name: entry.name,
            path: itemPath,
            isDirectory: isDir,
            isFile: entry.isFile(),
            size: stat.size,
            formattedSize: formatBytes(stat.size),
            extension: ext,
            category,
            modifiedAt: stat.mtime.toISOString(),
            createdAt: stat.birthtime.toISOString(),
          });
        }
      } catch {}
    }

    return results;
  }
}

// ==========================================
// 3. File Properties & Win32 Attributes
// ==========================================
export interface DetailedFileProperties {
  path: string;
  name: string;
  directory: string;
  extension: string;
  sizeBytes: number;
  formattedSize: string;
  sizeOnDiskBytes: number;
  formattedSizeOnDisk: string;
  createdAt: string;
  modifiedAt: string;
  accessedAt: string;
  isDirectory: boolean;
  isFile: boolean;
  attributes: {
    readOnly: boolean;
    hidden: boolean;
    system: boolean;
    archive: boolean;
  };
  fileCount?: number;
  folderCount?: number;
  checksums?: {
    md5?: string;
    sha256?: string;
  };
}

export class FilePropertiesEngine {
  static async getProperties(targetPath: string, computeHashes = false): Promise<DetailedFileProperties> {
    const resolved = path.resolve(targetPath);
    const stat = await fs.stat(resolved);
    const isDir = stat.isDirectory();
    const ext = path.extname(resolved).toLowerCase();

    // Query Win32 attributes via PowerShell
    let isReadOnly = false;
    let isHidden = false;
    let isSystem = false;
    let isArchive = false;

    try {
      const psScript = `
$item = Get-Item -LiteralPath '${resolved.replace(/'/g, "''")}' -Force -ErrorAction SilentlyContinue
[PSCustomObject]@{
  ReadOnly = [bool]($item.Attributes -band [System.IO.FileAttributes]::ReadOnly)
  Hidden   = [bool]($item.Attributes -band [System.IO.FileAttributes]::Hidden)
  System   = [bool]($item.Attributes -band [System.IO.FileAttributes]::System)
  Archive  = [bool]($item.Attributes -band [System.IO.FileAttributes]::Archive)
} | ConvertTo-Json -Compress
`;
      const out = await runPowerShellScript(psScript);
      if (out && out.trim()) {
        const parsed = JSON.parse(out);
        isReadOnly = !!parsed.ReadOnly;
        isHidden = !!parsed.Hidden;
        isSystem = !!parsed.System;
        isArchive = !!parsed.Archive;
      }
    } catch {}

    // Calculate cluster allocation (typically 4096-byte cluster size on NTFS)
    const clusterSize = 4096;
    const sizeOnDisk = isDir ? 0 : Math.ceil(stat.size / clusterSize) * clusterSize;

    let fileCount = 0;
    let folderCount = 0;
    if (isDir) {
      try {
        const entries = await fs.readdir(resolved, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory()) folderCount++;
          else fileCount++;
        }
      } catch {}
    }

    let checksums: { md5?: string; sha256?: string } | undefined;
    if (computeHashes && !isDir && stat.size <= 50 * 1024 * 1024) {
      try {
        const buf = await fs.readFile(resolved);
        checksums = {
          md5: crypto.createHash('md5').update(buf).digest('hex'),
          sha256: crypto.createHash('sha256').update(buf).digest('hex'),
        };
      } catch {}
    }

    return {
      path: resolved,
      name: path.basename(resolved),
      directory: path.dirname(resolved),
      extension: ext,
      sizeBytes: stat.size,
      formattedSize: formatBytes(stat.size),
      sizeOnDiskBytes: sizeOnDisk,
      formattedSizeOnDisk: formatBytes(sizeOnDisk),
      sizeOnDiskFormatted: formatBytes(sizeOnDisk),
      createdAt: stat.birthtime.toISOString(),
      modifiedAt: stat.mtime.toISOString(),
      accessedAt: stat.atime.toISOString(),
      isDirectory: isDir,
      isFile: !isDir,
      attributes: {
        readOnly: isReadOnly,
        hidden: isHidden,
        system: isSystem,
        archive: isArchive,
      },
      fileCount: isDir ? fileCount : undefined,
      folderCount: isDir ? folderCount : undefined,
      checksums,
      hashes: checksums,
    };
  }

  static async setAttributes(targetPath: string, updates: { readOnly?: boolean; hidden?: boolean }): Promise<boolean> {
    const resolved = path.resolve(targetPath);
    try {
      if (typeof updates.readOnly === 'boolean') {
        const flag = updates.readOnly ? '+r' : '-r';
        await execAsync(`attrib ${flag} "${resolved}"`);
      }
      if (typeof updates.hidden === 'boolean') {
        const flag = updates.hidden ? '+h' : '-h';
        await execAsync(`attrib ${flag} "${resolved}"`);
      }
      return true;
    } catch {
      return false;
    }
  }
}

// ==========================================
// 4. Operation Queue & Live Transfer Manager
// ==========================================
export interface TransferItem {
  id: string;
  type: 'copy' | 'move' | 'delete' | 'scan' | 'create';
  title: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  sourcePath?: string;
  destinationPath?: string;
  totalItems: number;
  completedItems: number;
  totalBytes: number;
  transferredBytes: number;
  speedBytesPerSec: number;
  startTime: number;
  elapsedMs: number;
  error?: string;
}

export class TransferManager {
  private static tasks: Map<string, TransferItem> = new Map();
  private static abortControllers: Map<string, AbortController> = new Map();

  static getAll(): TransferItem[] {
    const now = Date.now();
    return Array.from(this.tasks.values()).map((t) => {
      if (t.status === 'running') {
        t.elapsedMs = now - t.startTime;
      }
      return t;
    });
  }

  static createTask(
    type: 'copy' | 'move' | 'delete' | 'scan' | 'create',
    title: string,
    sourcePath?: string,
    destinationPath?: string
  ): TransferItem {
    const id = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const task: TransferItem = {
      id,
      type,
      title,
      status: 'running',
      sourcePath,
      destinationPath,
      totalItems: 1,
      completedItems: 0,
      totalBytes: 0,
      transferredBytes: 0,
      speedBytesPerSec: 0,
      startTime: Date.now(),
      elapsedMs: 0,
    };
    this.tasks.set(id, task);
    this.abortControllers.set(id, new AbortController());
    return task;
  }

  static updateProgress(id: string, updates: Partial<TransferItem>) {
    const task = this.tasks.get(id);
    if (task) {
      Object.assign(task, updates);
      task.elapsedMs = Date.now() - task.startTime;
      if (task.elapsedMs > 0 && task.transferredBytes > 0) {
        task.speedBytesPerSec = Math.round((task.transferredBytes / task.elapsedMs) * 1000);
      }
    }
  }

  static completeTask(id: string, success = true, error?: string) {
    const task = this.tasks.get(id);
    if (task) {
      task.status = success ? 'completed' : 'failed';
      task.completedItems = task.totalItems;
      task.elapsedMs = Date.now() - task.startTime;
      if (error) task.error = error;
    }
    this.abortControllers.delete(id);
  }

  static cancel(id: string): boolean {
    const task = this.tasks.get(id);
    const controller = this.abortControllers.get(id);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(id);
    }
    if (task && task.status === 'running') {
      task.status = 'cancelled';
      return true;
    }
    return false;
  }

  static clearCompleted() {
    for (const [id, task] of this.tasks.entries()) {
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
        this.tasks.delete(id);
      }
    }
  }
}

// ==========================================
// 5. Undo / Redo Manager for File Operations
// ==========================================
export interface UndoRecord {
  id: string;
  type: 'rename' | 'move' | 'copy' | 'createFile' | 'createFolder';
  description: string;
  originalPath: string;
  targetPath: string;
  timestamp: number;
}

export class UndoManager {
  private static undoStack: UndoRecord[] = [];
  private static redoStack: UndoRecord[] = [];

  static record(record: Omit<UndoRecord, 'id' | 'timestamp'>) {
    const item: UndoRecord = {
      ...record,
      id: `undo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
    };
    this.undoStack.push(item);
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = []; // Reset redo stack on new action
  }

  static canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  static canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  static async undo(): Promise<{ success: boolean; message: string; description?: string; affectedPath?: string }> {
    const record = this.undoStack.pop();
    if (!record) return { success: false, message: 'Nothing to undo' };

    try {
      switch (record.type) {
        case 'rename':
        case 'move': {
          if (fsSync.existsSync(record.targetPath)) {
            await fs.rename(record.targetPath, record.originalPath);
            this.redoStack.push(record);
            const msg = `Reversed ${record.type}: Restored '${path.basename(record.originalPath)}'`;
            return {
              success: true,
              message: msg,
              description: msg,
              affectedPath: record.originalPath,
            };
          }
          return { success: false, message: `Target '${record.targetPath}' no longer exists` };
        }
        case 'copy':
        case 'createFile':
        case 'createFolder': {
          if (fsSync.existsSync(record.targetPath)) {
            await WindowsBridge.moveToRecycleBin(record.targetPath);
            this.redoStack.push(record);
            const msg = `Reversed ${record.type}: Sent '${path.basename(record.targetPath)}' to Recycle Bin`;
            return {
              success: true,
              message: msg,
              description: msg,
              affectedPath: path.dirname(record.targetPath),
            };
          }
          return { success: false, message: `Created item '${record.targetPath}' no longer exists` };
        }
        default:
          return { success: false, message: `Cannot undo operation '${record.type}'` };
      }
    } catch (err: any) {
      return { success: false, message: `Undo failed: ${err.message}` };
    }
  }

  static async redo(): Promise<{ success: boolean; message: string; description?: string; affectedPath?: string }> {
    const record = this.redoStack.pop();
    if (!record) return { success: false, message: 'Nothing to redo' };

    try {
      switch (record.type) {
        case 'rename':
        case 'move': {
          if (fsSync.existsSync(record.originalPath)) {
            await fs.rename(record.originalPath, record.targetPath);
            this.undoStack.push(record);
            const msg = `Re-applied ${record.type}: Moved to '${path.basename(record.targetPath)}'`;
            return {
              success: true,
              message: msg,
              description: msg,
              affectedPath: record.targetPath,
            };
          }
          return { success: false, message: `Original '${record.originalPath}' no longer exists` };
        }
        case 'createFile': {
          await fs.writeFile(record.targetPath, '', 'utf8');
          this.undoStack.push(record);
          const msg = `Re-created file '${path.basename(record.targetPath)}'`;
          return {
            success: true,
            message: msg,
            description: msg,
            affectedPath: record.targetPath,
          };
        }
        case 'createFolder': {
          await fs.mkdir(record.targetPath, { recursive: true });
          this.undoStack.push(record);
          const msg = `Re-created folder '${path.basename(record.targetPath)}'`;
          return {
            success: true,
            message: msg,
            description: msg,
            affectedPath: record.targetPath,
          };
        }
        case 'copy': {
          if (fsSync.existsSync(record.originalPath)) {
            await fs.cp(record.originalPath, record.targetPath, { recursive: true });
            this.undoStack.push(record);
            const msg = `Re-copied '${path.basename(record.targetPath)}'`;
            return {
              success: true,
              message: msg,
              description: msg,
              affectedPath: record.targetPath,
            };
          }
          return { success: false, message: `Source '${record.originalPath}' no longer exists` };
        }
        default:
          return { success: false, message: `Cannot redo operation '${record.type}'` };
      }
    } catch (err: any) {
      return { success: false, message: `Redo failed: ${err.message}` };
    }
  }
}
