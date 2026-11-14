import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { ScanManager, ScanSession } from '../server/scan-manager';

const TEST_DIR = path.resolve(process.cwd(), '_test_scan_dir_');

async function main() {
  console.log('--- Testing Storage Scan Lifecycle Engine ---');

  // Setup test dir
  if (fsSync.existsSync(TEST_DIR)) await fs.rm(TEST_DIR, { recursive: true, force: true });
  await fs.mkdir(path.join(TEST_DIR, 'A', 'B'), { recursive: true });
  await fs.writeFile(path.join(TEST_DIR, 'file1.txt'), 'hello world', 'utf-8');
  await fs.writeFile(path.join(TEST_DIR, 'A', 'file2.txt'), 'hello world 2', 'utf-8');
  await fs.writeFile(path.join(TEST_DIR, 'A', 'B', 'file3.txt'), 'hello world 3', 'utf-8');

  // 1. Test Quick Scan
  console.log('1. Testing Quick Scan...');
  const quickSession = ScanManager.createSession('test_quick', TEST_DIR, 'quick');
  let quickEvents = 0;
  quickSession.on('progress', () => quickEvents++);
  const quickReport = await quickSession.run();
  console.log(`  Quick Scan finished with ${quickEvents} progress events. Scanned: ${quickSession.scannedFiles} files, ${quickSession.scannedFolders} folders.`);
  if (!quickReport || quickSession.scannedFiles < 3) throw new Error('Quick scan failed to find files');

  // 2. Test Standard Scan
  console.log('2. Testing Standard Scan...');
  const stdSession = ScanManager.createSession('test_std', TEST_DIR, 'standard');
  const stdReport = await stdSession.run();
  console.log(`  Standard Scan finished. Total bytes: ${stdSession.totalBytes}`);
  if (!stdReport) throw new Error('Standard scan failed');

  // 3. Test Pause and Resume
  console.log('3. Testing Pause & Resume...');
  const pauseSession = ScanManager.createSession('test_pause', TEST_DIR, 'standard');
  const runPromise = pauseSession.run();
  pauseSession.pause();
  if (pauseSession.status !== 'paused') throw new Error(`Expected status 'paused', got ${pauseSession.status}`);
  console.log('  Successfully paused session.');
  pauseSession.resume();
  if (pauseSession.status !== 'running' && pauseSession.status !== 'completed') {
    throw new Error(`Expected running/completed after resume, got ${pauseSession.status}`);
  }
  await runPromise;
  console.log('  Successfully resumed and finished.');

  // 4. Test Cancel
  console.log('4. Testing Cancel...');
  const cancelSession = ScanManager.createSession('test_cancel', TEST_DIR, 'deep');
  const cancelPromise = cancelSession.run();
  cancelSession.cancel();
  if (cancelSession.status !== 'cancelled') throw new Error(`Expected status 'cancelled', got ${cancelSession.status}`);
  await cancelPromise;
  console.log('  Successfully cancelled session.');

  // Cleanup
  if (fsSync.existsSync(TEST_DIR)) await fs.rm(TEST_DIR, { recursive: true, force: true });
  console.log('--- Scan Lifecycle Engine verified 100% ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('Scan test error:', err);
  process.exit(1);
});
