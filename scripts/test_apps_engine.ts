import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { AppDiscovery } from '../server/applications/discovery.js';
import { AppFootprintAnalyzer } from '../server/applications/footprint.js';
import { AppUninstaller } from '../server/applications/uninstaller.js';
import {
  LargeFileFinder,
  EmptyFolderFinder,
  TempFileAnalyzer,
  FolderComparator,
  BatchRenameEngine,
  FileChecksumTool,
  StartupManager,
  DiskHardwareAnalyzer,
} from '../server/utilities/index.js';

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  durationMs: number;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

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
  console.log('================================================================');
  console.log('  Windows Applications & Storage Intelligence QA Test Suite     ');
  console.log('================================================================\n');

  // Test 1: Real Application Discovery
  let discoveredApps: any[] = [];
  await runTest('Discovery', 'Discover Real Installed Apps (Registry & AppX)', async () => {
    discoveredApps = await AppDiscovery.getInstalledApplications(true);
    if (discoveredApps.length === 0) throw new Error('No installed applications discovered');
    const running = discoveredApps.filter((a) => a.isRunning).length;
    return `Discovered ${discoveredApps.length} applications (${running} currently running)`;
  });

  // Test 2: Real Footprint Analyzer
  await runTest('Footprint', 'Measure Real On-Disk Footprint (No Registry Estimates)', async () => {
    // Pick an app with an install location
    const appWithLoc = discoveredApps.find((a) => a.installLocation && fsSync.existsSync(a.installLocation)) || discoveredApps[0];
    if (!appWithLoc) throw new Error('No application found for footprint measurement');

    const breakdown = await AppFootprintAnalyzer.measureApplicationFootprint(appWithLoc);
    if (breakdown.totalMeasuredFootprint <= 0 && breakdown.locations.length === 0) {
      throw new Error('Footprint returned 0 bytes and 0 locations');
    }
    return `Measured '${appWithLoc.displayName}': ${breakdown.formattedTotalMeasuredFootprint} across ${breakdown.locations.length} locations (${breakdown.totalFiles} files)`;
  });

  // Test 3: Application File Tree (Explore Application Files)
  await runTest('FileTree', 'Explore Application Files Hierarchical Tree', async () => {
    const appWithLoc = discoveredApps.find((a) => a.installLocation && fsSync.existsSync(a.installLocation)) || discoveredApps[0];
    const tree = await AppFootprintAnalyzer.getApplicationFileTree(appWithLoc, 2);
    if (!Array.isArray(tree)) throw new Error('Tree root was not an array');
    return `Generated tree with ${tree.length} root directories for '${appWithLoc.displayName}'`;
  });

  // Test 4: Largest Application Files
  await runTest('LargestFiles', 'Identify Largest Executables, DLLs & Assets in App', async () => {
    const appWithLoc = discoveredApps.find((a) => a.installLocation && fsSync.existsSync(a.installLocation)) || discoveredApps[0];
    const largest = await AppFootprintAnalyzer.getApplicationLargestFiles(appWithLoc, 10);
    return `Identified top ${largest.length} files. Largest: ${largest[0]?.name || 'N/A'} (${largest[0]?.formattedSize || '0 B'})`;
  });

  // Test 5: Deep Uninstall Preparation & Leftover Discovery
  await runTest('Uninstaller', 'Build Deep Removal Plan & Leftover Mapping', async () => {
    const appWithLoc = discoveredApps.find((a) => a.installLocation && fsSync.existsSync(a.installLocation)) || discoveredApps[0];
    const plan = await AppUninstaller.prepareUninstallPlan(appWithLoc);
    if (!plan.preUninstallBreakdown) throw new Error('Plan missing footprint breakdown');
    return `Prepared removal plan for '${appWithLoc.displayName}' with ${plan.leftoverCandidates.length} inventory candidates`;
  });

  // Test 6: System Utilities - Large File Finder
  await runTest('Utilities', 'Large File Finder (>50MB scan)', async () => {
    const files = await LargeFileFinder.findLargeFiles('C:\\Windows', 50 * 1024 * 1024, 10);
    return `Found ${files.length} files > 50MB in C:\\Windows`;
  });

  // Test 7: System Utilities - Temp Cleaner
  await runTest('Utilities', 'Temporary Storage Analyzer', async () => {
    const tempInfo = await TempFileAnalyzer.scanTempFiles();
    return `Detected ${tempInfo.formattedTotalBytes} reclaimable temp files across ${tempInfo.categories.length} categories`;
  });

  // Test 8: System Utilities - File Checksums
  await runTest('Utilities', 'File Checksum Tool (MD5, SHA-1, SHA-256, SHA-512)', async () => {
    const testFile = path.resolve('package.json');
    const hashes = await FileChecksumTool.computeChecksums(testFile);
    if (!hashes.sha256 || !hashes.md5) throw new Error('Checksum computation failed');
    return `SHA-256: ${hashes.sha256.slice(0, 16)}... | MD5: ${hashes.md5.slice(0, 16)}...`;
  });

  // Test 9: System Utilities - Startup Manager
  await runTest('Utilities', 'Startup Application Analyzer', async () => {
    const startup = await StartupManager.getStartupItems();
    return `Detected ${startup.length} Windows startup entries`;
  });

  // Test 10: System Utilities - Hardware & Drive Health
  await runTest('Utilities', 'Disk & Hardware Drive Health Analyzer', async () => {
    const disks = await DiskHardwareAnalyzer.getDisksInfo();
    if (disks.length === 0) throw new Error('No physical disk drives detected');
    return `Detected ${disks.length} physical disk(s). Primary: ${disks[0].model} (${disks[0].formattedSize}, ${disks[0].status})`;
  });

  console.log('\n================================================================');
  console.log('                      TEST SUMMARY                              ');
  console.log('================================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================');

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
