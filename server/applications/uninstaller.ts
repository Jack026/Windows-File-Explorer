import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import {
  InstalledApp,
  AppStorageBreakdown,
  UninstallPlan,
  LeftoverCandidate,
  LeftoverCategory,
  OwnershipConfidence,
  UninstallVerificationReport,
} from './types.js';
import { formatBytes } from '../scanner.js';
import { AppFootprintAnalyzer } from './footprint.js';
import { WindowsBridge } from '../windows-bridge.js';

const execAsync = promisify(exec);

export class AppUninstaller {
  /**
   * Builds a complete Deep Uninstall pre-removal plan with categorized items.
   */
  static async prepareUninstallPlan(app: InstalledApp): Promise<UninstallPlan> {
    const footprint = await AppFootprintAnalyzer.measureApplicationFootprint(app);

    const candidates: LeftoverCandidate[] = [];

    // Analyze each discovered location and categorize
    for (const loc of footprint.locations) {
      if (!fsSync.existsSync(loc.path)) continue;

      const { category, categoryLabel, isProtected, reason } = this.categorizePathForCleanup(
        loc.path,
        loc.category,
        loc.label
      );

      candidates.push({
        id: `cand_${Buffer.from(loc.path).toString('base64').slice(0, 16)}`,
        path: loc.path,
        name: path.basename(loc.path) || loc.label,
        size: loc.size,
        formattedSize: loc.formattedSize,
        type: 'folder',
        category,
        categoryLabel,
        confidence: loc.confidence,
        selected: !isProtected, // User data and shared components unselected by default
        reason,
        isProtected,
      });
    }

    // Discover associated Windows services & startup tasks
    const [services, tasks] = await Promise.all([
      this.findAssociatedServices(app),
      this.findAssociatedScheduledTasks(app),
    ]);

    return {
      app,
      preUninstallBreakdown: footprint,
      officialUninstallCmd: app.quietUninstallString || app.uninstallString,
      leftoverCandidates: candidates,
      associatedServices: services,
      associatedTasks: tasks,
    };
  }

  /**
   * Executes the official registered uninstaller for the application.
   */
  static async executeOfficialUninstall(
    app: InstalledApp,
    useQuiet = false
  ): Promise<{ success: boolean; message: string }> {
    // 1. Terminate running processes if any
    if (app.isRunning && app.processIds.length > 0) {
      for (const pid of app.processIds) {
        try {
          process.kill(pid);
        } catch {}
      }
    }

    // 2. Handle AppX / MSIX Packages
    if (app.installType === 'msix_appx') {
      try {
        const cmd = `powershell -NoProfile -Command "Get-AppxPackage -Name '${app.name}' | Remove-AppxPackage"`;
        await execAsync(cmd);
        return { success: true, message: 'AppX/MSIX Package uninstalled via Windows App Management' };
      } catch (err: any) {
        return { success: false, message: `Failed to remove AppX package: ${err.message}` };
      }
    }

    // 3. Handle Traditional Registry Win32 / MSI Uninstaller
    const uninstallCmd = useQuiet && app.quietUninstallString ? app.quietUninstallString : app.uninstallString;

    if (!uninstallCmd) {
      return {
        success: false,
        message: 'No registered official uninstall command found for this application.',
      };
    }

    try {
      // Execute uninstaller
      if (uninstallCmd.toLowerCase().includes('msiexec')) {
        // Run msiexec
        const quietFlag = useQuiet ? ' /qn' : ' /qr';
        const finalCmd = uninstallCmd.includes('/i')
          ? uninstallCmd.replace(/\/i/gi, '/x') + quietFlag
          : `${uninstallCmd}${quietFlag}`;
        await execAsync(finalCmd);
      } else {
        await execAsync(uninstallCmd, { timeout: 300_000 }); // 5 min timeout
      }

      return { success: true, message: 'Official uninstaller executed successfully.' };
    } catch (err: any) {
      return { success: false, message: `Uninstaller reported: ${err.message}` };
    }
  }

