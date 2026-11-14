import http from 'http';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

// Start server
import '../dist-server/index.cjs';

const API_BASE = 'http://127.0.0.1:3579/api';

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

async function main() {
  console.log('\n===============================================================');
  console.log(' PHASE 4 AUTOMATED TEST SUITE: STORAGE UTILITIES & CLEANERS');
  console.log('===============================================================\n');

  await delay(1000); // Allow server to initialize

  const testTempRoot = path.join(os.tmpdir(), `phase4_test_${Date.now()}`);
  await fs.mkdir(testTempRoot, { recursive: true });

  try {
    // ------------------------------------------------------------------
    // TEST 1: Windows Recycle Bin Shell COM Query
    // ------------------------------------------------------------------
    await runTest('Recycle Bin', 'Query Recycle Bin items via Shell COM', async () => {
      const { data } = await apiRequest<{ items: any[]; totalBytes: number; formattedTotalBytes: string }>('/recycle-bin');
      if (!Array.isArray(data.items)) {
        throw new Error('Expected items array');
      }
      return `Found ${data.items.length} items (${data.formattedTotalBytes}) in Windows Recycle Bin`;
    });

    // ------------------------------------------------------------------
    // TEST 2: Dev Cleaner - Detection, Bloat Exclusion, Git Safety
    // ------------------------------------------------------------------
    const devTestProj = path.join(testTempRoot, 'demo_web_app');
    const nodeModulesDir = path.join(devTestProj, 'node_modules', 'some_dep');
    const nextDir = path.join(devTestProj, '.next', 'cache');
    const gitDir = path.join(devTestProj, '.git');
    const srcDir = path.join(devTestProj, 'src');

    await fs.mkdir(nodeModulesDir, { recursive: true });
    await fs.mkdir(nextDir, { recursive: true });
    await fs.mkdir(gitDir, { recursive: true });
    await fs.mkdir(srcDir, { recursive: true });

    await fs.writeFile(path.join(nodeModulesDir, 'package.json'), JSON.stringify({ name: 'dep', version: '1.0.0' }));
    await fs.writeFile(path.join(nextDir, 'build-manifest.json'), '{"dummy": true}');
    await fs.writeFile(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main\n');
    await fs.writeFile(path.join(srcDir, 'index.ts'), 'export const hello = "world";\n');

    await runTest('Dev Cleaner', 'Detect project build caches and exclude .git', async () => {
      const { data } = await apiRequest<{ items: any[]; totalBytes: number; formattedTotalBytes: string }>(
        `/dev-cleaner?path=${encodeURIComponent(devTestProj)}`
      );
      if (!Array.isArray(data.items) || data.items.length < 2) {
        throw new Error(`Expected at least 2 dev cache directories, found ${data.items.length}`);
      }

      const hasGit = data.items.some((i) => i.name === '.git' || i.path.includes('.git'));
      if (hasGit) {
        throw new Error('CRITICAL SAFETY VIOLATION: .git directory was included in dev cleaner!');
      }

      const hasNodeModules = data.items.some((i) => i.name === 'node_modules');
      const hasNext = data.items.some((i) => i.name === '.next');
      if (!hasNodeModules || !hasNext) {
        throw new Error('Failed to identify node_modules or .next caches');
      }

      return `Detected ${data.items.length} caches (${data.formattedTotalBytes}) with strict .git preservation`;
    });

    // ------------------------------------------------------------------
    // TEST 3: Dev Cleaner - Move Selected Cache to Windows Recycle Bin
    // ------------------------------------------------------------------
    await runTest('Dev Cleaner', 'Safely route dev cache to Windows Recycle Bin', async () => {
      const targetCache = path.join(devTestProj, '.next');
      const { data } = await apiRequest<{ success: boolean; cleanedCount: number; reclaimedBytes: number }>(
        '/dev-cleaner/clean',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths: [targetCache] }),
        }
      );

      if (!data.success || data.cleanedCount !== 1) {
        throw new Error(`Clean operation failed: ${JSON.stringify(data)}`);
      }

      if (fsSync.existsSync(targetCache)) {
        throw new Error('.next folder still exists in workspace after cleanup');
      }

      // Verify .git and src/index.ts are intact!
      if (!fsSync.existsSync(path.join(gitDir, 'HEAD'))) {
        throw new Error('.git/HEAD was damaged during dev cleanup!');
      }
      if (!fsSync.existsSync(path.join(srcDir, 'index.ts'))) {
        throw new Error('Project source file src/index.ts was damaged during dev cleanup!');
      }

      return 'Successfully moved .next to Recycle Bin while keeping .git and src/ completely safe';
    });

    // ------------------------------------------------------------------
    // TEST 4: Duplicate File Finder - Hash Matching & Waste Calculation
    // ------------------------------------------------------------------
    const dupDir = path.join(testTempRoot, 'duplicates_test');
    await fs.mkdir(dupDir, { recursive: true });

    // Create 3 identical files (> 1KB) and 1 distinct file
    const contentA = Buffer.alloc(4096, 'A');
    const contentB = Buffer.alloc(4096, 'B');

    await fs.writeFile(path.join(dupDir, 'file1.dat'), contentA);
    await fs.writeFile(path.join(dupDir, 'file2_copy.dat'), contentA);
    await fs.writeFile(path.join(dupDir, 'file3_backup.dat'), contentA);
    await fs.writeFile(path.join(dupDir, 'distinct.dat'), contentB);

    await runTest('Duplicate Finder', 'Match identical files by SHA-256 and calculate wasted bytes', async () => {
      const { data } = await apiRequest<{ duplicates: any[] }>(`/duplicates?path=${encodeURIComponent(dupDir)}`);
      if (!Array.isArray(data.duplicates) || data.duplicates.length === 0) {
        throw new Error('No duplicate groups returned');
      }

      const group = data.duplicates[0];
      if (group.items.length !== 3) {
        throw new Error(`Expected group to have 3 copies, found ${group.items.length}`);
      }

      const expectedWaste = 4096 * 2; // 2 redundant copies
      if (group.wasteBytes !== expectedWaste) {
        throw new Error(`Expected wasteBytes ${expectedWaste}, got ${group.wasteBytes}`);
      }

      return `Matched 3 copies with identical SHA-256, calculated ${group.formattedWaste} reclaimable waste`;
    });

    // ------------------------------------------------------------------
    // TEST 5: Empty Folder Finder & Cleaner
    // ------------------------------------------------------------------
    const emptyParent = path.join(testTempRoot, 'empty_folders_test');
    const emptySub1 = path.join(emptyParent, 'empty1');
    const emptySub2 = path.join(emptyParent, 'empty2');
    const populatedSub = path.join(emptyParent, 'not_empty');

    await fs.mkdir(emptySub1, { recursive: true });
    await fs.mkdir(emptySub2, { recursive: true });
    await fs.mkdir(populatedSub, { recursive: true });
    await fs.writeFile(path.join(populatedSub, 'keep.txt'), 'keep me');

    await runTest('Empty Folders', 'Find and safely remove empty directories', async () => {
      const { data: findData } = await apiRequest<{ folders: any[]; count: number }>(
        `/utils/empty-folders?path=${encodeURIComponent(emptyParent)}`
      );
      if (findData.folders.length < 2) {
        throw new Error(`Expected at least 2 empty folders, found ${findData.folders.length}`);
      }

      const { data: cleanData } = await apiRequest<{ success: boolean; cleanedCount: number }>(
        '/utils/empty-folders/clean',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths: [emptySub1, emptySub2] }),
        }
      );

      if (!cleanData.success || cleanData.cleanedCount !== 2) {
        throw new Error(`Expected 2 cleaned folders, got ${cleanData.cleanedCount}`);
      }

      if (fsSync.existsSync(emptySub1) || fsSync.existsSync(emptySub2)) {
        throw new Error('Empty folder still exists after clean');
      }

      if (!fsSync.existsSync(populatedSub)) {
        throw new Error('Populated folder was erroneously removed');
      }

      return 'Identified 2 empty folders, removed both, preserved populated folder';
    });

    // ------------------------------------------------------------------
    // TEST 6: Temporary Files Analyzer
    // ------------------------------------------------------------------
    await runTest('Temp Files', 'Scan system temp, user temp, and cache locations', async () => {
      const { data } = await apiRequest<{ totalBytes: number; formattedTotalBytes: string; categories: any[] }>(
        '/utils/temp-files'
      );
      if (!Array.isArray(data.categories) || data.categories.length === 0) {
        throw new Error('No temporary file categories returned');
      }

      return `Scanned ${data.categories.length} temp categories totaling ${data.formattedTotalBytes}`;
    });

    // ------------------------------------------------------------------
    // TEST 7: File Checksums Engine (MD5, SHA-1, SHA-256, SHA-512)
    // ------------------------------------------------------------------
    const checksumFile = path.join(testTempRoot, 'checksum_test.bin');
    const checksumContent = 'SmartExplorerPhase4VerifiedChecksums2026';
    await fs.writeFile(checksumFile, checksumContent);

    const expectedMd5 = crypto.createHash('md5').update(checksumContent).digest('hex');
    const expectedSha256 = crypto.createHash('sha256').update(checksumContent).digest('hex');

    await runTest('Checksums', 'Calculate multi-algorithm file checksums (MD5, SHA-1, SHA-256, SHA-512)', async () => {
      const { data } = await apiRequest<{ md5: string; sha1: string; sha256: string; sha512: string }>(
        `/utils/checksum?path=${encodeURIComponent(checksumFile)}`
      );

      if (data.md5.toLowerCase() !== expectedMd5.toLowerCase()) {
        throw new Error(`MD5 mismatch: expected ${expectedMd5}, got ${data.md5}`);
      }
      if (data.sha256.toLowerCase() !== expectedSha256.toLowerCase()) {
        throw new Error(`SHA-256 mismatch: expected ${expectedSha256}, got ${data.sha256}`);
      }
      if (!data.sha1 || !data.sha512) {
        throw new Error('Missing SHA-1 or SHA-512 hash values');
      }

      return `Verified MD5 (${data.md5.slice(0, 8)}...) & SHA-256 (${data.sha256.slice(0, 8)}...) match exact cryptographical outputs`;
    });

    // ------------------------------------------------------------------
    // TEST 8: Windows Startup Items Query
    // ------------------------------------------------------------------
    await runTest('Startup Manager', 'Query Windows startup items from registry and startup folder', async () => {
      const { data } = await apiRequest<{ items: any[]; count: number }>('/utils/startup');
      if (!Array.isArray(data.items)) {
        throw new Error('Expected items array');
      }
      return `Retrieved ${data.items.length} startup configurations`;
    });

    // ------------------------------------------------------------------
    // TEST 9: Disk Hardware & Physical Drive Health Query
    // ------------------------------------------------------------------
    await runTest('Disk Hardware', 'Query physical disk drives, media types, and health status', async () => {
      const { data } = await apiRequest<{ disks: any[]; count: number }>('/utils/disks-info');
      if (!Array.isArray(data.disks) || data.disks.length === 0) {
        throw new Error('No physical disk drives detected');
      }
      const firstDisk = data.disks[0];
      return `Detected physical drive: ${firstDisk.model} (${firstDisk.mediaType}, ${firstDisk.formattedSize}, Health: ${firstDisk.health})`;
    });

    // ------------------------------------------------------------------
    // TEST 10: Folder Comparator
    // ------------------------------------------------------------------
    const compA = path.join(testTempRoot, 'comp_folder_A');
    const compB = path.join(testTempRoot, 'comp_folder_B');
    await fs.mkdir(compA, { recursive: true });
    await fs.mkdir(compB, { recursive: true });

    await fs.writeFile(path.join(compA, 'common.txt'), 'identical content');
    await fs.writeFile(path.join(compB, 'common.txt'), 'identical content');

    await fs.writeFile(path.join(compA, 'only_in_a.txt'), 'only in A');
    await fs.writeFile(path.join(compB, 'only_in_b.txt'), 'only in B');

    await fs.writeFile(path.join(compA, 'diff.txt'), 'version 1');
    await fs.writeFile(path.join(compB, 'diff.txt'), 'version 2 modified longer');

    await runTest('Folder Comparator', 'Perform side-by-side folder comparison with delta analysis', async () => {
      const { data } = await apiRequest<{
        onlyInA: any[];
        onlyInB: any[];
        different: any[];
        identicalCount: number;
      }>(`/utils/compare-folders?pathA=${encodeURIComponent(compA)}&pathB=${encodeURIComponent(compB)}`);

      if (data.onlyInA.length !== 1 || data.onlyInA[0].name !== 'only_in_a.txt') {
        throw new Error('Failed to identify onlyInA');
      }
      if (data.onlyInB.length !== 1 || data.onlyInB[0].name !== 'only_in_b.txt') {
        throw new Error('Failed to identify onlyInB');
      }
      if (data.different.length !== 1 || data.different[0].name !== 'diff.txt') {
        throw new Error('Failed to identify modified file');
      }
      if (data.identicalCount !== 1) {
        throw new Error(`Expected identicalCount = 1, got ${data.identicalCount}`);
      }

      return 'Accurately detected 1 onlyInA, 1 onlyInB, 1 different, and 1 identical file';
    });
  } finally {
    // Cleanup temporary test root
    try {
      await fs.rm(testTempRoot, { recursive: true, force: true });
    } catch {}
  }

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n---------------------------------------------------------------');
  console.log(` PHASE 4 TEST EXECUTION SUMMARY: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('---------------------------------------------------------------\n');

  if (failed > 0) {
    console.error(`ERROR: ${failed} tests failed!`);
    process.exit(1);
  } else {
    console.log('SUCCESS: All Phase 4 Storage Utilities & Cleaners verified perfectly!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
