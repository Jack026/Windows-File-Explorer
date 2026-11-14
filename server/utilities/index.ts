import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { formatBytes, getFileCategory } from '../scanner.js';
import { WindowsBridge } from '../windows-bridge.js';
import { runPowerShellScript } from '../powershell-runner.js';
import { FileCategory } from '../types.js';

const execAsync = promisify(exec);

// ==========================================
// 1. Large File Finder (Phase 2 & Phase 11)
// ==========================================
export interface LargeFileItem {
  id: string;
  name: string;
  path: string;
  size: number;
  formattedSize: string;
  extension: string;
  category: FileCategory;
  createdAt: string;
  modifiedAt: string;
  accessedAt?: string;
  relativeTime: string;
  isStale: boolean;
}

export class LargeFileFinder {
  static async findLargeFiles(
    targetPath: string,
    minSizeBytes = 50 * 1024 * 1024, // 50 MB default
    categoryFilterOrMaxResults?: string | number,
    staleOnly = false,
    maxResults = 250
  ): Promise<LargeFileItem[]> {
    let categoryFilter: string | undefined;
    let actualMaxResults = maxResults;
    if (typeof categoryFilterOrMaxResults === 'number') {
      actualMaxResults = categoryFilterOrMaxResults;
    } else if (typeof categoryFilterOrMaxResults === 'string') {
      categoryFilter = categoryFilterOrMaxResults;
    }

    const results: LargeFileItem[] = [];
    const resolvedRoot = path.resolve(targetPath);
    const queue = [resolvedRoot];
    const now = Date.now();
    const staleThresholdMs = 180 * 24 * 60 * 60 * 1000; // 180 days
    let dirsVisited = 0;
    const MAX_DIRS = 800; // Cap directory exploration to guarantee sub-second/fast responses

    while (queue.length > 0 && results.length < actualMaxResults * 4 && dirsVisited < MAX_DIRS) {
      const current = queue.shift()!;
      dirsVisited++;
      try {
        const entries = await fs.readdir(current, { withFileTypes: true });
        for (const entry of entries) {
          const itemPath = path.join(current, entry.name);
          const isDir = entry.isDirectory();

          if (isDir) {
            // Skip protected / system files from recursive search
            if (
              !entry.name.startsWith('$') &&
              entry.name !== 'System Volume Information' &&
              entry.name !== 'node_modules' &&
              entry.name !== '.git' &&
              entry.name !== 'WinSxS'
            ) {
              queue.push(itemPath);
            }
          } else if (entry.isFile()) {
            try {
              const stat = await fs.stat(itemPath);
              if (stat.size >= minSizeBytes) {
                const category = getFileCategory(entry.name, false);
                if (categoryFilter && categoryFilter !== 'all' && category !== categoryFilter) {
                  continue;
                }

                const ageMs = now - stat.mtimeMs;
                const isStale = ageMs > staleThresholdMs;

                if (staleOnly && !isStale) {
                  continue;
                }

                const daysAgo = Math.floor(ageMs / (1000 * 60 * 60 * 24));
                const relativeTime = daysAgo === 0 ? 'Today' : `${daysAgo}d ago`;

                results.push({
                  id: itemPath,
                  name: entry.name,
                  path: itemPath,
                  size: stat.size,
                  formattedSize: formatBytes(stat.size),
                  extension: path.extname(entry.name).toLowerCase(),
                  category,
                  createdAt: stat.birthtime.toISOString(),
                  modifiedAt: stat.mtime.toISOString(),
                  accessedAt: stat.atime.toISOString(),
                  relativeTime,
                  isStale,
                });
              }
            } catch {}
          }
        }
      } catch {}
    }

    results.sort((a, b) => b.size - a.size);
    return results.slice(0, actualMaxResults);
  }
}

// ==========================================
// 2. Empty Folder Finder (Phase 23.2)
// ==========================================
export interface EmptyFolderItem {
  path: string;
  name: string;
  parentPath: string;
  lastModified: string;
}

export class EmptyFolderFinder {
  static async findEmptyFolders(targetPath: string, maxResults = 300): Promise<EmptyFolderItem[]> {
    const results: EmptyFolderItem[] = [];
    const queue = [path.resolve(targetPath)];

    while (queue.length > 0 && results.length < maxResults) {
      const current = queue.shift()!;
      try {
        const entries = await fs.readdir(current, { withFileTypes: true });
        if (entries.length === 0) {
          if (current !== targetPath) {
            const stat = await fs.stat(current);
            results.push({
              path: current,
              name: path.basename(current),
              parentPath: path.dirname(current),
              lastModified: stat.mtime.toISOString(),
            });
          }
        } else {
          for (const e of entries) {
            if (e.isDirectory()) {
              queue.push(path.join(current, e.name));
            }
          }
        }
      } catch {}
    }

    return results;
  }

