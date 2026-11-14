import React, { useState, useEffect } from 'react';
import {
  Wrench,
  HardDrive,
  FolderMinus,
  FileQuestion,
  GitCompare,
  Edit3,
  Hash,
  Power,
  Trash2,
  ExternalLink,
  RotateCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Play,
  ArrowRight,
  ShieldCheck,
  Zap,
  Terminal,
  RotateCcw,
  Check,
  FolderOpen,
  Download,
} from 'lucide-react';
import {
  LargeFileItem,
  EmptyFolderItem,
  TempCategoryItem,
  FolderComparisonResult,
  RenameRule,
  RenameItemPreview,
  StartupItem,
  DiskHardwareInfo,
  RecycleBinItem,
  DevCleanerItem,
} from '../../types';
import { formatBytes, formatNumber } from '../../utils/formatters';
import { ApiService } from '../../services/api';

interface SystemUtilitiesViewProps {
  currentPath: string;
  onRevealItem: (path: string) => void;
  onTrashItem: (path: string) => void;
  isDarkMode: boolean;
}

type UtilityTab =
  | 'large_files'
  | 'empty_folders'
  | 'temp_cleaner'
  | 'dev_cleaner'
  | 'recycle_bin'
  | 'folder_compare'
  | 'batch_rename'
  | 'checksum'
  | 'startup'
  | 'disk_health';