  /**
   * Performs post-uninstall leftover discovery to find remaining files & folders.
   */
  static async scanForLeftovers(app: InstalledApp, preLocations: string[]): Promise<LeftoverCandidate[]> {
    const remaining: LeftoverCandidate[] = [];

    // Re-check all previously identified directories
    for (const locPath of preLocations) {
      if (fsSync.existsSync(locPath)) {
        try {
          const stat = await fs.stat(locPath);
          const size = stat.isDirectory() ? await this.getFolderSize(locPath) : stat.size;
          if (size > 0) {
            const { category, categoryLabel, isProtected, reason } = this.categorizePathForCleanup(
              locPath,
              'leftover',
              path.basename(locPath)
            );

            remaining.push({
              id: `left_${Buffer.from(locPath).toString('base64').slice(0, 16)}`,
              path: locPath,
              name: path.basename(locPath),
              size,
              formattedSize: formatBytes(size),
              type: stat.isDirectory() ? 'folder' : 'file',
              category,
              categoryLabel,
              confidence: 'high_confidence',
              selected: !isProtected,
              reason,
              isProtected,
            });
          }
        } catch {}
      }
    }

    // Check application-specific registry keys
    const regLeftovers = await this.checkRegistryLeftovers(app.displayName, app.publisher);
    remaining.push(...regLeftovers);

    return remaining;
  }

  /**
   * Safely deletes user-approved leftovers by moving them to the Windows Recycle Bin.
   */
  static async cleanApprovedLeftovers(
    candidates: LeftoverCandidate[]
  ): Promise<UninstallVerificationReport> {
    let reclaimedBytes = 0;
    let removedFilesCount = 0;
    let retainedSharedCount = 0;
    const inaccessibleLocations: string[] = [];
    let registryKeysCleaned = 0;

    for (const item of candidates) {
      if (!item.selected) {
        if (item.category === 'shared_components' || item.category === 'user_data') {
          retainedSharedCount++;
        }
        continue;
      }

      if (item.type === 'registry_key') {
        try {
          // Backup registry key before removing as specified by Windows Safety Policy
          const backupDir = path.join(os.homedir(), '.smart-explorer', 'registry-backups');
          if (!fsSync.existsSync(backupDir)) {
            await fs.mkdir(backupDir, { recursive: true });
          }
          const safeName = item.path.replace(/[^a-zA-Z0-9]/g, '_').slice(-40);
          const backupFile = path.join(backupDir, `reg_backup_${Date.now()}_${safeName}.reg`);
          const regWinPath = item.path.replace('HKCU:\\', 'HKCU\\').replace('HKLM:\\', 'HKLM\\');
          try {
            await execAsync(`reg export "${regWinPath}" "${backupFile}" /y`);
          } catch {}

          await execAsync(`powershell -NoProfile -Command "Remove-Item -Path '${item.path}' -Recurse -Force"`);
          registryKeysCleaned++;
        } catch {
          inaccessibleLocations.push(item.path);
        }
      } else {
        // Move file or folder safely to Windows Recycle Bin
        try {
          if (fsSync.existsSync(item.path)) {
            await WindowsBridge.moveToRecycleBin(item.path);
            reclaimedBytes += item.size;
            removedFilesCount++;
          }
        } catch (err) {
          inaccessibleLocations.push(item.path);
        }
      }
    }

    const summary = `Deep uninstall completed. ${formatBytes(reclaimedBytes)} reclaimed across ${removedFilesCount} items. ${retainedSharedCount} protected items retained.${
      inaccessibleLocations.length > 0 ? ` ${inaccessibleLocations.length} locations were locked or inaccessible.` : ''
    }`;

    return {
      appName: candidates[0]?.name || 'Application',
      originalFootprint: reclaimedBytes,
      formattedOriginalFootprint: formatBytes(reclaimedBytes),
      reclaimedBytes,
      formattedReclaimedBytes: formatBytes(reclaimedBytes),
      removedFilesCount,
      retainedSharedCount,
      inaccessibleLocations,
      registryKeysCleaned,
      completedAt: new Date().toISOString(),
      summary,
    };
  }