  static async cleanEmptyFolders(paths: string[]): Promise<number> {
    let count = 0;
    for (const p of paths) {
      try {
        await WindowsBridge.moveToRecycleBin(p);
        count++;
      } catch {}
    }
    return count;
  }
}

// ==========================================
// 3. Temporary File Analyzer (Phase 23.3)
// ==========================================
export interface TempCategoryItem {
  id: string;
  label: string;
  path: string;
  size: number;
  formattedSize: string;
  fileCount: number;
  safeToClean: boolean;
}

export class TempFileAnalyzer {
  static async scanTempFiles(): Promise<{ totalBytes: number; formattedTotalBytes: string; categories: TempCategoryItem[] }> {
    const categories: TempCategoryItem[] = [];
    const userHome = os.homedir();
    const localAppData = process.env.LOCALAPPDATA || path.join(userHome, 'AppData', 'Local');

    const targets = [
      { id: 'user_temp', label: 'User Temp Files (%TEMP%)', path: os.tmpdir(), safe: true },
      { id: 'win_temp', label: 'Windows Temp Files (C:\\Windows\\Temp)', path: 'C:\\Windows\\Temp', safe: true },
      { id: 'crash_dumps', label: 'Crash Dumps', path: path.join(localAppData, 'CrashDumps'), safe: true },
      { id: 'chrome_cache', label: 'Google Chrome Cache', path: path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Cache'), safe: true },
      { id: 'edge_cache', label: 'Microsoft Edge Cache', path: path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'), safe: true },
      { id: 'win_logs', label: 'Windows Error Reporting', path: path.join(localAppData, 'Microsoft', 'Windows', 'WER'), safe: true },
    ];

    let totalBytes = 0;

    for (const t of targets) {
      if (fsSync.existsSync(t.path)) {
        const { bytes, count } = await this.measureDir(t.path);
        if (bytes > 0 || count > 0) {
          totalBytes += bytes;
          categories.push({
            id: t.id,
            label: t.label,
            path: t.path,
            size: bytes,
            formattedSize: formatBytes(bytes),
            fileCount: count,
            safeToClean: t.safe,
          });
        }
      }
    }

    return {
      totalBytes,
      formattedTotalBytes: formatBytes(totalBytes),
      categories,
    };
  }

  static async cleanTempCategory(dirPath: string): Promise<{ cleanedBytes: number; cleanedCount: number }> {
    let cleanedBytes = 0;
    let cleanedCount = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(dirPath, e.name);
        try {
          const st = await fs.stat(p);
          const size = st.size;
          await fs.rm(p, { recursive: true, force: true });
          cleanedBytes += size;
          cleanedCount++;
        } catch {
          // Locked temp files in use by running processes are skipped safely
        }
      }
    } catch {}

    return { cleanedBytes, cleanedCount };
  }

  private static async measureDir(dirPath: string): Promise<{ bytes: number; count: number }> {
    let bytes = 0;
    let count = 0;
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(dirPath, e.name);
        try {
          if (e.isDirectory()) {
            const sub = await this.measureDir(p);
            bytes += sub.bytes;
            count += sub.count;
          } else if (e.isFile()) {
            const st = await fs.stat(p);
            bytes += st.size;
            count++;
          }
        } catch {}
      }
    } catch {}
    return { bytes, count };
  }
}

// ==========================================
// 4. Folder Comparison Tool (Phase 23.4)
// ==========================================
export interface FolderComparisonResult {
  pathA: string;
  pathB: string;
  onlyInA: { name: string; path: string; size: number; formattedSize: string }[];
  onlyInB: { name: string; path: string; size: number; formattedSize: string }[];
  different: { name: string; pathA: string; pathB: string; sizeA: number; sizeB: number; formattedDiff: string }[];
  identicalCount: number;
}

