import { execFile } from 'child_process';

/**
 * Executes a PowerShell script safely by base64-encoding it into UTF-16LE,
 * preventing any issues with special characters, quotes, or variable expansion.
 */
export async function runPowerShellScript(script: string, maxBuffer = 32 * 1024 * 1024): Promise<string> {
  const b64 = Buffer.from(script, 'utf16le').toString('base64');
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', b64],
      { maxBuffer },
      (err, stdout, stderr) => {
        if (err) {
          // Return empty on non-critical error or reject
          return resolve(stdout || '');
        }
        resolve(stdout || '');
      }
    );
  });
}