  private static categorizePathForCleanup(
    itemPath: string,
    categoryHint: string,
    label: string
  ): { category: LeftoverCategory; categoryLabel: string; isProtected: boolean; reason: string } {
    const lower = itemPath.toLowerCase();

    // 1. Shared Components Protection
    if (
      /system32|syswow64|winsxs|microsoft shared|common files|directx|\.net|vcredist|driver/i.test(lower)
    ) {
      return {
        category: 'shared_components',
        categoryLabel: 'Category E: Shared Components',
        isProtected: true,
        reason: 'Shared system runtime or common library used by other applications. Protected from deletion.',
      };
    }

    // 2. User Data Protection
    if (/documents|saved games|projects|workspace|backups|profiles|database/i.test(lower)) {
      return {
        category: 'user_data',
        categoryLabel: 'Category D: User Data & Documents',
        isProtected: true,
        reason: 'Personal documents, saved projects, or custom profiles. Kept by default.',
      };
    }

    // 3. Application Cache
    if (/cache|gpucache|code cache|dawncache|temp|shadercache|crashdumps/i.test(lower)) {
      return {
        category: 'cache',
        categoryLabel: 'Category B: Application Cache',
        isProtected: false,
        reason: 'Temporary and regenerable cache data. Safe to clean.',
      };
    }

    // 4. Application Settings
    if (/settings|config|preferences|user\.config|session/i.test(lower)) {
      return {
        category: 'settings',
        categoryLabel: 'Category C: Application Settings',
        isProtected: false,
        reason: 'User preferences and configuration files for this application.',
      };
    }

    // 5. Verified Application Files
    if (categoryHint === 'main' || /program files|appdata\\local\\programs/i.test(lower)) {
      return {
        category: 'verified_files',
        categoryLabel: 'Category A: Verified Application Files',
        isProtected: false,
        reason: 'Direct application installation and binary files.',
      };
    }

    // 6. Uncertain
    return {
      category: 'uncertain',
      categoryLabel: 'Category F: Uncertain Ownership',
      isProtected: true,
      reason: 'Ownership relationship is uncertain. Retained by default.',
    };
  }

  private static async findAssociatedServices(app: InstalledApp): Promise<string[]> {
    try {
      const psScript = `
Get-CimInstance Win32_Service | Where-Object { $_.PathName -and $_.PathName.ToLower().Contains("${app.displayName.toLowerCase().replace(/['"]/g, '')}") } | Select-Object -ExpandProperty Name
`;
      const { stdout } = await execAsync(
        `powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '`"')}"`
      );
      if (!stdout || !stdout.trim()) return [];
      return stdout
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  private static async findAssociatedScheduledTasks(app: InstalledApp): Promise<string[]> {
    try {
      const psScript = `
Get-ScheduledTask | Where-Object { $_.TaskName.ToLower().Contains("${app.displayName.toLowerCase().replace(/['"]/g, '')}") } | Select-Object -ExpandProperty TaskName
`;
      const { stdout } = await execAsync(
        `powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '`"')}"`
      );
      if (!stdout || !stdout.trim()) return [];
      return stdout
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  private static async checkRegistryLeftovers(
    displayName: string,
    publisher: string
  ): Promise<LeftoverCandidate[]> {
    const list: LeftoverCandidate[] = [];
    const cleanName = displayName.replace(/[^\w]/g, '');
    if (cleanName.length < 3) return list;

    const keysToCheck = [
      `HKCU:\\Software\\${cleanName}`,
      `HKLM:\\Software\\${cleanName}`,
      `HKLM:\\Software\\WOW6432Node\\${cleanName}`,
    ];

    if (publisher && publisher !== 'Unknown Publisher') {
      const cleanPub = publisher.replace(/[^\w]/g, '');
      if (cleanPub.length > 2) {
        keysToCheck.push(`HKCU:\\Software\\${cleanPub}\\${cleanName}`);
        keysToCheck.push(`HKLM:\\Software\\${cleanPub}\\${cleanName}`);
      }
    }

    for (const key of keysToCheck) {
      try {
        const { stdout } = await execAsync(
          `powershell -NoProfile -Command "if (Test-Path '${key}') { Write-Output 'EXISTS' }"`
        );
        if (stdout.includes('EXISTS')) {
          list.push({
            id: `reg_${Buffer.from(key).toString('base64').slice(0, 16)}`,
            path: key,
            name: `${cleanName} Registry Configuration`,
            size: 1024,
            formattedSize: '1 KB',
            type: 'registry_key',
            category: 'settings',
            categoryLabel: 'Category C: Application Settings',
            confidence: 'verified',
            selected: true,
            reason: 'Application-specific registry configuration key.',
            isProtected: false,
          });
        }
      } catch {}
    }

    return list;
  }

  private static async getFolderSize(dirPath: string): Promise<number> {
    let total = 0;
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(dirPath, e.name);
        try {
          if (e.isDirectory()) total += await this.getFolderSize(p);
          else if (e.isFile()) {
            const st = await fs.stat(p);
            total += st.size;
          }
        } catch {}
      }
    } catch {}
    return total;
  }
}