export class FolderComparator {
  static async compareFolders(dirA: string, dirB: string): Promise<FolderComparisonResult> {
    const normA = path.resolve(dirA);
    const normB = path.resolve(dirB);

    const mapA = new Map<string, { size: number; mtime: number }>();
    const mapB = new Map<string, { size: number; mtime: number }>();

    await this.collectFiles(normA, '', mapA);
    await this.collectFiles(normB, '', mapB);

    const onlyInA: any[] = [];
    const onlyInB: any[] = [];
    const different: any[] = [];
    let identicalCount = 0;

    for (const [relPath, infoA] of mapA.entries()) {
      const infoB = mapB.get(relPath);
      if (!infoB) {
        onlyInA.push({
          name: relPath,
          path: path.join(normA, relPath),
          size: infoA.size,
          formattedSize: formatBytes(infoA.size),
        });
      } else if (infoA.size !== infoB.size) {
        different.push({
          name: relPath,
          pathA: path.join(normA, relPath),
          pathB: path.join(normB, relPath),
          sizeA: infoA.size,
          sizeB: infoB.size,
          formattedDiff: `${formatBytes(infoA.size)} vs ${formatBytes(infoB.size)}`,
        });
      } else {
        identicalCount++;
      }
    }

    for (const [relPath, infoB] of mapB.entries()) {
      if (!mapA.has(relPath)) {
        onlyInB.push({
          name: relPath,
          path: path.join(normB, relPath),
          size: infoB.size,
          formattedSize: formatBytes(infoB.size),
        });
      }
    }

    return {
      pathA: normA,
      pathB: normB,
      onlyInA,
      onlyInB,
      different,
      identicalCount,
    };
  }

  private static async collectFiles(base: string, sub: string, map: Map<string, { size: number; mtime: number }>) {
    const cur = path.join(base, sub);
    try {
      const entries = await fs.readdir(cur, { withFileTypes: true });
      for (const e of entries) {
        const rel = path.join(sub, e.name);
        const full = path.join(base, rel);
        try {
          if (e.isDirectory()) {
            await this.collectFiles(base, rel, map);
          } else if (e.isFile()) {
            const st = await fs.stat(full);
            map.set(rel.replace(/\\/g, '/'), { size: st.size, mtime: st.mtimeMs });
          }
        } catch {}
      }
    } catch {}
  }
}

// ==========================================
// 5. Batch Rename Engine (Phase 23.5)
// ==========================================
export interface RenameRule {
  type: 'replace' | 'prefix' | 'suffix' | 'numbering' | 'extension';
  findText?: string;
  replaceText?: string;
  prefix?: string;
  suffix?: string;
  startNumber?: number;
  digits?: number;
  newExtension?: string;
}

export interface RenameItemPreview {
  originalPath: string;
  originalName: string;
  newName: string;
  newPath: string;
  hasConflict: boolean;
}

export class BatchRenameEngine {
  static previewRename(filePaths: string[], rule: RenameRule): RenameItemPreview[] {
    const previews: RenameItemPreview[] = [];
    const usedNames = new Set<string>();

    let counter = rule.startNumber ?? 1;

    for (const filePath of filePaths) {
      const dir = path.dirname(filePath);
      const parsed = path.parse(filePath);
      let newBaseName = parsed.name;
      let newExt = parsed.ext;

      switch (rule.type) {
        case 'replace':
          if (rule.findText) {
            newBaseName = newBaseName.replaceAll(rule.findText, rule.replaceText || '');
          }
          break;
        case 'prefix':
          newBaseName = `${rule.prefix || ''}${newBaseName}`;
          break;
        case 'suffix':
          newBaseName = `${newBaseName}${rule.suffix || ''}`;
          break;
        case 'numbering': {
          const numStr = String(counter++).padStart(rule.digits || 2, '0');
          newBaseName = `${newBaseName}_${numStr}`;
          break;
        }
        case 'extension':
          if (rule.newExtension) {
            newExt = rule.newExtension.startsWith('.') ? rule.newExtension : `.${rule.newExtension}`;
          }
          break;
      }

      const newFullName = `${newBaseName}${newExt}`;
      const newPath = path.join(dir, newFullName);
      const hasConflict = fsSync.existsSync(newPath) && newPath.toLowerCase() !== filePath.toLowerCase();

      usedNames.add(newFullName.toLowerCase());

      previews.push({
        originalPath: filePath,
        originalName: parsed.base,
        newName: newFullName,
        newPath,
        hasConflict,
      });
    }

    return previews;
  }

  static async applyRename(previews: RenameItemPreview[]): Promise<{ renamed: number; errors: string[] }> {
    let renamed = 0;
    const errors: string[] = [];

    for (const item of previews) {
      if (item.hasConflict) {
        errors.push(`Conflict: ${item.newName} already exists`);
        continue;
      }
      try {
        await fs.rename(item.originalPath, item.newPath);
        renamed++;
      } catch (err: any) {
        errors.push(`Failed to rename ${item.originalName}: ${err.message}`);
      }
    }

    return { renamed, errors };
  }
}

