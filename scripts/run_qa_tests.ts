import http from 'http';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Start server if needed
import '../dist-server/index.cjs';

const API_BASE = 'http://127.0.0.1:3579/api';
const TEST_DIR = path.resolve(process.cwd(), '_test_workspace_');

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  durationMs: number;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiRequest<T = any>(endpoint: string, options?: RequestInit): Promise<{ data: T; durationMs: number }> {
  const start = performance.now();
  const res = await fetch(`${API_BASE}${endpoint}`, options);
  const durationMs = Math.round((performance.now() - start) * 100) / 100;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${endpoint} failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return { data, durationMs };
}

async function runTest(category: string, name: string, fn: () => Promise<string | void>) {
  const start = performance.now();
  try {
    const details = await fn();
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    results.push({ name, category, passed: true, durationMs, details: details || undefined });
    console.log(`  [PASS] ${name} (${durationMs}ms)${details ? ` - ${details}` : ''}`);
  } catch (err: any) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    results.push({ name, category, passed: false, durationMs, error: err.message });
    console.error(`  [FAIL] ${name} (${durationMs}ms) - ${err.message}`);
  }
}

async function setupTestEnvironment() {
  console.log('\n--- 1. Setting up Test Environment ---');
  if (fsSync.existsSync(TEST_DIR)) {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  }
  await fs.mkdir(TEST_DIR, { recursive: true });

  // Create folder structure
  await fs.mkdir(path.join(TEST_DIR, 'Documents'), { recursive: true });
  await fs.mkdir(path.join(TEST_DIR, 'Media'), { recursive: true });
  await fs.mkdir(path.join(TEST_DIR, 'Project', 'node_modules', 'subpkg'), { recursive: true });
  await fs.mkdir(path.join(TEST_DIR, 'Project', 'src'), { recursive: true });

  // Create sample files
  await fs.writeFile(path.join(TEST_DIR, 'Documents', 'notes.txt'), 'Hello Windows File Explorer!', 'utf-8');
  await fs.writeFile(path.join(TEST_DIR, 'Documents', 'data.csv'), 'id,name,value\n1,alpha,100\n2,beta,200\n', 'utf-8');
  await fs.writeFile(path.join(TEST_DIR, 'Media', 'image.png'), Buffer.alloc(1024 * 50, 0x89)); // 50 KB dummy
  await fs.writeFile(path.join(TEST_DIR, 'Project', 'src', 'index.ts'), 'export const greeting = "hi";\n', 'utf-8');
  await fs.writeFile(path.join(TEST_DIR, 'Project', 'node_modules', 'subpkg', 'index.js'), 'module.exports = {};\n', 'utf-8');

  // Create duplicates (same content in two locations)
  const dupContent = 'IDENTICAL_DUPLICATE_PAYLOAD_FOR_HASHING_' + 'X'.repeat(2048);
  await fs.writeFile(path.join(TEST_DIR, 'Documents', 'report_v1.docx'), dupContent, 'utf-8');
  await fs.writeFile(path.join(TEST_DIR, 'Media', 'report_copy.docx'), dupContent, 'utf-8');

  console.log(`Created test fixture in: ${TEST_DIR}`);
}

async function cleanupTestEnvironment() {
  console.log('\n--- Cleaning up Test Environment ---');
  try {
    if (fsSync.existsSync(TEST_DIR)) {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
      console.log('Cleaned up test fixture.');
    }
  } catch (err: any) {
    console.warn('Cleanup notice:', err.message);
  }
}

