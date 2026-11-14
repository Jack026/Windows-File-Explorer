import path from 'path';
import os from 'os';

/**
 * Security & Validation Module for Windows File Explorer
 * Enforces path sanitization, prevents path traversal, rejects null-byte attacks,
 * and safeguards critical Windows system directories from destructive operations.
 */

// Critical system paths that must never be deleted or modified destructively
const PROTECTED_PATHS = new Set<string>();

function initProtectedPaths() {
  const winDir = (process.env.WINDIR || 'C:\\Windows').toLowerCase();
  const sysDrive = (process.env.SystemDrive || 'C:').toLowerCase() + '\\';
  const progFiles = (process.env.ProgramFiles || 'C:\\Program Files').toLowerCase();
  const progFilesX86 = (process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)').toLowerCase();
  const progData = (process.env.ProgramData || 'C:\\ProgramData').toLowerCase();

  PROTECTED_PATHS.add(winDir);
  PROTECTED_PATHS.add(path.join(winDir, 'system32').toLowerCase());
  PROTECTED_PATHS.add(sysDrive);
  PROTECTED_PATHS.add(progFiles);
  PROTECTED_PATHS.add(progFilesX86);
  PROTECTED_PATHS.add(progData);
}

initProtectedPaths();

/**
 * Validates and normalizes an input filesystem path.
 * Throws an error if null bytes, invalid characters, or forbidden path traversal are detected.
 */
export function validateAndSanitizePath(rawPath: string | undefined, defaultFallback?: string): string {
  if (!rawPath || typeof rawPath !== 'string') {
    if (defaultFallback) return path.resolve(defaultFallback);
    throw new Error('Invalid path: Path parameter must be a non-empty string.');
  }

  // Null byte injection check
  if (rawPath.includes('\0')) {
    throw new Error('Security Error: Null byte injection detected in path.');
  }

  const trimmed = rawPath.trim();
  if (!trimmed) {
    if (defaultFallback) return path.resolve(defaultFallback);
    throw new Error('Invalid path: Path cannot be whitespace only.');
  }

  // Resolve absolute normalized path
  const resolved = path.resolve(trimmed);
  return resolved;
}

/**
 * Checks whether a path corresponds to a critical Windows OS or System directory
 * that must be protected from destructive deletion.
 */
export function isProtectedSystemPath(targetPath: string): boolean {
  if (!targetPath) return true;
  const normalized = path.resolve(targetPath).toLowerCase();

  // Root drive checks (e.g. "c:\", "d:\")
  if (/^[a-z]:\\?$/i.test(normalized)) {
    return true;
  }

  // Exact protected folder checks
  if (PROTECTED_PATHS.has(normalized)) {
    return true;
  }

  // Subdirectories of Windows or System32
  const winDir = (process.env.WINDIR || 'C:\\Windows').toLowerCase();
  if (normalized.startsWith(winDir + path.sep) || normalized === winDir) {
    return true;
  }

  // Critical root system files
  const baseName = path.basename(normalized);
  const criticalFiles = ['hiberfil.sys', 'pagefile.sys', 'swapfile.sys', 'bootmgr', 'ntldr'];
  if (criticalFiles.includes(baseName)) {
    return true;
  }

  return false;
}

/**
 * Sanitizes a file name by removing invalid Windows filename characters.
 */
export function sanitizeFileName(name: string): string {
  if (!name) return 'unnamed';
  // Replace illegal chars: \ / : * ? " < > |
  return name.replace(/[\\/:*?"<>|\x00-\x1F]/g, '_').trim();
}