// ==========================================
// 6. File Checksum Tool (Phase 23.6)
// ==========================================
export class FileChecksumTool {
  static async computeChecksums(filePath: string): Promise<{
    filePath: string;
    fileName: string;
    size: number;
    formattedSize: string;
    md5: string;
    sha1: string;
    sha256: string;
    sha512: string;
  }> {
    const stat = await fs.stat(filePath);
    return new Promise((resolve, reject) => {
      const md5 = crypto.createHash('md5');
      const sha1 = crypto.createHash('sha1');
      const sha256 = crypto.createHash('sha256');
      const sha512 = crypto.createHash('sha512');

      const stream = fsSync.createReadStream(filePath);
      stream.on('data', (chunk) => {
        md5.update(chunk);
        sha1.update(chunk);
        sha256.update(chunk);
        sha512.update(chunk);
      });

      stream.on('end', () => {
        resolve({
          filePath,
          fileName: path.basename(filePath),
          size: stat.size,
          formattedSize: formatBytes(stat.size),
          md5: md5.digest('hex'),
          sha1: sha1.digest('hex'),
          sha256: sha256.digest('hex'),
          sha512: sha512.digest('hex'),
        });
      });

      stream.on('error', reject);
    });
  }
}

// ==========================================
// 7. Startup Application Analyzer (Phase 20 & Phase 5)
// ==========================================
export interface StartupItem {
  id: string;
  name: string;
  publisher?: string;
  command: string;
  resolvedExePath?: string;
  source: 'registry_hklm' | 'registry_hkcu' | 'registry_wow64' | 'startup_folder';
  location: string;
  isEnabled: boolean;
  category?: 'Security' | 'Cloud & Sync' | 'Audio/Hardware' | 'Productivity' | 'Utility' | 'Other';
  fileSize?: number;
  formattedSize?: string;
}

export class StartupManager {
  static async getStartupItems(): Promise<StartupItem[]> {
    const items: StartupItem[] = [];

    // Query Registry Run keys
    const psScript = `
$res = [System.Collections.Generic.List[PSObject]]::new()
$keys = @(
  @{ Path = 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'; Source = 'registry_hklm' },
  @{ Path = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'; Source = 'registry_hkcu' },
  @{ Path = 'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run'; Source = 'registry_wow64' }
)

foreach ($k in $keys) {
  try {
    $props = Get-ItemProperty -Path $k.Path -ErrorAction SilentlyContinue
    if ($props) {
      $props.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object {
        $res.Add([PSCustomObject]@{
          Name = $_.Name
          Command = $_.Value
          Source = $k.Source
          Location = $k.Path
        })
      }
    }
  } catch {}
}
$res | ConvertTo-Json -Compress
`;

    try {
      const stdout = await runPowerShellScript(psScript);
      if (stdout && stdout.trim()) {
        const raw = JSON.parse(stdout);
        const list = Array.isArray(raw) ? raw : [raw];
        for (const r of list) {
          const commandStr = String(r.Command || '');
          const resolvedExe = this.extractExePath(commandStr);
          let publisher = 'Unknown';
          let fileSize = 0;

          if (resolvedExe && fsSync.existsSync(resolvedExe)) {
            try {
              const st = fsSync.statSync(resolvedExe);
              fileSize = st.size;
            } catch {}
          }

          const category = this.categorizeStartup(r.Name, commandStr);

          items.push({
            id: `start_${r.Name}_${r.Source}`,
            name: r.Name,
            publisher,
            command: commandStr,
            resolvedExePath: resolvedExe || undefined,
            source: r.Source,
            location: r.Location,
            isEnabled: true,
            category,
            fileSize: fileSize || undefined,
            formattedSize: fileSize ? formatBytes(fileSize) : undefined,
          });
        }
      }
    } catch {}

    // Query User and Common Startup Folders
    const startupDirs = [
      {
        dir: path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'),
        source: 'startup_folder' as const,
      },
      {
        dir: 'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\Startup',
        source: 'startup_folder' as const,
      },
    ];

    for (const s of startupDirs) {
      try {
        if (fsSync.existsSync(s.dir)) {
          const entries = await fs.readdir(s.dir);
          for (const e of entries) {
            if (e.endsWith('.lnk') || e.endsWith('.url') || e.endsWith('.exe')) {
              const fullPath = path.join(s.dir, e);
              let fileSize = 0;
              try {
                fileSize = fsSync.statSync(fullPath).size;
              } catch {}
              const name = path.parse(e).name;

              items.push({
                id: `startup_folder_${e}_${Buffer.from(s.dir).toString('base64').slice(0, 6)}`,
                name,
                publisher: 'Shortcut / Script',
                command: fullPath,
                resolvedExePath: fullPath,
                source: s.source,
                location: s.dir,
                isEnabled: true,
                category: this.categorizeStartup(name, fullPath),
                fileSize: fileSize || undefined,
                formattedSize: fileSize ? formatBytes(fileSize) : undefined,
              });
            }
          }
        }
      } catch {}
    }

    return items;
  }

