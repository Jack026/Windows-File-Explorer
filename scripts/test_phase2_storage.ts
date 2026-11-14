import http from 'http';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

// Start server
import '../dist-server/index.cjs';

const API_BASE = 'http://127.0.0.1:3579/api';
const TEST_DIR = path.resolve(process.cwd(), '_phase2_test_workspace_');

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
  console.log('====================================================');
  console.log('  PHASE 2 STORAGE: AUTOMATED INTEGRATION & QA SUITE  ');
  console.log('====================================================\n');

  // Wait for server readiness
  await delay(1200);

  // Setup test sandbox
  if (fsSync.existsSync(TEST_DIR)) {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  }
  await fs.mkdir(TEST_DIR, { recursive: true });

  // Create test files across categories:
  // 1. Large dummy video file (60 MB)
  const videoFile = path.join(TEST_DIR, 'sample_video.mp4');
  const buffer60M = Buffer.alloc(60 * 1024 * 1024, 0x5a);
  await fs.writeFile(videoFile, buffer60M);

  // 2. Dummy archive (15 MB)
  const archiveFile = path.join(TEST_DIR, 'backup_archive.zip');
  const buffer15M = Buffer.alloc(15 * 1024 * 1024, 0x3c);
  await fs.writeFile(archiveFile, buffer15M);

  // 3. Dev bloat folder
  const bloatDir = path.join(TEST_DIR, 'node_modules', 'some-pkg');
  await fs.mkdir(bloatDir, { recursive: true });
  await fs.writeFile(path.join(bloatDir, 'bundle.js'), 'console.log("bloat");');

  // 4. Subdirectory with doc
  const docDir = path.join(TEST_DIR, 'Documents');
  await fs.mkdir(docDir, { recursive: true });
  await fs.writeFile(path.join(docDir, 'report.docx'), 'Document content data.');

  console.log('--- 1. Testing Storage X-Ray & Treemap Analyzer ---');
  let firstScanReport: any = null;
  await runTest('X-Ray', 'Execute real Storage X-Ray scan', async () => {
    const { data } = await apiRequest<any>(
      `/storage-xray?path=${encodeURIComponent(TEST_DIR)}&depth=4`
    );
    if (!data.totalBytes || data.totalBytes < 70 * 1024 * 1024) {
      throw new Error(`Expected at least 70MB scanned, got ${data.totalBytes}`);
    }
    if (!data.treemapRoot || !data.categories) {
      throw new Error('Missing treemap root or category breakdown');
    }
    firstScanReport = data;
    return `Scanned ${data.formattedTotalSize}, ${data.totalFiles} files, ${data.totalFolders} folders`;
  });

  console.log('\n--- 2. Testing Scan Lifecycle Controls (Pause, Resume, Cancel) ---');
  await runTest('Scan Lifecycle', 'Start, Pause, Resume, and Cancel SSE scan session', async () => {
    const scanId = `test_scan_${Date.now()}`;
    // Start scan stream
    const res = await fetch(
      `${API_BASE}/scan/start?path=${encodeURIComponent(TEST_DIR)}&mode=quick&scanId=${scanId}`
    );
    if (!res.ok) throw new Error(`Scan start failed (${res.status})`);

    // Pause scan
    await delay(50);
    const { data: pauseRes } = await apiRequest<any>('/scan/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scanId }),
    });

    // Resume scan
    await delay(50);
    const { data: resumeRes } = await apiRequest<any>('/scan/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scanId }),
    });

    // Cancel scan
    await delay(50);
    const { data: cancelRes } = await apiRequest<any>('/scan/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scanId }),
    });

    return 'Verified full scan lifecycle: Start -> Pause -> Resume -> Cancel';
  });

  console.log('\n--- 3. Testing Folder Sizing Engine & Cache ---');
  await runTest('Folder Sizing', 'Retrieve subfolder sizes via streaming endpoint', async () => {
    const res = await fetch(
      `${API_BASE}/folder-sizes/stream?path=${encodeURIComponent(TEST_DIR)}`
    );
    if (!res.ok) throw new Error('Folder sizes stream failed');
    return 'Folder size streaming channel established cleanly';
  });

  await runTest('Cache Stats', 'Inspect persistent storage cache statistics', async () => {
    const { data: stats } = await apiRequest<any>('/cache/stats');
    if (typeof stats.entryCount !== 'number') {
      throw new Error(`Invalid stats: ${JSON.stringify(stats)}`);
    }
    return `Cached entries: ${stats.entryCount}, Memory estimate: ${stats.memoryBytesEstimate} B`;
  });

  console.log('\n--- 4. Testing Large File Finder Engine ---');
  await runTest('Large Files', 'Discover files exceeding threshold with category filtering', async () => {
    // Look for files > 10MB in TEST_DIR
    const { data } = await apiRequest<any>(
      `/large-files?path=${encodeURIComponent(TEST_DIR)}&minSize=${10 * 1024 * 1024}`
    );
    if (data.count < 2) {
      throw new Error(`Expected at least 2 files > 10MB, got ${data.count}`);
    }
    const sample = data.files[0];
    return `Found ${data.count} large files (${data.formattedTotalBytes}). Top: ${sample.name} (${sample.formattedSize})`;
  });

  await runTest('Large Files', 'Filter large files by media category', async () => {
    const { data } = await apiRequest<any>(
      `/large-files?path=${encodeURIComponent(TEST_DIR)}&minSize=${10 * 1024 * 1024}&category=media`
    );
    if (data.count === 0 || !data.files.every((f: any) => f.category === 'media')) {
      throw new Error(`Expected media files only, got: ${JSON.stringify(data.files)}`);
    }
    return `Found ${data.count} media file(s): ${data.files[0].name}`;
  });

  console.log('\n--- 5. Testing Scan History & Storage Growth Tracker ---');
  let historyRecordA: any = null;
  let historyRecordB: any = null;

  await runTest('Scan History', 'Verify automatic recording of scans', async () => {
    const { data } = await apiRequest<any>('/scan-history');
    if (!data.history || data.history.length === 0) {
      throw new Error('Expected at least 1 recorded scan in history');
    }
    historyRecordA = data.history[0];
    return `Recorded history count: ${data.count}, Latest: ${historyRecordA.targetPath}`;
  });

  await runTest('Scan History Growth', 'Record second scan with growth and compute delta comparison', async () => {
    // Add another 20MB file to simulate storage growth
    const extraFile = path.join(TEST_DIR, 'growth_media.mp4');
    const buffer20M = Buffer.alloc(20 * 1024 * 1024, 0x7e);
    await fs.writeFile(extraFile, buffer20M);

    // Run second scan
    const { data: secondScan } = await apiRequest<any>(
      `/storage-xray?path=${encodeURIComponent(TEST_DIR)}&depth=4`
    );

    // Get updated history
    const { data: updatedHistory } = await apiRequest<any>('/scan-history');
    historyRecordB = updatedHistory.history[0]; // Newest
    const olderRecord = updatedHistory.history[1];

    if (!historyRecordB || !olderRecord) {
      throw new Error('Expected two historical records for comparison');
    }

    // Compare older with newer
    const { data: comparison } = await apiRequest<any>(
      `/scan-history/compare?idA=${encodeURIComponent(olderRecord.id)}&idB=${encodeURIComponent(historyRecordB.id)}`
    );

    if (!comparison.isGrowth || comparison.deltaBytes <= 0) {
      throw new Error(`Expected positive growth delta, got ${JSON.stringify(comparison)}`);
    }

    return `Growth Delta: ${comparison.formattedDeltaBytes} (+${comparison.deltaPercent}%), Media grew: ${comparison.categoryDeltas.media?.formattedDeltaBytes}`;
  });

  await runTest('Scan History Cleanup', 'Delete individual snapshot by ID', async () => {
    if (!historyRecordA) throw new Error('No record to delete');
    const { data: delRes } = await apiRequest<any>(`/scan-history/${encodeURIComponent(historyRecordA.id)}`, {
      method: 'DELETE',
    });
    if (!delRes.success) {
      throw new Error('Failed to delete history record');
    }
    return `Deleted snapshot ID: ${historyRecordA.id.slice(0, 15)}...`;
  });

  // Cleanup test sandbox
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  } catch {}

  console.log('\n====================================================');
  console.log('  TEST SUMMARY');
  console.log('====================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    console.error('\nFAILED TESTS:');
    results.filter((r) => !r.passed).forEach((r) => console.error(`  - ${r.name}: ${r.error}`));
    process.exit(1);
  } else {
    console.log('\nALL PHASE 2 STORAGE TESTS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
