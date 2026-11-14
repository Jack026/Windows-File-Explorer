import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import {
  InstalledApp,
  AppStorageBreakdown,
  AppLocationDetail,
  AppFileTreeNode,
  AppLargestFile,
  OwnershipConfidence,
  AppComparisonResult,
} from './types.js';
import { formatBytes } from '../scanner.js';

interface MeasureResult {
  totalBytes: number;
  fileCount: number;
  folderCount: number;
  largestFiles: AppLargestFile[];
  isAccessible: boolean;
}

export class AppFootprintAnalyzer {
  private static breakdownCache = new Map<string, { data: AppStorageBreakdown; timestamp: number }>();
  private static readonly CACHE_TTL_MS = 120_000; // 2 minutes

  /**
   * Performs deep on-disk measurement of all files associated with the application.
   */
  static async measureApplicationFootprint(app: InstalledApp): Promise<AppStorageBreakdown> {
    const cached = this.breakdownCache.get(app.id);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }

    const locations = await this.resolveApplicationLocations(app);
    const locationDetails: AppLocationDetail[] = [];

    let mainInstallSize = 0;
    let mainInstallPath: string | null = null;
    let appDataLocalSize = 0;
    let appDataLocalPath: string | null = null;
    let appDataRoamingSize = 0;
    let appDataRoamingPath: string | null = null;
    let programDataSize = 0;
    let programDataPath: string | null = null;
    let cacheSize = 0;
    let logsAndTempSize = 0;
    let otherDataSize = 0;
    let totalFiles = 0;
    let totalFolders = 0;

    for (const loc of locations) {
      const measurement = await this.measureFolder(loc.path);

      const detail: AppLocationDetail = {
        label: loc.label,
        path: loc.path,
        size: measurement.totalBytes,
        formattedSize: formatBytes(measurement.totalBytes),
        confidence: loc.confidence,
        category: loc.category,
        fileCount: measurement.fileCount,
        folderCount: measurement.folderCount,
        isAccessible: measurement.isAccessible,
      };

      locationDetails.push(detail);

      totalFiles += measurement.fileCount;
      totalFolders += measurement.folderCount;

      switch (loc.category) {
        case 'main':
          mainInstallSize += measurement.totalBytes;
          if (!mainInstallPath) mainInstallPath = loc.path;
          break;
        case 'local':
          appDataLocalSize += measurement.totalBytes;
          if (!appDataLocalPath) appDataLocalPath = loc.path;
          break;
        case 'roaming':
          appDataRoamingSize += measurement.totalBytes;
          if (!appDataRoamingPath) appDataRoamingPath = loc.path;
          break;
        case 'programdata':
          programDataSize += measurement.totalBytes;
          if (!programDataPath) programDataPath = loc.path;
          break;
        case 'cache':
          cacheSize += measurement.totalBytes;
          break;
        case 'logs':
          logsAndTempSize += measurement.totalBytes;
          break;
        default:
          otherDataSize += measurement.totalBytes;
          break;
      }
    }

    const totalMeasuredFootprint =
      mainInstallSize +
      appDataLocalSize +
      appDataRoamingSize +
      programDataSize +
      cacheSize +
      logsAndTempSize +
      otherDataSize;

    const breakdown: AppStorageBreakdown = {
      appId: app.id,
      appName: app.displayName,
      mainInstallSize,
      formattedMainInstallSize: formatBytes(mainInstallSize),
      mainInstallPath,
      appDataLocalSize,
      formattedAppDataLocalSize: formatBytes(appDataLocalSize),
      appDataLocalPath,
      appDataRoamingSize,
      formattedAppDataRoamingSize: formatBytes(appDataRoamingSize),
      appDataRoamingPath,
      programDataSize,
      formattedProgramDataSize: formatBytes(programDataSize),
      programDataPath,
      cacheSize,
      formattedCacheSize: formatBytes(cacheSize),
      logsAndTempSize,
      formattedLogsAndTempSize: formatBytes(logsAndTempSize),
      otherDataSize,
      formattedOtherDataSize: formatBytes(otherDataSize),
      totalMeasuredFootprint,
      formattedTotalMeasuredFootprint: formatBytes(totalMeasuredFootprint),
      totalFiles,
      totalFolders,
      locations: locationDetails,
    };

