import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { runPowerShellScript } from './powershell-runner.js';

export interface AccessRule {
  identity: string;
  accessControlType: 'Allow' | 'Deny';
  fileSystemRights: string;
  isInherited: boolean;
  inheritanceFlags: string;
  propagationFlags: string;
}

export interface PermissionReport {
  path: string;
  name: string;
  isDirectory: boolean;
  owner: string;
  group: string;
  areAccessRulesProtected: boolean;
  accessRules: AccessRule[];
  canRead: boolean;
  canWrite: boolean;
  canExecute: boolean;
  isReadOnly: boolean;
  isSystem: boolean;
  summary: string;
}

export class PermissionsEngine {
  static async getPermissions(targetPath: string): Promise<PermissionReport> {
    const resolvedPath = path.resolve(targetPath);
    if (!fsSync.existsSync(resolvedPath)) {
      throw new Error(`Path does not exist: ${resolvedPath}`);
    }

    const stat = await fs.stat(resolvedPath);
    const isDirectory = stat.isDirectory();
    const name = path.basename(resolvedPath) || resolvedPath;

    // Test practical accessibility
    let canRead = false;
    let canWrite = false;
    let canExecute = false;

    try {
      await fs.access(resolvedPath, fsSync.constants.R_OK);
      canRead = true;
    } catch {}

    try {
      await fs.access(resolvedPath, fsSync.constants.W_OK);
      canWrite = true;
    } catch {}

    try {
      await fs.access(resolvedPath, fsSync.constants.X_OK);
      canExecute = true;
    } catch {}

    // Run native Windows PowerShell Get-Acl
    const escaped = resolvedPath.replace(/'/g, "''");
    const psScript = `
$acl = Get-Acl -LiteralPath '${escaped}' -ErrorAction SilentlyContinue
if (-not $acl) {
  Write-Output "{}"
  exit
}

$rules = [System.Collections.Generic.List[PSObject]]::new()
foreach ($acc in $acl.Access) {
  $rules.Add([PSCustomObject]@{
    Identity = $acc.IdentityReference.Value
    Type = $acc.AccessControlType.ToString()
    Rights = $acc.FileSystemRights.ToString()
    IsInherited = $acc.IsInherited
    Inheritance = $acc.InheritanceFlags.ToString()
    Propagation = $acc.PropagationFlags.ToString()
  })
}

[PSCustomObject]@{
  Owner = $acl.Owner
  Group = $acl.Group
  AreAccessRulesProtected = $acl.AreAccessRulesProtected
  Rules = $rules
} | ConvertTo-Json -Depth 4 -Compress
`;

    let owner = 'Unknown';
    let group = 'Unknown';
    let areAccessRulesProtected = false;
    const accessRules: AccessRule[] = [];

    try {
      const stdout = await runPowerShellScript(psScript);
      if (stdout && stdout.trim() && stdout.trim() !== '{}') {
        const raw = JSON.parse(stdout);
        owner = raw.Owner || 'Unknown';
        group = raw.Group || 'Unknown';
        areAccessRulesProtected = !!raw.AreAccessRulesProtected;

        if (Array.isArray(raw.Rules)) {
          for (const r of raw.Rules) {
            accessRules.push({
              identity: r.Identity || 'Unknown',
              accessControlType: r.Type === 'Deny' ? 'Deny' : 'Allow',
              fileSystemRights: r.Rights || 'GenericRead',
              isInherited: !!r.IsInherited,
              inheritanceFlags: r.Inheritance || 'None',
              propagationFlags: r.Propagation || 'None',
            });
          }
        }
      }
    } catch {
      // Fallback if Get-Acl fails (e.g. system permissions restriction)
      owner = 'SYSTEM / Protected';
    }

    const isSystem = resolvedPath.toLowerCase().includes('\\windows\\') || owner.toLowerCase().includes('trustedinstaller');
    const isReadOnly = canRead && !canWrite;

    let summary = `Owner: ${owner}. `;
    if (canRead && canWrite) {
      summary += 'Full read and write access available for current session.';
    } else if (canRead) {
      summary += 'Read-only access permitted. Modifications require elevated administrator rights.';
    } else {
      summary += 'Access restricted. Current user lacks sufficient Windows permissions.';
    }

    return {
      path: resolvedPath,
      name,
      isDirectory,
      owner,
      group,
      areAccessRulesProtected,
      accessRules,
      canRead,
      canWrite,
      canExecute,
      isReadOnly,
      isSystem,
      summary,
    };
  }

  static exportReport(report: PermissionReport, format: 'json' | 'csv'): string {
    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    } else {
      let csv = 'Path,Owner,CanRead,CanWrite,Principal,AccessType,Rights,Inherited\n';
      if (report.accessRules.length === 0) {
        csv += `"${report.path.replace(/"/g, '""')}","${report.owner}",${report.canRead},${report.canWrite},"N/A","N/A","N/A",false\n`;
      } else {
        for (const rule of report.accessRules) {
          csv += `"${report.path.replace(/"/g, '""')}","${report.owner}",${report.canRead},${report.canWrite},"${rule.identity.replace(/"/g, '""')}","${rule.accessControlType}","${rule.fileSystemRights}",${rule.isInherited}\n`;
        }
      }
      return csv;
    }
  }
}