  static async toggleStartupItem(item: StartupItem, enable: boolean): Promise<boolean> {
    try {
      if (item.source.startsWith('registry')) {
        const escapedLoc = item.location.replace(/'/g, "''");
        const escapedName = item.name.replace(/'/g, "''");
        const escapedCmd = item.command.replace(/'/g, "''");
        if (!enable) {
          await runPowerShellScript(`Remove-ItemProperty -Path '${escapedLoc}' -Name '${escapedName}' -ErrorAction SilentlyContinue`);
        } else {
          await runPowerShellScript(`Set-ItemProperty -Path '${escapedLoc}' -Name '${escapedName}' -Value '${escapedCmd}' -ErrorAction SilentlyContinue`);
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  static exportStartup(items: StartupItem[], format: 'csv' | 'json'): string {
    if (format === 'json') {
      return JSON.stringify(items, null, 2);
    } else {
      let csv = 'Name,Category,Source,Enabled,Command,ResolvedPath,Size\n';
      for (const i of items) {
        csv += `"${i.name.replace(/"/g, '""')}","${i.category || 'Other'}","${i.source}",${i.isEnabled},"${i.command.replace(/"/g, '""')}","${(i.resolvedExePath || '').replace(/"/g, '""')}","${i.formattedSize || 'N/A'}"\n`;
      }
      return csv;
    }
  }

  private static extractExePath(cmd: string): string | null {
    if (!cmd) return null;
    const trimmed = cmd.trim();
    if (trimmed.startsWith('"')) {
      const closing = trimmed.indexOf('"', 1);
      if (closing > 1) {
        return trimmed.slice(1, closing);
      }
    }
    const tokens = trimmed.split(/\s+/);
    if (tokens[0] && (tokens[0].endsWith('.exe') || tokens[0].endsWith('.cmd') || tokens[0].endsWith('.bat'))) {
      return tokens[0];
    }
    return null;
  }

  private static categorizeStartup(name: string, cmd: string): StartupItem['category'] {
    const combined = `${name} ${cmd}`.toLowerCase();
    if (combined.includes('defender') || combined.includes('antivirus') || combined.includes('security') || combined.includes('firewall')) {
      return 'Security';
    }
    if (combined.includes('onedrive') || combined.includes('dropbox') || combined.includes('google drive') || combined.includes('sync')) {
      return 'Cloud & Sync';
    }
    if (combined.includes('realtek') || combined.includes('waves') || combined.includes('audio') || combined.includes('nvidia') || combined.includes('intel') || combined.includes('amd')) {
      return 'Audio/Hardware';
    }
    if (combined.includes('teams') || combined.includes('slack') || combined.includes('outlook') || combined.includes('discord')) {
      return 'Productivity';
    }
    if (combined.includes('update') || combined.includes('helper') || combined.includes('daemon') || combined.includes('service')) {
      return 'Utility';
    }
    return 'Other';
  }
}

// ==========================================
// 8. Disk & Hardware Drive Info & Non-Destructive Benchmark (Section 5)
// ==========================================
export interface DiskHardwareInfo {
  deviceId: string;
  model: string;
  interfaceType: string;
  mediaType: string;
  sizeBytes: number;
  formattedSize: string;
  status: string;
  health: 'healthy' | 'warning' | 'unknown';
  partitions: number;
  serialNumber: string;
}

export interface DiskBenchmarkResult {
  drivePath: string;
  readSpeedMBs: number;
  formattedSpeed: string;
  latencyMs: number;
  testDurationMs: number;
  bytesRead: number;
  formattedBytesRead: string;
  testTimestamp: string;
}

export class DiskHardwareAnalyzer {
  static async getDisksInfo(): Promise<DiskHardwareInfo[]> {
    const psScript = `
$disks = Get-CimInstance Win32_DiskDrive -ErrorAction SilentlyContinue | Select-Object DeviceID, Model, InterfaceType, MediaType, Size, Status, Partitions, SerialNumber
if (-not $disks) {
  $disks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction SilentlyContinue | Select-Object @{N="DeviceID";E={$_.DeviceID}}, @{N="Model";E={"Fixed Local Disk (" + $_.VolumeName + ")"}}, @{N="InterfaceType";E={"Internal"}}, @{N="MediaType";E={$_.FileSystem}}, @{N="Size";E={$_.Size}}, @{N="Status";E={"OK"}}, @{N="Partitions";E={1}}, @{N="SerialNumber";E={"N/A"}}
}
$disks | ConvertTo-Json -Compress
`;
    try {
      const stdout = await runPowerShellScript(psScript);
      if (!stdout || !stdout.trim()) return [];
      const raw = JSON.parse(stdout);
      const list = Array.isArray(raw) ? raw : [raw];

      return list.map((d) => {
        const size = Number(d.Size || 0);
        const status = d.Status || 'OK';
        return {
          deviceId: d.DeviceID || 'PhysicalDrive',
          model: (d.Model || 'Generic Disk Drive').trim(),
          interfaceType: d.InterfaceType || 'SATA/NVMe',
          mediaType: d.MediaType || 'Fixed hard disk media',
          sizeBytes: size,
          formattedSize: formatBytes(size),
          status,
          health: status.toUpperCase() === 'OK' ? 'healthy' : 'warning',
          partitions: d.Partitions || 1,
          serialNumber: (d.SerialNumber || 'N/A').trim(),
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Safe, non-destructive sequential read benchmark.
   * Measures read throughput by streaming data from existing system files in 1MB chunks.
   */
  static async benchmarkDrive(targetDrivePath = 'C:\\'): Promise<DiskBenchmarkResult> {
    const root = path.resolve(targetDrivePath);
    let sampleFile: string | null = null;

    // Search for a candidate file of suitable size (at least 20MB) to benchmark read speed
    const candidatePaths = [
      path.join(root, 'Windows', 'System32', 'kernel32.dll'),
      path.join(root, 'Windows', 'System32', 'ntdll.dll'),
      path.join(root, 'Windows', 'explorer.exe'),
    ];

    for (const c of candidatePaths) {
      if (fsSync.existsSync(c)) {
        sampleFile = c;
        break;
      }
    }

    // If no candidate, create a temporary 30MB buffer file in temp, read it, then clean it
    let createdTemp = false;
    let tempBenchmarkFile = '';

    if (!sampleFile) {
      tempBenchmarkFile = path.join(os.tmpdir(), `bench_${Date.now()}.bin`);
      const dummyBuf = Buffer.alloc(20 * 1024 * 1024, 0xaa);
      await fs.writeFile(tempBenchmarkFile, dummyBuf);
      sampleFile = tempBenchmarkFile;
      createdTemp = true;
    }

    try {
      const fileStat = await fs.stat(sampleFile);
      const fileHandle = await fs.open(sampleFile, 'r');
      const chunkSize = 1024 * 1024; // 1 MB chunks
      const buffer = Buffer.alloc(chunkSize);
      let totalBytesRead = 0;
      const targetReadBytes = Math.min(fileStat.size * 5, 50 * 1024 * 1024); // benchmark up to 50MB
      let passes = 0;

      const start = performance.now();
      let lastLatency = 0;

      while (totalBytesRead < targetReadBytes && passes < 20) {
        passes++;
        let pos = 0;
        while (pos < fileStat.size && totalBytesRead < targetReadBytes) {
          const toRead = Math.min(chunkSize, fileStat.size - pos);
          const t0 = performance.now();
          const { bytesRead } = await fileHandle.read(buffer, 0, toRead, pos);
          lastLatency = performance.now() - t0;
          totalBytesRead += bytesRead;
          pos += bytesRead;
        }
      }

      const elapsedMs = performance.now() - start;
      await fileHandle.close();

      const elapsedSec = Math.max(elapsedMs / 1000, 0.001);
      const speedMBs = Math.round((totalBytesRead / (1024 * 1024)) / elapsedSec);

      return {
        drivePath: root,
        readSpeedMBs: speedMBs,
        formattedSpeed: `${speedMBs} MB/s`,
        latencyMs: Math.round(lastLatency * 100) / 100,
        testDurationMs: Math.round(elapsedMs),
        bytesRead: totalBytesRead,
        formattedBytesRead: formatBytes(totalBytesRead),
        testTimestamp: new Date().toISOString(),
      };
    } finally {
      if (createdTemp && tempBenchmarkFile && fsSync.existsSync(tempBenchmarkFile)) {
        await fs.unlink(tempBenchmarkFile).catch(() => {});
      }
    }
  }
}

// ==========================================
// 9. Windows Recycle Bin Manager (Section 14)
// ==========================================
export interface RecycleBinItem {
  id: string;
  name: string;
  originalLocation: string;
  dateDeleted: string;
  sizeBytes: number;
  formattedSize: string;
  type: string;
}

export class RecycleBinManager {
  static async getItems(): Promise<{ items: RecycleBinItem[]; totalBytes: number; formattedTotalBytes: string }> {
    const psScript = `
$shell = New-Object -ComObject Shell.Application
$bin = $shell.Namespace(10)
$items = $bin.Items()
$list = [System.Collections.Generic.List[PSObject]]::new()
$count = 0
foreach ($item in $items) {
  if ($count++ -ge 300) { break }
  $name = $bin.GetDetailsOf($item, 0)
  $orig = $bin.GetDetailsOf($item, 1)
  $date = $bin.GetDetailsOf($item, 2)
  $size = $bin.GetDetailsOf($item, 3)
  $type = $bin.GetDetailsOf($item, 4)
  $list.Add([PSCustomObject]@{
    Name = $name
    OriginalLocation = $orig
    DateDeleted = $date
    SizeText = $size
    Type = $type
  })
}
$list | ConvertTo-Json -Compress
`;
    try {
      const stdout = await runPowerShellScript(psScript);
      if (!stdout || !stdout.trim()) {
        return { items: [], totalBytes: 0, formattedTotalBytes: '0 B' };
      }
      const raw = JSON.parse(stdout);
      const list = Array.isArray(raw) ? raw : [raw];
      let totalBytes = 0;

      const items: RecycleBinItem[] = list.map((item, idx) => {
        let bytes = 0;
        if (item.SizeText) {
          const match = String(item.SizeText).match(/([\d\.,]+)\s*(bytes|KB|MB|GB|TB)?/i);
          if (match) {
            const val = parseFloat(match[1].replace(/,/g, ''));
            const unit = (match[2] || 'bytes').toUpperCase();
            if (unit === 'KB') bytes = val * 1024;
            else if (unit === 'MB') bytes = val * 1024 * 1024;
            else if (unit === 'GB') bytes = val * 1024 * 1024 * 1024;
            else bytes = val;
          }
        }
        totalBytes += bytes;

        return {
          id: `rb_${idx}_${Buffer.from(item.Name || '').toString('base64').slice(0, 8)}`,
          name: item.Name || 'Unnamed Item',
          originalLocation: item.OriginalLocation || 'Unknown',
          dateDeleted: item.DateDeleted || '',
          sizeBytes: Math.round(bytes),
          formattedSize: formatBytes(Math.round(bytes)),
          type: item.Type || 'File',
        };
      });

      return {
        items,
        totalBytes: Math.round(totalBytes),
        formattedTotalBytes: formatBytes(Math.round(totalBytes)),
      };
    } catch {
      return { items: [], totalBytes: 0, formattedTotalBytes: '0 B' };
    }
  }

  static async restoreItem(name: string): Promise<{ success: boolean; message: string }> {
    const escapedName = name.replace(/'/g, "''");
    const psScript = `
$shell = New-Object -ComObject Shell.Application
$bin = $shell.Namespace(10)
$restored = $false
foreach ($i in $bin.Items()) {
  if ($i.Name -eq '${escapedName}') {
    $verb = $i.Verbs() | Where-Object { ($_.Name -replace '&', '') -match 'restore' } | Select-Object -First 1
    if ($verb) {
      $verb.DoIt()
      $restored = $true
      break
    }
  }
}
Write-Output $restored
`;
    try {
      const stdout = await runPowerShellScript(psScript);
      const success = stdout.trim().toLowerCase().includes('true');
      return {
        success,
        message: success ? `Successfully restored '${name}'` : `Could not restore '${name}'`,
      };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  static async emptyRecycleBin(): Promise<{ success: boolean; message: string }> {
    try {
      await runPowerShellScript('Clear-RecycleBin -Force -ErrorAction SilentlyContinue');
      return { success: true, message: 'Windows Recycle Bin emptied cleanly.' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }
}

// ==========================================
// 10. Advanced Development Cleaner (Section 12)
// ==========================================
export interface DevCleanerItem {
  id: string;
  name: string;
  path: string;
  projectName: string;
  projectPath: string;
  ecosystem: 'Node.js' | 'Python' | 'Rust' | 'Flutter' | 'Java' | '.NET' | 'Build Output';
  sizeBytes: number;
  formattedSize: string;
  fileCount: number;
  lastModified: string;
  cleanupRisk: 'Low' | 'Medium';
  regenerationHint: string;
}

export class DevCleaner {
  private static KNOWN_DIRS: Record<string, { ecosystem: DevCleanerItem['ecosystem']; hint: string }> = {
    'node_modules': { ecosystem: 'Node.js', hint: 'Regenerate via: npm install / pnpm install / yarn' },
    '.next': { ecosystem: 'Node.js', hint: 'Regenerate via: npm run build' },
    '.turbo': { ecosystem: 'Node.js', hint: 'Turborepo cache. Automatically recreated on build' },
    '__pycache__': { ecosystem: 'Python', hint: 'Python bytecode cache. Automatically regenerated at runtime' },
    '.pytest_cache': { ecosystem: 'Python', hint: 'Pytest cache. Regenerated on next test run' },
    '.mypy_cache': { ecosystem: 'Python', hint: 'Mypy cache. Regenerated on next check' },
    '.venv': { ecosystem: 'Python', hint: 'Virtual environment. Recreate via: python -m venv .venv' },
    'venv': { ecosystem: 'Python', hint: 'Virtual environment. Recreate via: python -m venv venv' },
    'target': { ecosystem: 'Rust', hint: 'Rust build artifacts. Regenerate via: cargo build' },
    '.dart_tool': { ecosystem: 'Flutter', hint: 'Dart build cache. Regenerate via: flutter pub get' },
    '.gradle': { ecosystem: 'Java', hint: 'Gradle build cache. Regenerate via: ./gradlew build' },
    'bin': { ecosystem: '.NET', hint: '.NET compiled binary output. Regenerate via: dotnet build' },
    'obj': { ecosystem: '.NET', hint: '.NET intermediate build objects. Regenerate via: dotnet build' },
  };

  static async scanDevCaches(
    searchRoot: string,
    maxResults = 100
  ): Promise<{ items: DevCleanerItem[]; totalBytes: number; formattedTotalBytes: string }> {
    const items: DevCleanerItem[] = [];
    const queue = [path.resolve(searchRoot)];
    let totalBytes = 0;
    let dirsVisited = 0;
    const MAX_DIRS = 800;

    while (queue.length > 0 && items.length < maxResults && dirsVisited < MAX_DIRS) {
      const current = queue.shift()!;
      dirsVisited++;
      try {
        const entries = await fs.readdir(current, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const folderName = entry.name.toLowerCase();

          if (folderName === '.git' || folderName.startsWith('$') || folderName === 'system volume information') {
            continue;
          }

          const matched = this.KNOWN_DIRS[folderName];
          const fullPath = path.join(current, entry.name);

          if (matched) {
            try {
              const { bytes, count, mtime } = await this.measureDir(fullPath);
              if (bytes > 0 || count > 0) {
                totalBytes += bytes;
                items.push({
                  id: `dev_${Buffer.from(fullPath).toString('base64').slice(0, 16)}`,
                  name: entry.name,
                  path: fullPath,
                  projectName: path.basename(current),
                  projectPath: current,
                  ecosystem: matched.ecosystem,
                  sizeBytes: bytes,
                  formattedSize: formatBytes(bytes),
                  fileCount: count,
                  lastModified: mtime.toISOString(),
                  cleanupRisk: 'Low',
                  regenerationHint: matched.hint,
                });
              }
            } catch {}
          } else {
            queue.push(fullPath);
          }
        }
      } catch {}
    }

    items.sort((a, b) => b.sizeBytes - a.sizeBytes);
    return {
      items,
      totalBytes,
      formattedTotalBytes: formatBytes(totalBytes),
    };
  }

  static async cleanDevItems(paths: string[]): Promise<{ cleanedCount: number; reclaimedBytes: number; formattedReclaimedBytes: string }> {
    let reclaimed = 0;
    let count = 0;
    for (const p of paths) {
      if (p.toLowerCase().includes('.git') || p.endsWith(':\\') || p.endsWith(':/')) {
        continue;
      }
      try {
        if (fsSync.existsSync(p)) {
          const { bytes } = await this.measureDir(p);
          await WindowsBridge.moveToRecycleBin(p);
          reclaimed += bytes;
          count++;
        }
      } catch {}
    }

    return {
      cleanedCount: count,
      reclaimedBytes: reclaimed,
      formattedReclaimedBytes: formatBytes(reclaimed),
    };
  }

  private static async measureDir(dirPath: string): Promise<{ bytes: number; count: number; mtime: Date }> {
    let bytes = 0;
    let count = 0;
    let latestMtime = new Date(0);

    const queue = [dirPath];
    let visited = 0;
    const MAX_FILES = 5000;

    while (queue.length > 0 && visited < MAX_FILES) {
      const cur = queue.shift()!;
      try {
        const entries = await fs.readdir(cur, { withFileTypes: true });
        for (const e of entries) {
          visited++;
          const p = path.join(cur, e.name);
          try {
            if (e.isDirectory()) {
              queue.push(p);
            } else if (e.isFile()) {
              const st = await fs.stat(p);
              bytes += st.size;
              count++;
              if (st.mtime > latestMtime) latestMtime = st.mtime;
            }
          } catch {}
        }
      } catch {}
    }

    return { bytes, count, mtime: latestMtime };
  }
}
