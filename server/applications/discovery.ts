import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { InstalledApp, AppCategory, AppInstallType } from './types.js';
import { runPowerShellScript } from '../powershell-runner.js';

const execAsync = promisify(exec);

// Cache discovered apps in-memory for fast browsing with background refresh
let cachedApps: InstalledApp[] = [];
let lastDiscoveryTime = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

export class AppDiscovery {
  /**
   * Retrieves all installed applications with deduplication, running process matching, and categorization.
   */
  static async getInstalledApplications(forceRefresh = false): Promise<InstalledApp[]> {
    if (!forceRefresh && cachedApps.length > 0 && Date.now() - lastDiscoveryTime < CACHE_TTL_MS) {
      return cachedApps;
    }

    try {
      const [registryApps, appxApps, runningProcesses] = await Promise.all([
        this.queryRegistryApps(),
        this.queryAppxPackages(),
        this.queryRunningProcesses(),
      ]);

      const allApps = [...registryApps, ...appxApps];

      // Match running processes to applications
      for (const app of allApps) {
        const matchingPids: number[] = [];
        for (const proc of runningProcesses) {
          if (proc.path && app.installLocation) {
            const normProc = proc.path.toLowerCase().replace(/\\/g, '/');
            const normInstall = app.installLocation.toLowerCase().replace(/\\/g, '/');
            if (normProc.startsWith(normInstall) || normInstall.startsWith(normProc)) {
              matchingPids.push(proc.id);
            }
          } else if (proc.name && app.displayName) {
            const normName = proc.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const normApp = app.displayName.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normName.length > 3 && normApp.includes(normName)) {
              matchingPids.push(proc.id);
            }
          }
        }
        if (matchingPids.length > 0) {
          app.isRunning = true;
          app.processIds = Array.from(new Set(matchingPids));
        }
      }

      // Deduplicate applications by DisplayName / InstallLocation
      const deduplicated = this.deduplicateApps(allApps);

      // Sort by Name alphabetically
      deduplicated.sort((a, b) => a.displayName.localeCompare(b.displayName));

      cachedApps = deduplicated;
      lastDiscoveryTime = Date.now();
      return deduplicated;
    } catch (err) {
      console.error('Failed to discover applications:', err);
      return cachedApps.length > 0 ? cachedApps : [];
    }
  }

  private static async queryRegistryApps(): Promise<InstalledApp[]> {
    // PowerShell script to query 64-bit, 32-bit (Wow6432Node), and CurrentUser uninstall keys
    const psScript = `
$regKeys = @(
  @{ Path = 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'; Type = 'registry_x64' },
  @{ Path = 'HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'; Type = 'registry_x86' },
  @{ Path = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'; Type = 'registry_user' }
)

$results = [System.Collections.Generic.List[PSObject]]::new()

foreach ($key in $regKeys) {
  try {
    $items = Get-ItemProperty -Path $key.Path -ErrorAction SilentlyContinue
    foreach ($item in $items) {
      if ($item.DisplayName -and -not $item.ParentKeyName -and $item.SystemComponent -ne 1) {
        $results.Add([PSCustomObject]@{
          DisplayName          = $item.DisplayName
          DisplayVersion      = $item.DisplayVersion
          Publisher            = $item.Publisher
          InstallDate          = $item.InstallDate
          InstallLocation      = $item.InstallLocation
          UninstallString      = $item.UninstallString
          QuietUninstallString = $item.QuietUninstallString
          DisplayIcon          = $item.DisplayIcon
          EstimatedSize        = $item.EstimatedSize
          WindowsInstaller     = $item.WindowsInstaller
          Type                 = $key.Type
        })
      }
    }
  } catch {}
}

$results | ConvertTo-Json -Compress -Depth 2
`;

    try {
      const stdout = await runPowerShellScript(psScript);

      if (!stdout || !stdout.trim()) return [];
      const raw = JSON.parse(stdout);
      const list = Array.isArray(raw) ? raw : [raw];

      return list.map((item, idx) => {
        const displayName = (item.DisplayName || '').trim();
        const publisher = (item.Publisher || 'Unknown Publisher').trim();
        const version = (item.DisplayVersion || '').trim();
        const installLocation = item.InstallLocation ? item.InstallLocation.replace(/["']/g, '').trim() : null;
        const iconRaw = item.DisplayIcon ? item.DisplayIcon.split(',')[0].replace(/["']/g, '').trim() : null;
        const estimatedSizeKB = typeof item.EstimatedSize === 'number' ? item.EstimatedSize : null;

        let iconPath: string | null = null;
        if (iconRaw && fs.existsSync(iconRaw)) {
          iconPath = iconRaw;
        }

        const category = this.categorizeApp(displayName, publisher, installLocation);
        let installType: AppInstallType = item.Type || 'registry_x64';
        if (item.WindowsInstaller === 1 || (item.UninstallString && /msiexec/i.test(item.UninstallString))) {
          installType = 'msi';
        }

        return {
          id: `reg_${this.sanitizeId(displayName)}_${idx}`,
          name: displayName,
          displayName,
          publisher,
          version: version || '1.0.0',
          installDate: item.InstallDate ? String(item.InstallDate) : null,
          installLocation: installLocation && fs.existsSync(installLocation) ? installLocation : null,
          installType,
          category,
          uninstallString: item.UninstallString || null,
          quietUninstallString: item.QuietUninstallString || null,
          iconPath,
          estimatedSize: estimatedSizeKB ? estimatedSizeKB * 1024 : null,
          measuredSize: null,
          formattedMeasuredSize: null,
          isRunning: false,
          processIds: [],
          hasLeftovers: false,
          hasUninstall: !!item.UninstallString || !!item.QuietUninstallString,
        };
      });
    } catch (err) {
      console.error('Error reading registry apps:', err);
      return [];
    }
  }

  private static async queryAppxPackages(): Promise<InstalledApp[]> {
    const psScript = `
try {
  Get-AppxPackage | Where-Object { -not $_.IsFramework -and $_.NonRemovable -ne $true } |
    Select-Object Name, PackageFullName, PackageFamilyName, Version, Publisher, InstallLocation |
    ConvertTo-Json -Compress -Depth 2
} catch {
  Write-Output '[]'
}
`;

    try {
      const stdout = await runPowerShellScript(psScript);

      if (!stdout || !stdout.trim()) return [];
      const raw = JSON.parse(stdout);
      const list = Array.isArray(raw) ? raw : [raw];

      return list
        .filter((item) => item.Name && !item.Name.startsWith('Microsoft.VCLibs') && !item.Name.startsWith('Microsoft.UI.Xaml'))
        .map((item, idx) => {
          const rawName = item.Name || '';
          const cleanName = rawName.split('.').pop() || rawName;
          const publisher = (item.Publisher || 'Microsoft Corporation')
            .replace(/CN=|O=|,.*$/g, '')
            .trim();
          const installLocation = item.InstallLocation || null;

          return {
            id: `appx_${this.sanitizeId(item.PackageFullName || rawName)}_${idx}`,
            name: rawName,
            displayName: cleanName.replace(/([A-Z])/g, ' $1').trim(),
            publisher: publisher || 'Microsoft Store',
            version: item.Version || '1.0.0',
            installDate: null,
            installLocation,
            installType: 'msix_appx' as AppInstallType,
            category: 'store' as AppCategory,
            uninstallString: `Remove-AppxPackage -Package "${item.PackageFullName}"`,
            quietUninstallString: `Remove-AppxPackage -Package "${item.PackageFullName}"`,
            iconPath: null,
            estimatedSize: null,
            measuredSize: null,
            formattedMeasuredSize: null,
            isRunning: false,
            processIds: [],
            hasLeftovers: false,
            hasUninstall: true,
            packageFamilyName: item.PackageFamilyName,
          };
        });
    } catch {
      return [];
    }
  }

  private static async queryRunningProcesses(): Promise<{ id: number; name: string; path: string | null }[]> {
    const psScript = `
Get-Process | Where-Object { $_.Path } | Select-Object Id, ProcessName, Path | ConvertTo-Json -Compress
`;
    try {
      const stdout = await runPowerShellScript(psScript);
      if (!stdout || !stdout.trim()) return [];
      const raw = JSON.parse(stdout);
      const list = Array.isArray(raw) ? raw : [raw];
      return list.map((p) => ({
        id: p.Id,
        name: p.ProcessName,
        path: p.Path || null,
      }));
    } catch {
      return [];
    }
  }

  private static deduplicateApps(apps: InstalledApp[]): InstalledApp[] {
    const map = new Map<string, InstalledApp>();

    for (const app of apps) {
      const normKey = app.displayName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const existing = map.get(normKey);

      if (!existing) {
        map.set(normKey, app);
      } else {
        // Merge attributes to keep the most complete metadata
        if (!existing.installLocation && app.installLocation) existing.installLocation = app.installLocation;
        if (!existing.iconPath && app.iconPath) existing.iconPath = app.iconPath;
        if (!existing.uninstallString && app.uninstallString) existing.uninstallString = app.uninstallString;
        if (!existing.quietUninstallString && app.quietUninstallString) existing.quietUninstallString = app.quietUninstallString;
        if (!existing.estimatedSize && app.estimatedSize) existing.estimatedSize = app.estimatedSize;
        if (app.isRunning) {
          existing.isRunning = true;
          existing.processIds = Array.from(new Set([...existing.processIds, ...app.processIds]));
        }
      }
    }

    return Array.from(map.values());
  }

  private static categorizeApp(name: string, publisher: string, installLocation: string | null): AppCategory {
    const text = `${name} ${publisher} ${installLocation || ''}`.toLowerCase();

    if (/browser|chrome|firefox|brave|opera|vivaldi|edge|tor|safari/.test(text)) return 'browsers';
    if (/visual studio|vscode|code|git|python|node|npm|android studio|rust|docker|postman|intellij|sublime|compiler|sdk|jdk|gradle|maven|wsl|terminal|powershell/.test(text)) return 'development';
    if (/game|steam|epic games|riot|minecraft|unity|unreal|roblox|battle\.net|ea games|ubisoft|gog|origin|geforce/.test(text)) return 'games';
    if (/photoshop|blender|figma|illustrator|gimp|canva|premiere|davinci|after effects|autocad|corel|paint|inkscape/.test(text)) return 'graphics';
    if (/spotify|vlc|obs|discord|itunes|audacity|netflix|media player|music|sound|voice|podcast|codec|quicktime/.test(text)) return 'multimedia';
    if (/office|word|excel|powerpoint|libreoffice|notion|slack|teams|zoom|obsidian|notes|evernote|adobe reader|acrobat|pdf/.test(text)) return 'productivity';
    if (/7-zip|winrar|powertoys|rufus|everything|hwmonitor|ccleaner|driver|antivirus|malware|defender|zip|uninstaller|cleaner|backup/.test(text)) return 'utilities';
    if (/microsoft visual c\+\+|redistributable|\.net|directx|framework|windows sdk|runtime/.test(text)) return 'system';

    return 'other';
  }

  private static sanitizeId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 32);
  }

  /**
   * Spawns/launches the application via its primary executable or Windows Shell protocol.
   */
  static async launchApp(app: InstalledApp): Promise<{ success: boolean; message: string }> {
    // 1. AppX / MSIX package launch
    if (app.installType === 'msix_appx' && app.packageFamilyName) {
      try {
        await execAsync(
          `powershell -NoProfile -Command "Start-Process explorer.exe 'shell:AppsFolder\\${app.packageFamilyName}!App'"`
        );
        return { success: true, message: `Launched Windows Store App: ${app.displayName}` };
      } catch (err: any) {
        return { success: false, message: `Failed to launch AppX package: ${err.message}` };
      }
    }

    // 2. Discover primary executable path
    let exePath: string | null = null;
    if (app.iconPath && app.iconPath.toLowerCase().endsWith('.exe') && fs.existsSync(app.iconPath)) {
      exePath = app.iconPath;
    } else if (app.installLocation && fs.existsSync(app.installLocation)) {
      try {
        const files = await fs.promises.readdir(app.installLocation);
        const exes = files.filter((f) => f.toLowerCase().endsWith('.exe') && !f.toLowerCase().includes('unins'));
        if (exes.length > 0) {
          const match = exes.find((e) => e.toLowerCase().includes(app.name.toLowerCase().slice(0, 4))) || exes[0];
          exePath = path.join(app.installLocation, match);
        }
      } catch {}
    }

    if (exePath && fs.existsSync(exePath)) {
      try {
        const child = spawn(exePath, [], { detached: true, stdio: 'ignore' });
        child.unref();
        return { success: true, message: `Launched '${path.basename(exePath)}'` };
      } catch (err: any) {
        return { success: false, message: `Failed to execute: ${err.message}` };
      }
    }

    return { success: false, message: `No launchable binary identified for '${app.displayName}'` };
  }

  /**
   * Opens the application's root install directory in Windows File Explorer.
   */
  static async openLocation(app: InstalledApp): Promise<{ success: boolean; path: string }> {
    const targetPath =
      app.installLocation && fs.existsSync(app.installLocation)
        ? app.installLocation
        : app.iconPath && fs.existsSync(path.dirname(app.iconPath))
        ? path.dirname(app.iconPath)
        : null;

    if (targetPath && fs.existsSync(targetPath)) {
      try {
        await execAsync(`explorer.exe "${targetPath}"`);
        return { success: true, path: targetPath };
      } catch {
        return { success: false, path: targetPath };
      }
    }
    throw new Error(`Installation directory for '${app.displayName}' is not accessible on disk.`);
  }

  /**
   * Generates downloadable inventory format (CSV or JSON) for all installed applications.
   */
  static exportApps(apps: InstalledApp[], format: 'csv' | 'json'): string {
    if (format === 'json') {
      return JSON.stringify(apps, null, 2);
    }

    const headers = [
      'DisplayName',
      'Publisher',
      'Version',
      'InstallDate',
      'InstallLocation',
      'Category',
      'InstallType',
      'EstimatedSizeBytes',
      'MeasuredSizeBytes',
      'IsRunning',
      'HasUninstall',
    ];

    const rows = apps.map((a) =>
      [
        `"${(a.displayName || '').replace(/"/g, '""')}"`,
        `"${(a.publisher || '').replace(/"/g, '""')}"`,
        `"${(a.version || '').replace(/"/g, '""')}"`,
        `"${(a.installDate || '').replace(/"/g, '""')}"`,
        `"${(a.installLocation || '').replace(/"/g, '""')}"`,
        `"${a.category || ''}"`,
        `"${a.installType || ''}"`,
        a.estimatedSize || 0,
        a.measuredSize || 0,
        a.isRunning ? 'true' : 'false',
        a.hasUninstall ? 'true' : 'false',
      ].join(',')
    );

    return [headers.join(','), ...rows].join('\r\n');
  }
}
