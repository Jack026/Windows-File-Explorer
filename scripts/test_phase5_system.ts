import http from 'http';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
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
  console.log(' PHASE 5 AUTOMATED TEST SUITE: SYSTEM, PERMISSIONS & SETTINGS');
  console.log('===============================================================\n');

  await delay(1000); // Allow server to initialize

  // ------------------------------------------------------------------
  // 1. Permissions & Access Control Analyzer Tests
  // ------------------------------------------------------------------
  await runTest('Permissions', 'Inspect Win32 Access Control Lists on C:\\Windows', async () => {
    const { data } = await apiRequest<any>('/permissions?path=C:\\Windows');
    if (!data.owner) throw new Error('Owner missing from report');
    if (typeof data.canRead !== 'boolean') throw new Error('canRead boolean missing');
    if (!Array.isArray(data.accessRules)) throw new Error('accessRules array missing');

    return `Owner: ${data.owner}, CanRead: ${data.canRead}, CanWrite: ${data.canWrite}, Rules: ${data.accessRules.length}`;
  });

  await runTest('Permissions', 'Inspect user home directory permissions & write accessibility', async () => {
    const userDir = os.homedir();
    const { data } = await apiRequest<any>(`/permissions?path=${encodeURIComponent(userDir)}`);
    if (!data.canRead) throw new Error('User home directory should be readable');

    return `Owner: ${data.owner}, Full Access: ${data.canRead && data.canWrite}`;
  });

  await runTest('Permissions', 'Export Access Control List as CSV & JSON', async () => {
    const csvRes = await fetch(`${API_BASE}/permissions/export?path=C:\\Windows&format=csv`);
    if (!csvRes.ok) throw new Error('CSV export failed');
    const csvText = await csvRes.text();
    if (!csvText.startsWith('Path,Owner')) throw new Error('CSV header malformed');

    const jsonRes = await fetch(`${API_BASE}/permissions/export?path=C:\\Windows&format=json`);
    if (!jsonRes.ok) throw new Error('JSON export failed');
    const jsonData = await jsonRes.json();
    if (!jsonData.path) throw new Error('JSON export malformed');

    return `Exported ${csvText.split('\n').length} CSV lines and verified structured JSON format`;
  });

  // ------------------------------------------------------------------
  // 2. Enhanced Windows Startup Manager Tests
  // ------------------------------------------------------------------
  await runTest('Startup Manager', 'Query Startup entries with publisher and categorization', async () => {
    const { data } = await apiRequest<{ items: any[]; count: number }>('/utils/startup');
    if (!Array.isArray(data.items)) throw new Error('Expected items array');

    const categories = new Set(data.items.map((i) => i.category || 'Other'));
    return `Retrieved ${data.items.length} startup items across [${Array.from(categories).join(', ')}]`;
  });

  await runTest('Startup Manager', 'Export Startup Inventory as CSV and JSON', async () => {
    const csvRes = await fetch(`${API_BASE}/startup/export?format=csv`);
    if (!csvRes.ok) throw new Error('CSV export failed');
    const csvText = await csvRes.text();
    if (!csvText.startsWith('Name,Category')) throw new Error('CSV header malformed');

    const jsonRes = await fetch(`${API_BASE}/startup/export?format=json`);
    if (!jsonRes.ok) throw new Error('JSON export failed');
    const jsonData = await jsonRes.json();
    if (!Array.isArray(jsonData)) throw new Error('JSON format invalid');

    return `Exported ${jsonData.length} startup records cleanly`;
  });

  // ------------------------------------------------------------------
  // 3. Drive Hardware & Non-Destructive Benchmark Tests
  // ------------------------------------------------------------------
  await runTest('Drive Information', 'Query physical storage controllers, interface, and media types', async () => {
    const { data } = await apiRequest<{ disks: any[]; count: number }>('/utils/disks-info');
    if (!Array.isArray(data.disks) || data.disks.length === 0) throw new Error('No physical disks detected');
    const disk = data.disks[0];
    return `Hardware: ${disk.model} (${disk.mediaType}, ${disk.interfaceType}, Health: ${disk.health})`;
  });

  await runTest('Drive Benchmark', 'Execute safe non-destructive sequential read throughput benchmark', async () => {
    const { data } = await apiRequest<any>('/drives/benchmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drivePath: 'C:\\' }),
    });

    if (typeof data.readSpeedMBs !== 'number' || data.readSpeedMBs <= 0) {
      throw new Error(`Invalid benchmark read speed: ${data.readSpeedMBs}`);
    }

    return `Read Speed: ${data.formattedSpeed}, Latency: ${data.latencyMs}ms, Tested: ${data.formattedBytesRead} in ${data.testDurationMs}ms`;
  });

  // ------------------------------------------------------------------
  // 4. Global Settings & Preferences Tests
  // ------------------------------------------------------------------
  await runTest('Settings', 'Retrieve default global application settings', async () => {
    const { data } = await apiRequest<any>('/settings');
    if (!data.appearance || !data.explorer || !data.safety) {
      throw new Error('Incomplete settings sections');
    }
    return `Theme: ${data.appearance.theme}, Accent: ${data.appearance.accentColor}, RecycleBinDefault: ${data.safety.useRecycleBinByDefault}`;
  });

  await runTest('Settings', 'Update preferences and verify persistent storage on disk', async () => {
    const updates = {
      appearance: {
        theme: 'dark',
        accentColor: '#10B981',
        compactSpacing: true,
        animationsEnabled: true,
        sidebarExpanded: true,
      },
    };
    const { data: updated } = await apiRequest<any>('/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (updated.appearance.accentColor !== '#10B981') {
      throw new Error('Setting update did not take effect');
    }

    // Verify .cache/settings.json on disk
    const settingsPath = path.resolve(process.cwd(), '.cache', 'settings.json');
    if (!fsSync.existsSync(settingsPath)) {
      throw new Error('.cache/settings.json file was not created on disk');
    }
    const onDisk = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
    if (onDisk.appearance.accentColor !== '#10B981') {
      throw new Error('Disk file does not match saved setting value');
    }

    return 'Settings updated and confirmed written to persistent disk cache';
  });

  await runTest('Settings', 'Reset preferences to factory defaults and clear cache', async () => {
    const { data: reset } = await apiRequest<any>('/settings/reset', { method: 'POST' });
    if (reset.appearance.accentColor !== '#0072DE') {
      throw new Error('Failed to reset accent color to default');
    }

    const { data: clearRes } = await apiRequest<any>('/settings/clear-cache', { method: 'POST' });
    if (!clearRes.success) {
      throw new Error('Failed to clear cache');
    }

    return 'Factory defaults restored (#0072DE One UI Blue) and storage cache reset';
  });

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n---------------------------------------------------------------');
  console.log(` PHASE 5 TEST EXECUTION SUMMARY: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('---------------------------------------------------------------\n');

  if (failed > 0) {
    console.error(`ERROR: ${failed} tests failed!`);
    process.exit(1);
  } else {
    console.log('SUCCESS: All Phase 5 System, Permissions & Settings verified perfectly!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
