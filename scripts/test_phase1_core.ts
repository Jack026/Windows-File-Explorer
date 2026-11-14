import http from 'http';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

// Load server
import '../dist-server/index.cjs';

const API_BASE = 'http://127.0.0.1:3579/api';
const TEST_DIR = path.resolve(process.cwd(), '_phase1_test_workspace_');

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
  console.log('  PHASE 1 CORE: AUTOMATED INTEGRATION & QA TEST SUITE');
  console.log('====================================================\n');

  // Wait for server ready
  await delay(1200);

  // Setup test sandbox
  if (fsSync.existsSync(TEST_DIR)) {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  }
  await fs.mkdir(TEST_DIR, { recursive: true });

  const testFileA = path.join(TEST_DIR, 'document_sample.txt');
  await fs.writeFile(testFileA, 'Hello Samsung One UI Windows File Explorer Phase 1 Core Test!');

  const subDir = path.join(TEST_DIR, 'SubFolder_Alpha');
  await fs.mkdir(subDir, { recursive: true });
  const testFileB = path.join(subDir, 'sub_image.png');
  await fs.writeFile(testFileB, 'PNG_MOCK_DATA_12345');

  console.log('--- 1. Testing Path Autocomplete Engine ---');
  await runTest('Autocomplete', 'Suggest subdirectories in test directory', async () => {
    const { data } = await apiRequest<{ suggestions: string[] }>(
      `/path-autocomplete?query=${encodeURIComponent(TEST_DIR + '\\Sub')}`
    );
    if (!data.suggestions || data.suggestions.length === 0) {
      throw new Error(`Expected suggestions for Sub in ${TEST_DIR}, got ${JSON.stringify(data)}`);
    }
    const match = data.suggestions.some((s) => s.includes('SubFolder_Alpha'));
    if (!match) throw new Error(`SubFolder_Alpha not in suggestions: ${data.suggestions.join(', ')}`);
    return `Found ${data.suggestions.length} suggestion(s): ${data.suggestions[0]}`;
  });

  console.log('\n--- 2. Testing Advanced Search Engine ---');
  await runTest('Deep Search', 'Search by pattern and type filter', async () => {
    const { data } = await apiRequest<{ results: any[]; totalFound: number }>(
      '/search/deep',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rootPath: TEST_DIR,
          query: 'document type:document',
          maxResults: 10,
        }),
      }
    );
    if (data.results.length === 0) {
      throw new Error('Search failed to find document_sample.txt');
    }
    return `Found ${data.totalFound} match: ${data.results[0].name} (${data.results[0].category})`;
  });

  await runTest('Deep Search', 'Search with size filter size:>10', async () => {
    const { data } = await apiRequest<{ results: any[]; totalFound: number }>(
      '/search/deep',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rootPath: TEST_DIR,
          query: 'size:>10',
          maxResults: 10,
        }),
      }
    );
    if (data.results.length < 2) {
      throw new Error(`Expected at least 2 files matching size:>10, got ${data.results.length}`);
    }
    return `Found ${data.totalFound} matching files`;
  });

  console.log('\n--- 3. Testing File Properties Engine & Win32 Attributes ---');
  await runTest('File Properties', 'Inspect cluster-aligned size on disk and hashes', async () => {
    const { data } = await apiRequest<any>(
      `/file-properties?path=${encodeURIComponent(testFileA)}&computeHashes=true`
    );
    if (!data.sizeOnDiskFormatted || !data.hashes?.sha256 || !data.hashes?.md5) {
      throw new Error(`Incomplete properties: ${JSON.stringify(data)}`);
    }
    return `Size: ${data.formattedSize}, On Disk: ${data.sizeOnDiskFormatted}, SHA256: ${data.hashes.sha256.slice(0, 12)}...`;
  });

  await runTest('Attributes', 'Toggle ReadOnly attribute on file', async () => {
    const { data: setRes } = await apiRequest<any>('/set-attributes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: testFileA,
        readOnly: true,
      }),
    });
    if (!setRes.success || !setRes.attributes.readOnly) {
      throw new Error('Failed to set ReadOnly');
    }

    // Reset back
    await apiRequest<any>('/set-attributes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: testFileA,
        readOnly: false,
      }),
    });
    return 'Successfully toggled and verified ReadOnly attribute';
  });

  console.log('\n--- 4. Testing File Actions: Duplicate & CreateFile ---');
  let duplicatedPath = '';
  await runTest('File Action', 'Duplicate file with auto (Copy) naming', async () => {
    const { data } = await apiRequest<any>('/file-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'duplicate',
        source: testFileA,
      }),
    });
    if (!data.success || !data.createdPath) {
      throw new Error(`Duplicate failed: ${JSON.stringify(data)}`);
    }
    duplicatedPath = data.createdPath;
    if (!fsSync.existsSync(duplicatedPath)) {
      throw new Error(`Duplicated file does not exist on disk: ${duplicatedPath}`);
    }
    return `Created duplicate: ${path.basename(duplicatedPath)}`;
  });

  let createdDocPath = '';
  await runTest('File Action', 'Create new empty file', async () => {
    const { data } = await apiRequest<any>('/file-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'createFile',
        source: TEST_DIR,
        newName: 'Created_Document.txt',
      }),
    });
    if (!data.success || !data.createdPath) {
      throw new Error(`Create file failed: ${JSON.stringify(data)}`);
    }
    createdDocPath = data.createdPath;
    if (!fsSync.existsSync(createdDocPath)) {
      throw new Error(`Created file not on disk: ${createdDocPath}`);
    }
    return `Created: ${path.basename(createdDocPath)}`;
  });

  console.log('\n--- 5. Testing Undo / Redo Manager ---');
  await runTest('Undo Manager', 'Undo the latest file creation', async () => {
    const { data } = await apiRequest<any>('/undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!data.success) {
      throw new Error(`Undo failed: ${data.message}`);
    }
    return `Undone: ${data.description}`;
  });

  await runTest('Redo Manager', 'Redo the reversed file creation', async () => {
    const { data } = await apiRequest<any>('/redo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!data.success) {
      throw new Error(`Redo failed: ${data.message}`);
    }
    return `Redone: ${data.description}`;
  });

  console.log('\n--- 6. Testing Background Transfer Manager ---');
  await runTest('Transfer Manager', 'Inspect transfer queue lifecycle', async () => {
    const { data: initialData } = await apiRequest<any>('/transfers');
    const tasks = Array.isArray(initialData) ? initialData : initialData.tasks;
    if (!Array.isArray(tasks)) {
      throw new Error('Transfers queue is not an array');
    }

    // Clear completed transfers
    const { data: clearRes } = await apiRequest<any>('/transfers/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!clearRes.success) {
      throw new Error('Failed to clear transfers');
    }
    return `Initial queue count: ${tasks.length}`;
  });

  // Cleanup test workspace
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
    console.log('\nALL PHASE 1 CORE TESTS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