    // Update app record with measured size
    app.measuredSize = totalMeasuredFootprint;
    app.formattedMeasuredSize = formatBytes(totalMeasuredFootprint);

    this.breakdownCache.set(app.id, { data: breakdown, timestamp: Date.now() });
    return breakdown;
  }

  /**
   * Generates a real hierarchical file tree for "Explore Application Files".
   */
  static async getApplicationFileTree(app: InstalledApp, maxDepth = 4): Promise<AppFileTreeNode[]> {
    const locations = await this.resolveApplicationLocations(app);
    const roots: AppFileTreeNode[] = [];

    for (const loc of locations) {
      if (!fsSync.existsSync(loc.path)) continue;

      const node = await this.buildTreeNode(loc.path, loc.label, loc.confidence, 0, maxDepth);
      if (node) {
        roots.push(node);
      }
    }

    return roots;
  }

  /**
   * Discovers the top largest files inside the application's directories.
   */
  static async getApplicationLargestFiles(app: InstalledApp, limit = 50): Promise<AppLargestFile[]> {
    const locations = await this.resolveApplicationLocations(app);
    const allFiles: AppLargestFile[] = [];

    for (const loc of locations) {
      const measurement = await this.measureFolder(loc.path, true);
      allFiles.push(...measurement.largestFiles);
    }

    allFiles.sort((a, b) => b.size - a.size);
    return allFiles.slice(0, limit);
  }

  /**
   * Resolves all disk paths associated with an application.
   */
  private static async resolveApplicationLocations(
    app: InstalledApp
  ): Promise<{ label: string; path: string; category: string; confidence: OwnershipConfidence }[]> {
    const locations: { label: string; path: string; category: string; confidence: OwnershipConfidence }[] = [];
    const seenPaths = new Set<string>();

    const addLocation = (label: string, dirPath: string, category: string, confidence: OwnershipConfidence) => {
      try {
        const resolved = path.resolve(dirPath);
        const lower = resolved.toLowerCase();
        if (!seenPaths.has(lower) && fsSync.existsSync(resolved)) {
          seenPaths.add(lower);
          locations.push({ label, path: resolved, category, confidence });
        }
      } catch {}
    };

    // 1. Registered Install Location
    if (app.installLocation && fsSync.existsSync(app.installLocation)) {
      addLocation('Main Installation Folder', app.installLocation, 'main', 'verified');
    }

    // 2. Derive install location from uninstall string or icon path if missing
    if (!app.installLocation) {
      const derived = this.deriveLocationFromExec(app.uninstallString) || this.deriveLocationFromExec(app.iconPath);
      if (derived) {
        addLocation('Main Installation Folder', derived, 'main', 'high_confidence');
      }
    }

    // Normalize app search tokens
    const appTokens = this.generateFolderSearchTokens(app.displayName, app.name, app.publisher);

    const userHome = os.homedir();
    const localAppData = process.env.LOCALAPPDATA || path.join(userHome, 'AppData', 'Local');
    const roamingAppData = process.env.APPDATA || path.join(userHome, 'AppData', 'Roaming');
    const programData = process.env.ALLUSERSPROFILE || 'C:\\ProgramData';
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    // 3. Search AppData Local
    for (const token of appTokens) {
      addLocation('AppData Local', path.join(localAppData, token), 'local', 'high_confidence');
      addLocation('AppData Local (Programs)', path.join(localAppData, 'Programs', token), 'main', 'high_confidence');
      if (app.publisher && app.publisher !== 'Unknown Publisher') {
        addLocation('AppData Local (Vendor)', path.join(localAppData, app.publisher, token), 'local', 'high_confidence');
      }
    }

    // 4. Search AppData Roaming
    for (const token of appTokens) {
      addLocation('AppData Roaming', path.join(roamingAppData, token), 'roaming', 'high_confidence');
      if (app.publisher && app.publisher !== 'Unknown Publisher') {
        addLocation('AppData Roaming (Vendor)', path.join(roamingAppData, app.publisher, token), 'roaming', 'high_confidence');
      }
    }

    // 5. Search ProgramData
    for (const token of appTokens) {
      addLocation('ProgramData', path.join(programData, token), 'programdata', 'high_confidence');
      if (app.publisher && app.publisher !== 'Unknown Publisher') {
        addLocation('ProgramData (Vendor)', path.join(programData, app.publisher, token), 'programdata', 'high_confidence');
      }
    }

    // 6. Search Program Files / Program Files (x86) fallback if not registered
    if (!app.installLocation) {
      for (const token of appTokens) {
        addLocation('Program Files', path.join(programFiles, token), 'main', 'high_confidence');
        addLocation('Program Files (x86)', path.join(programFilesX86, token), 'main', 'high_confidence');
        if (app.publisher && app.publisher !== 'Unknown Publisher') {
          addLocation('Program Files (Vendor)', path.join(programFiles, app.publisher, token), 'main', 'high_confidence');
          addLocation('Program Files (x86) (Vendor)', path.join(programFilesX86, app.publisher, token), 'main', 'high_confidence');
        }
      }
    }

    // 7. Search for specific sub-caches inside the identified folders
    for (const loc of [...locations]) {
      const cacheNames = ['Cache', 'GPUCache', 'Code Cache', 'DawnCache', 'ShaderCache', 'temp', 'CrashDumps', 'Logs'];
      for (const c of cacheNames) {
        const sub = path.join(loc.path, c);
        if (fsSync.existsSync(sub)) {
          addLocation(
            c.toLowerCase().includes('log') ? 'Application Logs' : 'Application Cache',
            sub,
            c.toLowerCase().includes('log') ? 'logs' : 'cache',
            'verified'
          );
        }
      }
    }

    return locations;
  }

  private static generateFolderSearchTokens(displayName: string, name: string, publisher: string): string[] {
    const tokens = new Set<string>();

    const cleanDisplay = displayName.replace(/[^\w\s.-]/g, '').trim();
    if (cleanDisplay) tokens.add(cleanDisplay);

    // E.g. "Visual Studio Code" -> "Code", "Microsoft VS Code"
    const words = cleanDisplay.split(/\s+/);
    if (words.length > 1) {
      tokens.add(words.join(''));
      tokens.add(words.join('-'));
      tokens.add(words.join('_'));
    }

    if (name && name !== displayName) {
      tokens.add(name);
    }

    // Remove version numbers like "1.0.0", "(x64)"
    const withoutVer = cleanDisplay.replace(/\s*(\d+(\.\d+)*|\(x\d+\)|v\d+)/gi, '').trim();
    if (withoutVer && withoutVer !== cleanDisplay) {
      tokens.add(withoutVer);
    }

    return Array.from(tokens).filter((t) => t.length > 2);
  }

  private static deriveLocationFromExec(cmd: string | null | undefined): string | null {
    if (!cmd) return null;
    const match = cmd.match(/(?:[a-zA-Z]:\\[^"<>|?*]+\.(?:exe|ico|dll))/i);
    if (match) {
      const dir = path.dirname(match[0]);
      if (fsSync.existsSync(dir)) return dir;
    }
    return null;
  }

  private static async measureFolder(folderPath: string, collectLargest = false): Promise<MeasureResult> {
    let totalBytes = 0;
    let fileCount = 0;
    let folderCount = 0;
    const largestFiles: AppLargestFile[] = [];
    let isAccessible = true;

    const queue: string[] = [folderPath];

    while (queue.length > 0) {
      const current = queue.shift()!;
      try {
        const entries = await fs.readdir(current, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(current, entry.name);
          try {
            if (entry.isDirectory()) {
              folderCount++;
              queue.push(fullPath);
            } else if (entry.isFile()) {
              const stat = await fs.stat(fullPath);
              totalBytes += stat.size;
              fileCount++;

              if (collectLargest && stat.size > 1024 * 1024) {
                // > 1 MB
                const ext = path.extname(entry.name).toLowerCase();
                let category = 'other';
                if (/exe|dll|sys/.test(ext)) category = 'binary';
                else if (/pak|bundle|bin|dat|db|sqlite/.test(ext)) category = 'data';
                else if (/mp4|webm|png|jpg|mp3/.test(ext)) category = 'media';
                else if (/log|txt/.test(ext)) category = 'log';

                largestFiles.push({
                  path: fullPath,
                  name: entry.name,
                  size: stat.size,
                  formattedSize: formatBytes(stat.size),
                  type: ext || 'file',
                  category,
                  lastModified: stat.mtime.toISOString(),
                });
              }
            }
          } catch {
            // Skip restricted files
          }
        }
      } catch {
        isAccessible = false;
      }
    }

    largestFiles.sort((a, b) => b.size - a.size);

    return {
      totalBytes,
      fileCount,
      folderCount,
      largestFiles: largestFiles.slice(0, 50),
      isAccessible,
    };
  }

  private static async buildTreeNode(
    dirPath: string,
    label: string,
    confidence: OwnershipConfidence,
    currentDepth: number,
    maxDepth: number
  ): Promise<AppFileTreeNode | null> {
    try {
      const stat = await fs.stat(dirPath);
      const isDir = stat.isDirectory();

      const node: AppFileTreeNode = {
        id: dirPath,
        name: currentDepth === 0 ? `${label} (${path.basename(dirPath)})` : path.basename(dirPath),
        path: dirPath,
        size: stat.size,
        formattedSize: formatBytes(stat.size),
        isDirectory: isDir,
        lastModified: stat.mtime.toISOString(),
        confidence,
        isSafeToClean: label.includes('Cache') || label.includes('Logs'),
        isAccessible: true,
        children: [],
      };

      if (isDir && currentDepth < maxDepth) {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        let totalFolderSize = 0;
        let subFiles = 0;
        let subFolders = 0;

        for (const entry of entries.slice(0, 100)) {
          // Limit items per folder for fast UI response
          const subPath = path.join(dirPath, entry.name);
          const childNode = await this.buildTreeNode(subPath, entry.name, confidence, currentDepth + 1, maxDepth);
          if (childNode) {
            node.children?.push(childNode);
            totalFolderSize += childNode.size;
            if (childNode.isDirectory) subFolders++;
            else subFiles++;
          }
        }

        node.size = totalFolderSize;
        node.formattedSize = formatBytes(totalFolderSize);
        node.fileCount = subFiles;
        node.folderCount = subFolders;
        node.children?.sort((a, b) => b.size - a.size);
      }

      return node;
    } catch {
      return null;
    }
  }

  /**
   * Compares two installed applications side-by-side with net storage delta metrics.
   */
  static async compareApplications(appA: InstalledApp, appB: InstalledApp): Promise<AppComparisonResult> {
    const [footprintA, footprintB] = await Promise.all([
      this.measureApplicationFootprint(appA),
      this.measureApplicationFootprint(appB),
    ]);

    const deltaBytes = footprintA.totalMeasuredFootprint - footprintB.totalMeasuredFootprint;
    const formattedDeltaBytes = (deltaBytes >= 0 ? '+' : '-') + formatBytes(Math.abs(deltaBytes));
    const baseline = Math.min(footprintA.totalMeasuredFootprint, footprintB.totalMeasuredFootprint);
    const percentageDiff = baseline > 0 ? Math.round((Math.abs(deltaBytes) / baseline) * 1000) / 10 : 0;
    const filesDelta = footprintA.totalFiles - footprintB.totalFiles;
    const foldersDelta = footprintA.totalFolders - footprintB.totalFolders;

    const summary =
      deltaBytes > 0
        ? `'${appA.displayName}' consumes ${formatBytes(deltaBytes)} more disk space (+${percentageDiff}%) than '${appB.displayName}'.`
        : deltaBytes < 0
        ? `'${appB.displayName}' consumes ${formatBytes(Math.abs(deltaBytes))} more disk space than '${appA.displayName}'.`
        : `'${appA.displayName}' and '${appB.displayName}' have identical measured storage footprints.`;

    return {
      appA: { app: appA, footprint: footprintA },
      appB: { app: appB, footprint: footprintB },
      deltaBytes,
      formattedDeltaBytes,
      percentageDiff,
      filesDelta,
      foldersDelta,
      summary,
    };
  }
}
