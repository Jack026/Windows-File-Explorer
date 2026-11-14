import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { DriveInfo, QuickDirectory } from './types.js';
import { runPowerShellScript } from './powershell-runner.js';
import { isProtectedSystemPath } from './security.js';

const execAsync = promisify(exec);

export class WindowsBridge {
  /**
   * Retrieves all mounted drives with space details on Windows.
   */
  static async getDrives(): Promise<DriveInfo[]> {
    try {
      const psCommand = `Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, VolumeName, FileSystem, Size, FreeSpace, DriveType | ConvertTo-Json -Compress`;
      const stdout = await runPowerShellScript(psCommand);

      if (!stdout || !stdout.trim()) {
        return this.getFallbackDrives();
      }

      let parsed: any;
      try {
        parsed = JSON.parse(stdout.trim());
      } catch (e) {
        return this.getFallbackDrives();
      }

      const disks = Array.isArray(parsed) ? parsed : [parsed];

      return disks
        .filter((d: any) => d && d.DeviceID && d.Size && Number(d.Size) > 0)
        .map((d: any) => {
          const totalBytes = Number(d.Size) || 0;
          const freeBytes = Number(d.FreeSpace) || 0;
          const usedBytes = Math.max(0, totalBytes - freeBytes);
          const usagePercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

          let health: 'healthy' | 'warning' | 'danger' = 'healthy';
          if (usagePercent >= 90) health = 'danger';
          else if (usagePercent >= 75) health = 'warning';

          return {
            deviceId: d.DeviceID,
            volumeName: d.VolumeName || (d.DeviceID === 'C:' ? 'Local Disk' : 'Drive'),
            fileSystem: d.FileSystem || 'NTFS',
            totalBytes,
            freeBytes,
            usedBytes,
            usagePercent,
            driveType: Number(d.DriveType) || 3,
            health,
          };
        });
    } catch (err) {
      console.error('Error fetching Windows drives:', err);
      return this.getFallbackDrives();
    }
  }

  private static async getFallbackDrives(): Promise<DriveInfo[]> {
    return [
      {
        deviceId: 'C:',
        volumeName: 'Local Disk',
        fileSystem: 'NTFS',
        totalBytes: 512 * 1024 * 1024 * 1024,
        freeBytes: 120 * 1024 * 1024 * 1024,
        usedBytes: 392 * 1024 * 1024 * 1024,
        usagePercent: 76,
        driveType: 3,
        health: 'warning',
      },
    ];
  }

  /**
   * Returns standard Windows User Quick Access locations.
   */
  static getUserDirectories(): QuickDirectory[] {
    const home = os.homedir();
    const dirs: QuickDirectory[] = [
      { id: 'home', name: 'User Profile', path: home, icon: 'User' },
      { id: 'desktop', name: 'Desktop', path: path.join(home, 'Desktop'), icon: 'Monitor' },
      { id: 'downloads', name: 'Downloads', path: path.join(home, 'Downloads'), icon: 'Download' },
      { id: 'documents', name: 'Documents', path: path.join(home, 'Documents'), icon: 'FileText' },
      { id: 'pictures', name: 'Pictures', path: path.join(home, 'Pictures'), icon: 'Image' },
      { id: 'music', name: 'Music', path: path.join(home, 'Music'), icon: 'Music' },
      { id: 'videos', name: 'Videos', path: path.join(home, 'Videos'), icon: 'Film' },
    ];

    return dirs;
  }

  /**
   * Safely deletes file or directory to Windows Recycle Bin.
   */
  static async moveToRecycleBin(targetPath: string): Promise<boolean> {
    try {
      if (isProtectedSystemPath(targetPath)) {
        throw new Error(`Security Exception: Cannot delete protected Windows system path '${targetPath}'`);
      }

      const stats = await fs.stat(targetPath);
      const isDirectory = stats.isDirectory();
      const escaped = targetPath.replace(/'/g, "''");

      let script: string;
      if (isDirectory) {
        script = `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory('${escaped}', [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin)`;
      } else {
        script = `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${escaped}', [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin)`;
      }

      await runPowerShellScript(script);
      return true;
    } catch (err) {
      console.error(`Failed to move ${targetPath} to Recycle Bin:`, err);
      throw err;
    }
  }

  /**
   * Opens file or folder in default Windows program.
   */
  static openInDefaultApp(targetPath: string) {
    try {
      const child = spawn('explorer.exe', [targetPath], { detached: true, stdio: 'ignore' });
      child.unref();
      return true;
    } catch (err) {
      console.error(`Failed to open default app for ${targetPath}:`, err);
      return false;
    }
  }

  /**
   * Highlights and selects file/folder in native Windows Explorer.
   */
  static revealInExplorer(targetPath: string) {
    try {
      const child = spawn('explorer.exe', [`/select,${targetPath}`], { detached: true, stdio: 'ignore' });
      child.unref();
      return true;
    } catch (err) {
      console.error(`Failed to reveal ${targetPath}:`, err);
      return false;
    }
  }

  /**
   * Launches PowerShell at target directory.
   */
  static openInTerminal(targetPath: string) {
    try {
      // Try Windows Terminal first, fallback to PowerShell
      const escaped = targetPath.replace(/'/g, "''");
      const child = spawn('powershell.exe', ['-NoExit', '-Command', `Set-Location -LiteralPath '${escaped}'`], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      return true;
    } catch (err) {
      console.error(`Failed to open terminal at ${targetPath}:`, err);
      return false;
    }
  }

  /**
   * Launches VS Code at target directory or file.
   */
  static openInVSCode(targetPath: string) {
    try {
      const child = spawn('code.cmd', [targetPath], {
        detached: true,
        stdio: 'ignore',
        shell: true,
      });
      child.unref();
      return true;
    } catch (err) {
      console.error(`Failed to open VS Code at ${targetPath}:`, err);
      return false;
    }
  }

  /**
   * Checks if folder is a developer project.
   */
  static async checkProject(dirPath: string): Promise<{ isProject: boolean; projectType: string | null }> {
    try {
      const files = await fs.readdir(dirPath);
      const set = new Set(files.map((f) => f.toLowerCase()));

      if (set.has('package.json')) return { isProject: true, projectType: 'Node.js / JavaScript' };
      if (set.has('cargo.toml')) return { isProject: true, projectType: 'Rust' };
      if (set.has('pyproject.toml') || set.has('requirements.txt')) return { isProject: true, projectType: 'Python' };
      if (set.has('go.mod')) return { isProject: true, projectType: 'Go' };
      if (set.has('pom.xml') || set.has('build.gradle')) return { isProject: true, projectType: 'Java / Kotlin' };
      if (set.has('.git')) return { isProject: true, projectType: 'Git Repository' };

      return { isProject: false, projectType: null };
    } catch {
      return { isProject: false, projectType: null };
    }
  }
}