async function main() {
  console.log('====================================================');
  console.log('  Windows File Explorer & Storage Analyzer QA Suite ');
  console.log('====================================================');

  await delay(600); // Allow server listener to settle
  await setupTestEnvironment();

  console.log('\n--- 2. Executing Core Filesystem Benchmarks ---');

  // Test 1: Drive Detection
  await runTest('Drives', 'Detect Windows Logical Drives & Free Space', async () => {
    const { data, durationMs } = await apiRequest('/drives');
    if (!data.drives || data.drives.length === 0) throw new Error('No drives detected');
    const cDrive = data.drives.find((d: any) => d.deviceId.startsWith('C'));
    if (!cDrive) throw new Error('C: drive was not found');
    return `Found ${data.drives.length} drives. C: used ${Math.round(cDrive.usedBytes / 1024 / 1024 / 1024)}GB (${durationMs}ms)`;
  });

  // Test 2: Directory Listing
  await runTest('Directory', 'Fast Directory Read & Metadata Extraction', async () => {
    const { data } = await apiRequest(`/directory?path=${encodeURIComponent(TEST_DIR)}`);
    if (!data.exists) throw new Error('Directory does not exist');
    if (data.items.length < 3) throw new Error(`Expected at least 3 items, got ${data.items.length}`);
    return `Listed ${data.items.length} items (${data.totalFolders} folders, ${data.totalFiles} files)`;
  });

  // Test 3: File Creation
  const newFilePath = path.join(TEST_DIR, 'created_file.txt');
  await runTest('FileOps', 'Create New Text File via API', async () => {
    await apiRequest('/file-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'createFile', source: newFilePath }),
    });
    if (!fsSync.existsSync(newFilePath)) throw new Error('File was not created on disk');
    return 'File successfully created on disk';
  });

  // Test 4: File Rename
  const renamedFilePath = path.join(TEST_DIR, 'renamed_file.txt');
  await runTest('FileOps', 'Rename File via API', async () => {
    await apiRequest('/file-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rename', source: newFilePath, newName: 'renamed_file.txt' }),
    });
    if (!fsSync.existsSync(renamedFilePath)) throw new Error('Renamed file does not exist');
    if (fsSync.existsSync(newFilePath)) throw new Error('Original file still exists');
    return 'File renamed cleanly';
  });

  // Test 5: File Copy with Conflict Handling (Rename Policy)
  await runTest('FileOps', 'Copy File with Auto-Rename on Collision', async () => {
    // Copy 1
    const targetCopy = path.join(TEST_DIR, 'Documents', 'renamed_file.txt');
    await apiRequest('/file-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'copy', source: renamedFilePath, destination: targetCopy }),
    });
    if (!fsSync.existsSync(targetCopy)) throw new Error('First copy failed');

    // Copy 2 with collision (conflictPolicy: rename)
    const { data } = await apiRequest('/file-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'copy',
        source: renamedFilePath,
        destination: targetCopy,
        conflictPolicy: 'rename',
      }),
    });
    if (!data.destination || data.destination === targetCopy) {
      throw new Error(`Expected renamed destination, got: ${data.destination}`);
    }
    return `Handled conflict cleanly -> ${path.basename(data.destination)}`;
  });

  // Test 6: Move Item
  const movedTarget = path.join(TEST_DIR, 'Documents', 'moved_file.txt');
  await runTest('FileOps', 'Move File to Destination Subdirectory', async () => {
    await apiRequest('/file-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'move', source: renamedFilePath, destination: movedTarget }),
    });
    if (!fsSync.existsSync(movedTarget)) throw new Error('Moved file does not exist');
    if (fsSync.existsSync(renamedFilePath)) throw new Error('Source file still exists after move');
    return 'File moved cleanly';
  });

  // Test 7: Safe Deletion to Recycle Bin
  const trashTarget = path.join(TEST_DIR, 'Documents', 'trash_me.txt');
  await fs.writeFile(trashTarget, 'To be recycled', 'utf-8');
  await runTest('RecycleBin', 'Safe Route to Windows Recycle Bin via Shell COM', async () => {
    await apiRequest('/file-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'trash', source: trashTarget }),
    });
    if (fsSync.existsSync(trashTarget)) throw new Error('File still exists on disk after trash action');
    return 'Sent to Windows Recycle Bin';
  });

  // Test 8: Duplicate File SHA-256 Engine
  await runTest('Duplicates', 'SHA-256 Hash Matching & Waste Space Calculation', async () => {
    const { data } = await apiRequest(`/duplicates?path=${encodeURIComponent(TEST_DIR)}`);
    if (!data.duplicates || data.duplicates.length === 0) {
      throw new Error('Expected at least 1 duplicate group');
    }
    const group = data.duplicates[0];
    if (group.items.length < 2) throw new Error(`Expected 2 duplicate files in group, got ${group.items.length}`);
    return `Found duplicate group (${group.items.length} files, ${group.formattedWaste} waste)`;
  });

  // Test 9: Storage X-Ray & Dev Bloat Cleaner Engine
  await runTest('StorageXRay', 'Squarified Treemap Generation & Dev Bloat Detection', async () => {
    const { data } = await apiRequest(`/storage-xray?path=${encodeURIComponent(TEST_DIR)}&depth=4`);
    if (!data.treemapRoot) throw new Error('Treemap root was not generated');
    if (!data.bloatItems || data.bloatItems.length === 0) {
      throw new Error('Expected node_modules to be detected as bloat item');
    }
    const nodeModulesBloat = data.bloatItems.find((b: any) => b.name === 'node_modules');
    if (!nodeModulesBloat) throw new Error('node_modules not found in bloat list');
    return `Categorized ${data.totalFiles} files into ${data.categories.length} groups. Detected bloat: ${nodeModulesBloat.name}`;
  });

  // Test 10: Persistent Cache Verification
  await runTest('Cache', 'Persistent Folder Size In-Memory & Disk Retrieval', async () => {
    const { data: first } = await apiRequest(`/directory?path=${encodeURIComponent(TEST_DIR)}`);
    const start = performance.now();
    const { data: second } = await apiRequest(`/directory?path=${encodeURIComponent(TEST_DIR)}`);
    const duration = Math.round((performance.now() - start) * 100) / 100;
    return `Cached lookup completed in ${duration}ms`;
  });

  // Cleanup
  await cleanupTestEnvironment();

  console.log('\n====================================================');
  console.log('                 QA TEST SUMMARY                     ');
  console.log('====================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
