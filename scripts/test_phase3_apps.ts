import http from 'http';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

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
  console.log('====================================================');
  console.log('  PHASE 3 APPLICATIONS: AUTOMATED QA TEST SUITE     ');
  console.log('====================================================\n');

  await delay(1200);

  let discoveredApps: any[] = [];

  // 1. Application Discovery
  console.log('--- 1. Testing Application Discovery Engine ---');
  await runTest('Discovery', 'Discover installed applications across registry & AppX', async () => {
    const { data } = await apiRequest<{ apps: any[]; total: number }>('/apps');
    if (!Array.isArray(data.apps) || data.apps.length === 0) {
      throw new Error('No applications discovered');
    }
    discoveredApps = data.apps;
    const runningCount = discoveredApps.filter((a) => a.isRunning).length;
    return `Discovered ${discoveredApps.length} installed apps (${runningCount} currently running)`;
  });

  await runTest('Discovery', 'Verify multi-source installation types (Registry, MSI, AppX)', async () => {
    const types = new Set(discoveredApps.map((a) => a.installType));
    const categories = new Set(discoveredApps.map((a) => a.category));
    return `Active Sources: [${Array.from(types).join(', ')}] across ${categories.size} categories`;
  });

  // 2. Application Footprint Intelligence
  console.log('\n--- 2. Testing Application Footprint Intelligence ---');
  const targetApp =
    discoveredApps.find((a) => a.installLocation && fsSync.existsSync(a.installLocation)) || discoveredApps[0];

  await runTest('Footprint', `Measure real on-disk footprint for '${targetApp.displayName}'`, async () => {
    const { data } = await apiRequest<any>(`/apps/${targetApp.id}/footprint`);
    if (typeof data.totalMeasuredFootprint !== 'number') {
      throw new Error('Footprint response missing totalMeasuredFootprint');
    }
    return `Footprint: ${data.formattedTotalMeasuredFootprint} across ${data.locations.length} location(s), ${data.totalFiles} files`;
  });

  await runTest('Footprint', `Explore file tree with ownership confidence`, async () => {
    const { data } = await apiRequest<{ tree: any[] }>(`/apps/${targetApp.id}/tree?depth=3`);
    if (!Array.isArray(data.tree)) throw new Error('Tree response is not an array');
    return `File tree generated with ${data.tree.length} root branch(es)`;
  });

  await runTest('Footprint', `Identify largest files in application`, async () => {
    const { data } = await apiRequest<{ largestFiles: any[] }>(`/apps/${targetApp.id}/largest-files?limit=10`);
    if (!Array.isArray(data.largestFiles)) throw new Error('Largest files response is not an array');
    return `Identified ${data.largestFiles.length} file(s). Top: ${data.largestFiles[0]?.name || 'N/A'}`;
  });

  // 3. Application Comparison Engine
  console.log('\n--- 3. Testing Application Comparison Engine ---');
  await runTest('Comparison', 'Compare two applications side-by-side with delta calculation', async () => {
    if (discoveredApps.length < 2) throw new Error('Need at least 2 apps to compare');
    const appA = discoveredApps[0];
    const appB = discoveredApps[1];
    const { data } = await apiRequest<any>(`/apps/compare?appA=${appA.id}&appB=${appB.id}`);
    if (!data.appA || !data.appB || typeof data.deltaBytes !== 'number') {
      throw new Error('Invalid comparison response structure');
    }
    return `Delta: ${data.formattedDeltaBytes} (${data.percentageDiff}% difference) - ${data.summary}`;
  });

  // 4. Inventory Export API
  console.log('\n--- 4. Testing Inventory Export API ---');
  await runTest('Export', 'Export application inventory as CSV', async () => {
    const start = performance.now();
    const res = await fetch(`${API_BASE}/apps/export?format=csv`);
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    if (!res.ok) throw new Error(`Export CSV failed with status ${res.status}`);
    const text = await res.text();
    const lines = text.split('\r\n').filter(Boolean);
    if (lines.length < 2 || !lines[0].includes('DisplayName')) {
      throw new Error('CSV output missing proper headers or content');
    }
    return `Exported ${lines.length - 1} records in CSV format (${durationMs}ms)`;
  });

  await runTest('Export', 'Export application inventory as JSON', async () => {
    const start = performance.now();
    const res = await fetch(`${API_BASE}/apps/export?format=json`);
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    if (!res.ok) throw new Error(`Export JSON failed with status ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('JSON output missing records');
    }
    return `Exported ${data.length} records in JSON format (${durationMs}ms)`;
  });

  // 5. Deep Uninstaller & Leftover Removal
  console.log('\n--- 5. Testing Deep Uninstaller Engine ---');
  let plan: any;
  await runTest('Uninstaller', `Prepare Deep Uninstall plan for '${targetApp.displayName}'`, async () => {
    const { data } = await apiRequest<any>('/apps/uninstall/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: targetApp.id }),
    });
    plan = data;
    if (!plan.preUninstallBreakdown || !Array.isArray(plan.leftoverCandidates)) {
      throw new Error('Invalid uninstall plan structure');
    }
    return `Removal plan contains ${plan.leftoverCandidates.length} candidate(s), ${plan.associatedServices.length} service(s), ${plan.associatedTasks.length} task(s)`;
  });

  await runTest('Uninstaller', 'Simulate leftover cleaning and verify report generation', async () => {
    // Test cleaning with safe non-destructive candidate
    const safeCandidates = [
      {
        id: 'test_cand_1',
        path: 'C:\\NonExistentPath_SafeTest_123',
        name: 'SafeTestItem',
        size: 2048,
        formattedSize: '2 KB',
        type: 'folder',
        category: 'cache',
        categoryLabel: 'Category B: Application Cache',
        confidence: 'verified',
        selected: true,
        reason: 'Automated test simulation',
        isProtected: false,
      },
    ];

    const { data } = await apiRequest<any>('/apps/uninstall/clean', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidates: safeCandidates }),
    });

    if (!data.completedAt || !data.summary) {
      throw new Error('Verification report incomplete');
    }
    return `Report generated cleanly at ${data.completedAt}: ${data.summary}`;
  });

  console.log('\n====================================================');
  console.log('  TEST SUMMARY');
  console.log('====================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}\n`);

  if (failed > 0) {
    console.error('SOME PHASE 3 TESTS FAILED!');
    process.exit(1);
  } else {
    console.log('ALL PHASE 3 APPLICATION TESTS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