export const SystemUtilitiesView: React.FC<SystemUtilitiesViewProps> = ({
  currentPath,
  onRevealItem,
  onTrashItem,
  isDarkMode,
}) => {
  const [activeTab, setActiveTab] = useState<UtilityTab>('large_files');
  const [isLoading, setIsLoading] = useState(false);

  // 1. Large Files State
  const [largeFiles, setLargeFiles] = useState<LargeFileItem[]>([]);
  const [largeThreshold, setLargeThreshold] = useState<number>(100 * 1024 * 1024); // 100 MB

  // 2. Empty Folders State
  const [emptyFolders, setEmptyFolders] = useState<EmptyFolderItem[]>([]);
  const [selectedEmptyFolders, setSelectedEmptyFolders] = useState<Set<string>>(new Set());

  // 3. Temp Cleaner State
  const [tempData, setTempData] = useState<{ totalBytes: number; formattedTotalBytes: string; categories: TempCategoryItem[] } | null>(null);

  // 4. Folder Compare State
  const [comparePathA, setComparePathA] = useState(currentPath);
  const [comparePathB, setComparePathB] = useState('');
  const [compareResult, setCompareResult] = useState<FolderComparisonResult | null>(null);

  // 5. Batch Rename State
  const [renameRule, setRenameRule] = useState<RenameRule>({ type: 'numbering', startNumber: 1, digits: 2 });
  const [renamePreviews, setRenamePreviews] = useState<RenameItemPreview[]>([]);

  // 6. Checksum State
  const [checksumPath, setChecksumPath] = useState('');
  const [checksumResult, setChecksumResult] = useState<any | null>(null);

  // 7. Startup Items State
  const [startupItems, setStartupItems] = useState<StartupItem[]>([]);

  // 8. Disk Health State
  const [disksInfo, setDisksInfo] = useState<DiskHardwareInfo[]>([]);

  // 9. Dev Cleaner State
  const [devItems, setDevItems] = useState<DevCleanerItem[]>([]);
  const [devTotalBytes, setDevTotalBytes] = useState(0);
  const [devFormattedTotal, setDevFormattedTotal] = useState('0 B');
  const [devSearchRoot, setDevSearchRoot] = useState(currentPath);
  const [devEcosystemFilter, setDevEcosystemFilter] = useState<string>('all');
  const [selectedDevPaths, setSelectedDevPaths] = useState<Set<string>>(new Set());
  const [isCleaningDev, setIsCleaningDev] = useState(false);

  // 10. Recycle Bin State
  const [recycleBinItems, setRecycleBinItems] = useState<RecycleBinItem[]>([]);
  const [recycleBinTotalBytes, setRecycleBinTotalBytes] = useState(0);
  const [recycleBinFormattedTotal, setRecycleBinFormattedTotal] = useState('0 B');
  const [recycleBinSearch, setRecycleBinSearch] = useState('');
  const [restoringItem, setRestoringItem] = useState<string | null>(null);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const [isEmptyingBin, setIsEmptyingBin] = useState(false);

  // Initial Load based on tab
  useEffect(() => {
    if (activeTab === 'large_files') {
      runLargeFileScan();
    } else if (activeTab === 'temp_cleaner') {
      runTempScan();
    } else if (activeTab === 'dev_cleaner') {
      runDevCleanerScan(devSearchRoot);
    } else if (activeTab === 'recycle_bin') {
      runRecycleBinScan();
    } else if (activeTab === 'startup') {
      runStartupScan();
    } else if (activeTab === 'disk_health') {
      runDiskScan();
    }
  }, [activeTab]);

  const runLargeFileScan = async () => {
    setIsLoading(true);
    try {
      const data = await ApiService.getLargeFiles(currentPath, largeThreshold);
      setLargeFiles(data.files || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const runEmptyFolderScan = async () => {
    setIsLoading(true);
    try {
      const data = await ApiService.getEmptyFolders(currentPath);
      setEmptyFolders(data.folders || []);
      setSelectedEmptyFolders(new Set(data.folders.map((f) => f.path)));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanEmptyFolders = async () => {
    const toClean = Array.from(selectedEmptyFolders);
    if (toClean.length === 0) return;
    setIsLoading(true);
    try {
      await ApiService.cleanEmptyFolders(toClean);
      await runEmptyFolderScan();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const runTempScan = async () => {
    setIsLoading(true);
    try {
      const data = await ApiService.getTempFiles();
      setTempData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanTempCategory = async (dirPath: string) => {
    setIsLoading(true);
    try {
      await ApiService.cleanTempCategory(dirPath);
      await runTempScan();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const runFolderCompare = async () => {
    if (!comparePathA || !comparePathB) return;
    setIsLoading(true);
    try {
      const data = await ApiService.compareFolders(comparePathA, comparePathB);
      setCompareResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const runChecksum = async () => {
    if (!checksumPath) return;
    setIsLoading(true);
    try {
      const data = await ApiService.getFileChecksum(checksumPath);
      setChecksumResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const runStartupScan = async () => {
    setIsLoading(true);
    try {
      const data = await ApiService.getStartupItems();
      setStartupItems(data.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const [startupFilter, setStartupFilter] = useState<string>('all');

  const handleToggleStartup = async (item: StartupItem) => {
    try {
      await ApiService.toggleStartupItem(item, !item.isEnabled);
      setStartupItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isEnabled: !i.isEnabled } : i))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportStartup = async (format: 'csv' | 'json') => {
    try {
      const content = await ApiService.exportStartup(format);
      const mime = format === 'json' ? 'application/json' : 'text/csv';
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `startup-inventory-${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const handleOpenStartupLocation = async (itemPath?: string) => {
    if (!itemPath) return;
    await ApiService.openStartupLocation(itemPath);
  };

  const runDiskScan = async () => {
    setIsLoading(true);
    try {
      const data = await ApiService.getDisksHardwareInfo();
      setDisksInfo(data.disks || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // 9. Dev Cleaner Handlers
  const runDevCleanerScan = async (targetPath = devSearchRoot) => {
    setIsLoading(true);
    try {
      const data = await ApiService.getDevCaches(targetPath);
      setDevItems(data.items || []);
      setDevTotalBytes(data.totalBytes || 0);
      setDevFormattedTotal(data.formattedTotalBytes || '0 B');
      setSelectedDevPaths(new Set((data.items || []).map((i) => i.path)));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSelectDev = (p: string) => {
    setSelectedDevPaths((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const handleToggleAllDev = () => {
    if (selectedDevPaths.size === filteredDevItems.length) {
      setSelectedDevPaths(new Set());
    } else {
      setSelectedDevPaths(new Set(filteredDevItems.map((i) => i.path)));
    }
  };

  const handleCleanSelectedDev = async () => {
    if (selectedDevPaths.size === 0) return;
    setIsCleaningDev(true);
    try {
      await ApiService.cleanDevCaches(Array.from(selectedDevPaths));
      await runDevCleanerScan(devSearchRoot);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCleaningDev(false);
    }
  };

  // 10. Recycle Bin Handlers
  const runRecycleBinScan = async () => {
    setIsLoading(true);
    try {
      const data = await ApiService.getRecycleBin();
      setRecycleBinItems(data.items || []);
      setRecycleBinTotalBytes(data.totalBytes || 0);
      setRecycleBinFormattedTotal(data.formattedTotalBytes || '0 B');
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreRecycleBinItem = async (name: string) => {
    setRestoringItem(name);
    try {
      await ApiService.restoreRecycleBinItem(name);
      await runRecycleBinScan();
    } catch (err) {
      console.error(err);
    } finally {
      setRestoringItem(null);
    }
  };

  const handleEmptyRecycleBin = async () => {
    setIsEmptyingBin(true);
    try {
      await ApiService.emptyRecycleBin();
      setShowEmptyConfirm(false);
      await runRecycleBinScan();
    } catch (err) {
      console.error(err);
    } finally {
      setIsEmptyingBin(false);
    }
  };

  const filteredDevItems = devItems.filter((i) => {
    if (devEcosystemFilter === 'all') return true;
    return i.ecosystem.toLowerCase() === devEcosystemFilter.toLowerCase();
  });

  const filteredRecycleBinItems = recycleBinItems.filter((i) => {
    if (!recycleBinSearch.trim()) return true;
    const q = recycleBinSearch.toLowerCase();
    return i.name.toLowerCase().includes(q) || i.originalLocation.toLowerCase().includes(q);
  });

  return (
    <div
      className={`flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar select-none transition-colors ${
        isDarkMode ? 'bg-[#121316] text-[#E3E2E6]' : 'bg-[#F4F5F8] text-[#191C1E]'
      }`}
    >
      <div className="max-w-6xl mx-auto space-y-6 animate-oneui-fade">
        {/* Page Title */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">System & Storage Utilities</h1>
          <p className="mt-1 text-sm opacity-70">
            Advanced Windows maintenance tools: large file detection, empty folder removal, temporary cleanup, directory comparison, and hardware health.
          </p>
        </div>

        {/* Multi-Tool One UI Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
          {[
            { id: 'large_files', label: 'Large Files', icon: HardDrive },
            { id: 'empty_folders', label: 'Empty Folders', icon: FolderMinus },
            { id: 'temp_cleaner', label: 'Temporary Files', icon: Zap },
            { id: 'dev_cleaner', label: 'Build & Dev Caches', icon: Terminal },
            { id: 'recycle_bin', label: 'Recycle Bin', icon: Trash2 },
            { id: 'folder_compare', label: 'Folder Compare', icon: GitCompare },
            { id: 'checksum', label: 'File Checksums', icon: Hash },
            { id: 'startup', label: 'Startup Apps', icon: Power },
            { id: 'disk_health', label: 'Drive & Hardware', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as UtilityTab)}
                className={`px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all border ${
                  isSelected
                    ? 'bg-[#0072DE] text-white border-[#0072DE] shadow-xs'
                    : isDarkMode
                    ? 'bg-[#1C1D22] text-slate-300 border-white/[0.06] hover:bg-white/[0.06]'
                    : 'bg-white text-slate-700 border-black/[0.05] hover:bg-slate-50 shadow-xs'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        {activeTab === 'large_files' && (
          <div className="space-y-4">
            {/* Threshold Selector */}
            <div
              className={`p-4 rounded-3xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
              }`}
            >
              <div>
                <span className="text-xs font-bold uppercase tracking-wider opacity-60 block">Size Threshold</span>
                <span className="text-xs opacity-70">Showing files exceeding selected footprint in {currentPath}</span>
              </div>

              <div className="flex items-center gap-2">
                {[
                  { label: '> 100 MB', bytes: 100 * 1024 * 1024 },
                  { label: '> 500 MB', bytes: 500 * 1024 * 1024 },
                  { label: '> 1 GB', bytes: 1024 * 1024 * 1024 },
                  { label: '> 5 GB', bytes: 5 * 1024 * 1024 * 1024 },
                ].map((th) => (
                  <button
                    key={th.label}
                    onClick={() => {
                      setLargeThreshold(th.bytes);
                      runLargeFileScan();
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      largeThreshold === th.bytes
                        ? 'bg-[#0072DE] text-white'
                        : isDarkMode
                        ? 'bg-white/[0.04] text-slate-300'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {th.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            {isLoading ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 rounded-full border-2 border-[#0072DE]/20 border-t-[#0072DE] animate-spin mx-auto mb-2" />
                <span className="text-xs opacity-60">Scanning for large files...</span>
              </div>
            ) : largeFiles.length === 0 ? (
              <div className="py-16 text-center text-xs opacity-60">
                No files found exceeding {formatBytes(largeThreshold)}
              </div>
            ) : (
              <div
                className={`rounded-3xl border divide-y overflow-hidden ${
                  isDarkMode
                    ? 'bg-[#1C1D22] border-white/[0.06] divide-white/[0.04]'
                    : 'bg-white border-black/[0.05] divide-black/[0.04] shadow-xs'
                }`}
              >
                {largeFiles.map((file, idx) => (
                  <div key={file.id} className="p-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="font-mono text-xs opacity-40 w-5">{idx + 1}</span>
                      <HardDrive className="w-4 h-4 text-[#0072DE] shrink-0" />
                      <div className="truncate">
                        <span className="text-xs font-bold block truncate">{file.name}</span>
                        <span className="text-[10px] font-mono opacity-50 truncate block">{file.path}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-mono font-bold">{file.formattedSize}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onRevealItem(file.path)}
                          className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 opacity-70"
                          title="Reveal in Explorer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onTrashItem(file.path)}
                          className="p-1.5 rounded-full hover:bg-red-500/15 text-red-500"
                          title="Move to Recycle Bin"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Empty Folders */}
        {activeTab === 'empty_folders' && (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-3xl border flex items-center justify-between ${
                isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
              }`}
            >
              <div>
                <span className="text-xs font-bold uppercase tracking-wider opacity-60 block">Empty Folders</span>
                <span className="text-xs opacity-70">
                  Detected {emptyFolders.length} genuinely empty directories in {currentPath}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={runEmptyFolderScan}
                  className="px-4 py-2 rounded-full text-xs font-bold border border-black/10 dark:border-white/10"
                >
                  Scan Now
                </button>
                {emptyFolders.length > 0 && (
                  <button
                    onClick={handleCleanEmptyFolders}
                    className="px-4 py-2 rounded-full bg-red-500 text-white text-xs font-bold"
                  >
                    Clean Selected ({selectedEmptyFolders.size})
                  </button>
                )}
              </div>
            </div>

            {emptyFolders.length > 0 && (
              <div
                className={`rounded-3xl border divide-y overflow-hidden max-h-96 overflow-y-auto custom-scrollbar ${
                  isDarkMode
                    ? 'bg-[#1C1D22] border-white/[0.06] divide-white/[0.04]'
                    : 'bg-white border-black/[0.05] divide-black/[0.04] shadow-xs'
                }`}
              >
                {emptyFolders.map((ef) => (
                  <div key={ef.path} className="p-3 flex items-center justify-between text-xs">
                    <span className="font-mono truncate">{ef.path}</span>
                    <button
                      onClick={() => onTrashItem(ef.path)}
                      className="p-1 rounded-full text-red-500 hover:bg-red-500/10"
                      title="Move to Recycle Bin"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Temp Cleaner */}
        {activeTab === 'temp_cleaner' && (
          <div className="space-y-4">
            <div
              className={`p-6 rounded-3xl border flex items-center justify-between ${
                isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
              }`}
            >
              <div>
                <span className="text-xs font-bold uppercase tracking-wider opacity-60 block">Reclaimable Temporary Storage</span>
                <span className="text-2xl font-extrabold font-mono text-[#0072DE] dark:text-[#5B95FF] mt-1 block">
                  {tempData?.formattedTotalBytes || '0 B'}
                </span>
              </div>

              <button
                onClick={runTempScan}
                className="px-4 py-2 rounded-full text-xs font-bold border border-black/10 dark:border-white/10 flex items-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Rescan</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tempData?.categories.map((cat) => (
                <div
                  key={cat.id}
                  className={`p-5 rounded-3xl border flex items-center justify-between gap-4 ${
                    isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
                  }`}
                >
                  <div className="truncate">
                    <span className="text-xs font-bold block">{cat.label}</span>
                    <span className="text-[10px] font-mono opacity-50 truncate block mt-0.5" title={cat.path}>
                      {cat.path}
                    </span>
                    <span className="text-sm font-extrabold font-mono text-[#0072DE] dark:text-[#5B95FF] mt-1 block">
                      {cat.formattedSize}
                    </span>
                  </div>

                  <button
                    onClick={() => handleCleanTempCategory(cat.path)}
                    disabled={cat.size === 0}
                    className="px-4 py-2 rounded-full bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white text-xs font-bold shrink-0"
                  >
                    Clean
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Development & Build Cache Cleaner (Section 12) */}
        {activeTab === 'dev_cleaner' && (
          <div className="space-y-4">
            {/* Overview Banner Card */}
            <div
              className={`p-6 rounded-3xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                isDarkMode ? 'bg-[#1C1D22] border-white/[0.06] shadow-sm' : 'bg-white border-black/[0.05] shadow-xs'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#0072DE]/15 text-[#0072DE] flex items-center justify-center shrink-0">
                  <Terminal className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold">Build & Development Caches</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981]">
                      Safe Clean
                    </span>
                  </div>
                  <p className="text-xs opacity-70 mt-0.5">
                    Found {devItems.length} project caches consuming{' '}
                    <strong className="text-[#0072DE] dark:text-[#5B95FF] font-mono text-sm">
                      {devFormattedTotal}
                    </strong>
                    . Git history and project sources are strictly preserved.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  onClick={handleToggleAllDev}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                    isDarkMode
                      ? 'bg-white/[0.06] hover:bg-white/[0.1] text-white border-white/[0.06]'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-black/[0.05]'
                  }`}
                >
                  {selectedDevPaths.size === filteredDevItems.length ? 'Deselect All' : 'Select All'}
                </button>

                <button
                  onClick={handleCleanSelectedDev}
                  disabled={selectedDevPaths.size === 0 || isCleaningDev}
                  className="px-5 py-2 rounded-full bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  {isCleaningDev ? (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>Recycle Caches ({selectedDevPaths.size})</span>
                </button>
              </div>
            </div>

            {/* Scan Search Path & Ecosystem Filters */}
            <div
              className={`p-4 rounded-3xl border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 ${
                isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
              }`}
            >
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={devSearchRoot}
                  onChange={(e) => setDevSearchRoot(e.target.value)}
                  placeholder="Root folder to scan for dev caches..."
                  className="flex-1 h-9 px-3 rounded-full border border-black/10 dark:border-white/10 bg-transparent text-xs font-mono outline-none"
                />
                <button
                  onClick={() => runDevCleanerScan(devSearchRoot)}
                  className="px-4 py-2 rounded-full bg-[#0072DE] text-white text-xs font-bold hover:bg-[#005bb5] transition-all flex items-center gap-1.5 shrink-0"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Scan</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                {['all', 'Node.js', 'Python', 'Rust', 'Flutter', 'Java', '.NET'].map((eco) => {
                  const isSel = devEcosystemFilter.toLowerCase() === eco.toLowerCase();
                  return (
                    <button
                      key={eco}
                      onClick={() => setDevEcosystemFilter(eco)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        isSel
                          ? 'bg-[#0072DE] text-white'
                          : isDarkMode
                          ? 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {eco === 'all' ? 'All Stacks' : eco}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Items List */}
            {isLoading ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 rounded-full border-2 border-[#0072DE]/20 border-t-[#0072DE] animate-spin mx-auto mb-2" />
                <span className="text-xs opacity-60">Scanning for development & build caches...</span>
              </div>
            ) : filteredDevItems.length === 0 ? (
              <div
                className={`p-12 text-center rounded-3xl border ${
                  isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05]'
                }`}
              >
                <CheckCircle2 className="w-12 h-12 text-[#10B981] mx-auto mb-3 stroke-1" />
                <span className="text-base font-bold block">No Development Bloat Found</span>
                <span className="text-xs opacity-60 mt-1 block">
                  Scanned path has no detected node_modules, build targets, or compiler caches.
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDevItems.map((item) => {
                  const isSelected = selectedDevPaths.has(item.path);
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleToggleSelectDev(item.path)}
                      className={`p-4 rounded-3xl border flex items-center justify-between gap-4 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#0072DE]/10 border-[#0072DE]/40'
                          : isDarkMode
                          ? 'bg-[#1C1D22] border-white/[0.06] hover:border-white/20'
                          : 'bg-white border-black/[0.05] hover:border-black/20 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded-full text-[#0072DE] focus:ring-0 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm truncate">{item.projectName}</span>
                            <span className="text-xs font-mono opacity-60 font-semibold">/{item.name}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10">
                              {item.ecosystem}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                              {item.cleanupRisk} Risk
                            </span>
                          </div>
                          <span className="text-[11px] font-mono opacity-50 truncate block mt-0.5" title={item.path}>
                            {item.path}
                          </span>
                          <span className="text-[11px] opacity-70 block mt-1">
                            {item.regenerationHint}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-sm font-extrabold font-mono text-[#0072DE] dark:text-[#5B95FF] block">
                            {item.formattedSize}
                          </span>
                          <span className="text-[10px] opacity-50 block font-mono">{formatNumber(item.fileCount)} files</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRevealItem(item.path);
                          }}
                          className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                          title="Reveal folder in explorer"
                        >
                          <ExternalLink className="w-4 h-4 opacity-60" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab: Windows Recycle Bin Manager (Section 14) */}
        {activeTab === 'recycle_bin' && (
          <div className="space-y-4">
            {/* Overview Banner Card */}
            <div
              className={`p-6 rounded-3xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                isDarkMode ? 'bg-[#1C1D22] border-white/[0.06] shadow-sm' : 'bg-white border-black/[0.05] shadow-xs'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-red-500/15 text-red-500 flex items-center justify-center shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold">Windows Recycle Bin</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500">
                      Shell COM
                    </span>
                  </div>
                  <p className="text-xs opacity-70 mt-0.5">
                    {recycleBinItems.length} deleted items occupying{' '}
                    <strong className="text-red-500 font-mono text-sm">{recycleBinFormattedTotal}</strong> of storage across all drives.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  onClick={runRecycleBinScan}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
                    isDarkMode
                      ? 'bg-white/[0.06] hover:bg-white/[0.1] text-white border-white/[0.06]'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-black/[0.05]'
                  }`}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={() => setShowEmptyConfirm(true)}
                  disabled={recycleBinItems.length === 0}
                  className="px-5 py-2 rounded-full bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Empty Recycle Bin</span>
                </button>
              </div>
            </div>

            {/* Filter / Search Bar */}
            <div
              className={`p-3 rounded-2xl border flex items-center gap-2.5 ${
                isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
              }`}
            >
              <Search className="w-4 h-4 opacity-50 ml-2" />
              <input
                type="text"
                value={recycleBinSearch}
                onChange={(e) => setRecycleBinSearch(e.target.value)}
                placeholder="Filter deleted files by name or original path..."
                className="w-full bg-transparent text-xs outline-none"
              />
            </div>

            {/* Empty Confirmation Modal */}
            {showEmptyConfirm && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div
                  className={`w-full max-w-md p-6 rounded-3xl border space-y-4 animate-oneui-fade shadow-2xl ${
                    isDarkMode ? 'bg-[#1C1D22] border-white/10 text-white' : 'bg-white border-black/10 text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-red-500/15 text-red-500 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">Empty Windows Recycle Bin?</h3>
                      <p className="text-xs opacity-70">
                        This action will permanently delete all {recycleBinItems.length} items from all drives.
                      </p>
                    </div>
                  </div>

                  <p className="text-xs opacity-60">
                    Items cannot be recovered once permanently cleared from the Windows Recycle Bin.
                  </p>

                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <button
                      onClick={() => setShowEmptyConfirm(false)}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                        isDarkMode ? 'bg-white/5 hover:bg-white/10 text-white border-white/10' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEmptyRecycleBin}
                      disabled={isEmptyingBin}
                      className="px-5 py-2 rounded-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                    >
                      {isEmptyingBin ? (
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>Empty Bin Permanently</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Items List */}
            {isLoading ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 rounded-full border-2 border-[#0072DE]/20 border-t-[#0072DE] animate-spin mx-auto mb-2" />
                <span className="text-xs opacity-60">Inspecting Windows Recycle Bin items via Shell COM...</span>
              </div>
            ) : filteredRecycleBinItems.length === 0 ? (
              <div
                className={`p-12 text-center rounded-3xl border ${
                  isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05]'
                }`}
              >
                <CheckCircle2 className="w-12 h-12 text-[#10B981] mx-auto mb-3 stroke-1" />
                <span className="text-base font-bold block">Recycle Bin is Clean</span>
                <span className="text-xs opacity-60 mt-1 block">
                  No deleted files currently reside in the Windows Recycle Bin.
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRecycleBinItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-3xl border flex items-center justify-between gap-4 transition-all ${
                      isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm truncate">{item.name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 opacity-70">
                          {item.type}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono opacity-50 truncate block mt-0.5" title={item.originalLocation}>
                        Original: {item.originalLocation}
                      </span>
                      {item.dateDeleted && (
                        <span className="text-[10px] opacity-40 block font-mono mt-0.5">
                          Deleted: {item.dateDeleted}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-mono font-bold text-red-500 block">
                        {item.formattedSize}
                      </span>
                      <button
                        onClick={() => handleRestoreRecycleBinItem(item.name)}
                        disabled={restoringItem === item.name}
                        className="px-3.5 py-1.5 rounded-full bg-[#0072DE]/15 hover:bg-[#0072DE]/25 text-[#0072DE] dark:text-[#5B95FF] text-xs font-bold transition-all flex items-center gap-1.5"
                        title="Restore to original location"
                      >
                        {restoringItem === item.name ? (
                          <div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        <span>Restore</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Folder Compare */}
        {activeTab === 'folder_compare' && (
          <div className="space-y-4">
            <div
              className={`p-6 rounded-3xl border space-y-4 ${
                isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
              }`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold opacity-60 block mb-1">Folder A</label>
                  <input
                    type="text"
                    value={comparePathA}
                    onChange={(e) => setComparePathA(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-black/10 dark:border-white/10 bg-transparent text-xs font-mono outline-none"
                    placeholder="C:\Folder1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold opacity-60 block mb-1">Folder B</label>
                  <input
                    type="text"
                    value={comparePathB}
                    onChange={(e) => setComparePathB(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-black/10 dark:border-white/10 bg-transparent text-xs font-mono outline-none"
                    placeholder="C:\Folder2"
                  />
                </div>
              </div>

              <button
                onClick={runFolderCompare}
                className="px-6 py-2.5 rounded-full bg-[#0072DE] text-white text-xs font-bold flex items-center gap-1.5"
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>Compare Directories</span>
              </button>
            </div>

            {compareResult && (
              <div
                className={`p-5 rounded-3xl border space-y-4 ${
                  isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05]'
                }`}
              >
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04]">
                    <span className="text-[10px] uppercase font-bold opacity-50 block">Only in Folder A</span>
                    <span className="text-lg font-bold font-mono">{compareResult.onlyInA.length}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04]">
                    <span className="text-[10px] uppercase font-bold opacity-50 block">Identical</span>
                    <span className="text-lg font-bold font-mono text-[#10B981]">{compareResult.identicalCount}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04]">
                    <span className="text-[10px] uppercase font-bold opacity-50 block">Only in Folder B</span>
                    <span className="text-lg font-bold font-mono">{compareResult.onlyInB.length}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: File Checksum Tool */}
        {activeTab === 'checksum' && (
          <div
            className={`p-6 rounded-3xl border space-y-4 ${
              isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
            }`}
          >
            <div>
              <label className="text-xs font-bold opacity-60 block mb-1">Target File Path</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={checksumPath}
                  onChange={(e) => setChecksumPath(e.target.value)}
                  placeholder="Enter full file path (e.g. C:\path\file.iso)"
                  className="flex-1 h-10 px-3 rounded-xl border border-black/10 dark:border-white/10 bg-transparent text-xs font-mono outline-none"
                />
                <button
                  onClick={runChecksum}
                  className="px-5 py-2.5 rounded-full bg-[#0072DE] text-white text-xs font-bold"
                >
                  Compute Hashes
                </button>
              </div>
            </div>

            {checksumResult && (
              <div className="space-y-3 pt-3">
                <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] space-y-2 text-xs font-mono">
                  <div>
                    <span className="opacity-50 block text-[10px]">SHA-256</span>
                    <span className="font-bold select-all break-all">{checksumResult.sha256}</span>
                  </div>
                  <div>
                    <span className="opacity-50 block text-[10px]">MD5</span>
                    <span className="font-bold select-all">{checksumResult.md5}</span>
                  </div>
                  <div>
                    <span className="opacity-50 block text-[10px]">SHA-1</span>
                    <span className="font-bold select-all">{checksumResult.sha1}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 6: Startup Manager (Section 20 & Phase 5) */}
        {activeTab === 'startup' && (
          <div className="space-y-4">
            {/* Header Banner Card */}
            <div
              className={`p-6 rounded-3xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                isDarkMode ? 'bg-[#1C1D22] border-white/[0.06] shadow-sm' : 'bg-white border-black/[0.05] shadow-xs'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                  <Power className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold">Windows Startup Manager</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500">
                      {startupItems.length} Registered
                    </span>
                  </div>
                  <p className="text-xs opacity-70 mt-0.5">
                    Manage apps, drivers, and background services scheduled to launch on Windows startup.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  onClick={() => handleExportStartup('csv')}
                  className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
                    isDarkMode
                      ? 'bg-white/[0.06] hover:bg-white/[0.1] text-white border-white/[0.06]'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-black/[0.05] shadow-xs'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={() => handleExportStartup('json')}
                  className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
                    isDarkMode
                      ? 'bg-white/[0.06] hover:bg-white/[0.1] text-white border-white/[0.06]'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-black/[0.05] shadow-xs'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>JSON</span>
                </button>
                <button
                  onClick={runStartupScan}
                  className={`p-2 rounded-full transition-all border ${
                    isDarkMode
                      ? 'bg-white/[0.06] hover:bg-white/[0.1] text-white border-white/[0.06]'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-black/[0.05] shadow-xs'
                  }`}
                  title="Rescan startup items"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Category Filter Toolbar */}
            <div
              className={`p-3 rounded-2xl border flex items-center gap-2 overflow-x-auto ${
                isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
              }`}
            >
              {['all', 'Security', 'Cloud & Sync', 'Audio/Hardware', 'Productivity', 'Utility', 'Other'].map((cat) => {
                const isSel = startupFilter.toLowerCase() === cat.toLowerCase();
                return (
                  <button
                    key={cat}
                    onClick={() => setStartupFilter(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                      isSel
                        ? 'bg-[#0072DE] text-white'
                        : isDarkMode
                        ? 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {cat === 'all' ? 'All Applications' : cat}
                  </button>
                );
              })}
            </div>

            {/* List */}
            {isLoading ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 rounded-full border-2 border-[#0072DE]/20 border-t-[#0072DE] animate-spin mx-auto mb-2" />
                <span className="text-xs opacity-60">Querying Windows Run keys & Startup Folders...</span>
              </div>
            ) : filteredStartupItems.length === 0 ? (
              <div
                className={`p-12 text-center rounded-3xl border ${
                  isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05]'
                }`}
              >
                <CheckCircle2 className="w-12 h-12 text-[#10B981] mx-auto mb-3 stroke-1" />
                <span className="text-base font-bold block">No Startup Items Found</span>
                <span className="text-xs opacity-60 mt-1 block">
                  No startup applications match the selected category filter.
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredStartupItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-3xl border flex items-center justify-between gap-4 transition-all ${
                      isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm truncate">{item.name}</span>
                        {item.category && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                            {item.category}
                          </span>
                        )}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 opacity-70">
                          {item.source.replace('_', ' ')}
                        </span>
                        {item.formattedSize && (
                          <span className="text-[10px] font-mono opacity-50">
                            {item.formattedSize}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono opacity-50 truncate block mt-0.5" title={item.command}>
                        {item.command}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {item.resolvedExePath && (
                        <button
                          onClick={() => handleOpenStartupLocation(item.resolvedExePath)}
                          className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                          title="Open location in Windows Explorer"
                        >
                          <FolderOpen className="w-4 h-4 opacity-60" />
                        </button>
                      )}

                      <button
                        onClick={() => handleToggleStartup(item)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs ${
                          item.isEnabled
                            ? 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25'
                            : 'bg-slate-500/15 text-slate-400 hover:bg-slate-500/25'
                        }`}
                      >
                        {item.isEnabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 7: Drive & Hardware Health */}
        {activeTab === 'disk_health' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {disksInfo.map((disk) => (
              <div
                key={disk.deviceId}
                className={`p-6 rounded-3xl border space-y-4 ${
                  isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-[#0072DE]/15 text-[#0072DE] flex items-center justify-center">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                      disk.health === 'healthy'
                        ? 'bg-[#10B981]/15 text-[#10B981]'
                        : 'bg-[#F59E0B]/15 text-[#F59E0B]'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${disk.health === 'healthy' ? 'bg-[#10B981]' : 'bg-[#F59E0B]'}`} />
                    {disk.status}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-base">{disk.model}</h3>
                  <span className="text-xs font-mono opacity-60">
                    {disk.interfaceType} • {disk.mediaType}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04]">
                    <span className="text-[10px] uppercase font-bold opacity-50 block">Capacity</span>
                    <span className="font-bold text-sm text-[#0072DE]">{disk.formattedSize}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04]">
                    <span className="text-[10px] uppercase font-bold opacity-50 block">Partitions</span>
                    <span className="font-bold text-sm">{disk.partitions}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
