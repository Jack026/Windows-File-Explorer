import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  PieChart,
  HardDrive,
  Folder,
  File,
  Zap,
  Trash2,
  ChevronRight,
  ExternalLink,
  RotateCw,
  Sparkles,
  ArrowUp,
  FileCode,
  FileVideo,
  FileArchive,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  Square,
  Gauge,
  Clock,
  Layers,
} from 'lucide-react';
import {
  StorageXRayReport,
  TreemapNode,
  FileCategory,
  BloatItem,
  FileItem,
  ScanMode,
  ScanStatus,
  ScanProgress,
} from '../types';
import { formatBytes, formatNumber } from '../utils/formatters';
import { CATEGORY_COLORS } from '../utils/categories';
import { computeSquarifiedTreemap, LayoutRect } from '../utils/treemap';
import { ApiService } from '../services/api';

interface StorageXRayViewProps {
  currentPath: string;
  report: StorageXRayReport | null;
  isLoading: boolean;
  onRefresh: (mode?: ScanMode) => void;
  onNavigateToFolder: (path: string) => void;
  onCleanBloat: (items: BloatItem[]) => void;
  onRevealItem: (path: string) => void;
  onTrashItem: (path: string) => void;
  isDarkMode: boolean;
}

export const StorageXRayView: React.FC<StorageXRayViewProps> = ({
  currentPath,
  report,
  isLoading,
  onRefresh,
  onNavigateToFolder,
  onCleanBloat,
  onRevealItem,
  onTrashItem,
  isDarkMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 420 });
  const [selectedScanMode, setSelectedScanMode] = useState<ScanMode>('standard');
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [activeReport, setActiveReport] = useState<StorageXRayReport | null>(report);

  const [currentNode, setCurrentNode] = useState<TreemapNode | null>(null);
  const [nodeHistory, setNodeHistory] = useState<TreemapNode[]>([]);
  const [hoveredRect, setHoveredRect] = useState<LayoutRect | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<FileCategory | null>(null);
  const [selectedBloatIds, setSelectedBloatIds] = useState<Set<string>>(new Set());

  const abortScanRef = useRef<(() => void) | null>(null);

  // Sync external report updates
  useEffect(() => {
    if (report) {
      setActiveReport(report);
      setCurrentNode(report.treemapRoot);
      setNodeHistory([report.treemapRoot]);
    }
  }, [report]);

  useEffect(() => {
    if (activeReport?.bloatItems) {
      setSelectedBloatIds(new Set(activeReport.bloatItems.map((b) => b.id)));
    }
  }, [activeReport?.bloatItems]);

  // ResizeObserver for responsive squarified treemap dimensions
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 100 && entry.contentRect.height > 100) {
          setDimensions({
            width: Math.floor(entry.contentRect.width),
            height: Math.floor(entry.contentRect.height),
          });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortScanRef.current?.();
    };
  }, []);

  const layoutRects = useMemo(() => {
    if (!currentNode) return [];
    return computeSquarifiedTreemap(currentNode, dimensions.width, dimensions.height, 3);
  }, [currentNode, dimensions]);

  const handleStartScan = (mode: ScanMode = selectedScanMode) => {
    setSelectedScanMode(mode);
    setIsScanning(true);
    setScanStatus('running');
    const scanId = `scan_${Date.now()}`;
    setActiveScanId(scanId);

    const cleanup = ApiService.startScan(
      currentPath,
      mode,
      scanId,
      (progress) => {
        setScanProgress(progress);
        setScanStatus(progress.status);
        if (progress.status === 'completed' && progress.report) {
          setActiveReport(progress.report);
          setCurrentNode(progress.report.treemapRoot);
          setNodeHistory([progress.report.treemapRoot]);
          setIsScanning(false);
        } else if (progress.status === 'cancelled' || progress.status === 'error') {
          setIsScanning(false);
        }
      },
      (err) => {
        console.error('Scan stream error:', err);
        setIsScanning(false);
        setScanStatus('error');
      }
    );

    abortScanRef.current = cleanup;
  };

  const handlePauseScan = async () => {
    if (activeScanId) {
      await ApiService.pauseScan(activeScanId);
      setScanStatus('paused');
    }
  };

  const handleResumeScan = async () => {
    if (activeScanId) {
      await ApiService.resumeScan(activeScanId);
      setScanStatus('running');
    }
  };

  const handleCancelScan = async () => {
    if (activeScanId) {
      await ApiService.cancelScan(activeScanId);
      setIsScanning(false);
      setScanStatus('cancelled');
    }
    abortScanRef.current?.();
  };

  const handleDrilldown = (node: TreemapNode) => {
    if (node.isDirectory && node.children && node.children.length > 0) {
      setNodeHistory((prev) => [...prev, node]);
      setCurrentNode(node);
      setHoveredRect(null);
    }
  };

  const handleZoomOut = (index: number) => {
    const target = nodeHistory[index];
    if (target) {
      setNodeHistory((prev) => prev.slice(0, index + 1));
      setCurrentNode(target);
      setHoveredRect(null);
    }
  };

  const handleCleanSelectedBloat = () => {
    if (!activeReport?.bloatItems) return;
    const toClean = activeReport.bloatItems.filter((b) => selectedBloatIds.has(b.id));
    if (toClean.length > 0) {
      onCleanBloat(toClean);
    }
  };

  // 1. Loading from external trigger
  if (isLoading && !isScanning) {
    return (
      <div
        className={`flex-1 flex flex-col items-center justify-center p-8 transition-colors ${
          isDarkMode ? 'bg-[#121316] text-[#E3E2E6]' : 'bg-[#F4F5F8] text-[#191C1E]'
        }`}
      >
        <div className="w-12 h-12 rounded-full border-3 border-[#0072DE]/20 border-t-[#0072DE] animate-spin mb-4" />
        <span className="text-lg font-bold">Analyzing Your Storage...</span>
        <span className="text-xs opacity-60 mt-1">Inspecting folders, storage categories, and reclaimable space</span>
      </div>
    );
  }

  // 2. Active Scanning View (Live Metrics Dashboard)
  if (isScanning && scanProgress) {
    const isPaused = scanStatus === 'paused';
    return (
      <div
        className={`flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar select-none transition-colors ${
          isDarkMode ? 'bg-[#121316] text-[#E3E2E6]' : 'bg-[#F4F5F8] text-[#191C1E]'
        }`}
      >
        <div className="max-w-4xl mx-auto space-y-6 animate-oneui-fade">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Scanning Storage</h1>
              <p className="mt-1 text-sm opacity-70 truncate max-w-xl">
                {currentPath} • {selectedScanMode.toUpperCase()} SCAN
              </p>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                  isPaused
                    ? 'bg-amber-500/20 text-amber-500'
                    : 'bg-[#0072DE]/20 text-[#0072DE] animate-pulse'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-[#0072DE]'}`} />
                {isPaused ? 'Paused' : 'Scanning...'}
              </span>
            </div>
          </div>

          {/* Live Progress Card */}
          <div
            className={`p-6 rounded-3xl border space-y-6 ${
              isDarkMode ? 'bg-[#1C1D22] border-white/[0.06] shadow-sm' : 'bg-white border-black/[0.05] shadow-xs'
            }`}
          >
            {/* Top Stats Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04]">
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-60 block">Discovered</span>
                <span className="text-xl font-extrabold font-mono text-[#0072DE] block mt-1">
                  {scanProgress.formattedTotalBytes || formatBytes(scanProgress.totalBytes)}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04]">
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-60 block">Files Scanned</span>
                <span className="text-xl font-extrabold font-mono block mt-1">
                  {formatNumber(scanProgress.scannedFiles)}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04]">
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-60 block">Folders Checked</span>
                <span className="text-xl font-extrabold font-mono block mt-1">
                  {formatNumber(scanProgress.scannedFolders)}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04]">
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-60 block">Speed & Elapsed</span>
                <span className="text-sm font-extrabold font-mono block mt-1">
                  {formatNumber(scanProgress.speedFilesPerSec)} f/s • {(scanProgress.elapsedMs / 1000).toFixed(1)}s
                </span>
              </div>
            </div>

            {/* Current Scanning Path */}
            <div className="p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] flex items-center gap-3">
              <Folder className="w-4 h-4 text-[#0072DE] shrink-0 animate-bounce" />
              <span className="text-xs font-mono opacity-80 truncate" title={scanProgress.currentPath}>
                {scanProgress.currentPath || 'Analyzing filesystem structure...'}
              </span>
            </div>

            {/* Progress Bar Animation */}
            <div className="w-full h-2 rounded-full bg-black/[0.06] dark:bg-white/[0.06] overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isPaused ? 'bg-amber-500 w-full' : 'bg-[#0072DE] w-2/3 animate-pulse'
                }`}
              />
            </div>

            {/* Action Buttons: Pause, Resume, Cancel */}
            <div className="flex items-center justify-end gap-3 pt-2">
              {isPaused ? (
                <button
                  onClick={handleResumeScan}
                  className="px-5 py-2.5 rounded-full bg-[#0072DE] hover:bg-[#005fb8] text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Resume Scan</span>
                </button>
              ) : (
                <button
                  onClick={handlePauseScan}
                  className="px-5 py-2.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 font-bold text-xs flex items-center gap-1.5 transition-all border border-amber-500/30"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause Scan</span>
                </button>
              )}

              <button
                onClick={handleCancelScan}
                className="px-5 py-2.5 rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-500 font-bold text-xs flex items-center gap-1.5 transition-all border border-red-500/30"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Empty State (No scan report yet)
  if (!activeReport) {
    return (
      <div
        className={`flex-1 flex flex-col items-center justify-center p-8 transition-colors ${
          isDarkMode ? 'bg-[#121316] text-[#E3E2E6]' : 'bg-[#F4F5F8] text-[#191C1E]'
        }`}
      >
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-[#0072DE]/15 text-[#0072DE] flex items-center justify-center mx-auto">
            <PieChart className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">Storage X-Ray</h2>
            <p className="text-sm opacity-70 mt-1">
              Select a scanning depth to visualize disk utilization, identify bloat, and inspect largest files in{' '}
              <span className="font-mono font-semibold">{currentPath}</span>.
            </p>
          </div>

          {/* Mode Selection Pills */}
          <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-black/[0.04] dark:bg-white/[0.04]">
            <button
              onClick={() => setSelectedScanMode('quick')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                selectedScanMode === 'quick'
                  ? 'bg-[#0072DE] text-white shadow-xs'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              Quick Scan
            </button>
            <button
              onClick={() => setSelectedScanMode('standard')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                selectedScanMode === 'standard'
                  ? 'bg-[#0072DE] text-white shadow-xs'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              Standard
            </button>
            <button
              onClick={() => setSelectedScanMode('deep')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                selectedScanMode === 'deep'
                  ? 'bg-[#0072DE] text-white shadow-xs'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              Deep Scan
            </button>
          </div>

          <button
            onClick={() => handleStartScan(selectedScanMode)}
            className="w-full py-3 rounded-full bg-[#0072DE] hover:bg-[#005fb8] text-white font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start Analysis</span>
          </button>
        </div>
      </div>
    );
  }

  // 4. Full Report View
  const selectedBloatTotal = (activeReport.bloatItems || [])
    .filter((b) => selectedBloatIds.has(b.id))
    .reduce((acc, curr) => acc + curr.size, 0);

  return (
    <div
      className={`flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar select-none transition-colors ${
        isDarkMode ? 'bg-[#121316] text-[#E3E2E6]' : 'bg-[#F4F5F8] text-[#191C1E]'
      }`}
    >
      <div className="max-w-5xl mx-auto space-y-6 animate-oneui-fade">
        {/* Page Title & Scan Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Storage Analysis</h1>
            <p className="mt-1 text-sm opacity-70 truncate max-w-lg" title={activeReport.rootPath}>
              {activeReport.rootPath} • {activeReport.formattedTotalSize} total space occupied
            </p>
          </div>

          {/* Mode Selector and Re-scan button */}
          <div className="flex items-center gap-2">
            <div className="flex items-center p-1 rounded-full bg-black/[0.04] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.06]">
              {(['quick', 'standard', 'deep'] as ScanMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => handleStartScan(m)}
                  className={`px-3 py-1 rounded-full text-xs font-bold capitalize transition-all ${
                    selectedScanMode === m
                      ? 'bg-[#0072DE] text-white shadow-xs'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <button
              onClick={() => handleStartScan(selectedScanMode)}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[#0072DE] transition-colors"
              title="Re-scan Storage"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 1. Category Breakdown Card */}
        <div
          className={`p-6 rounded-3xl border transition-all ${
            isDarkMode ? 'bg-[#1C1D22] border-white/[0.06] shadow-sm' : 'bg-white border-black/[0.05] shadow-xs'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider opacity-60 block">Category Distribution</span>
              <span className="text-2xl font-extrabold font-mono">{activeReport.formattedTotalSize}</span>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono opacity-70">
              <div>
                <span className="block opacity-60 text-[10px] uppercase font-sans">Files</span>
                <span className="font-bold">{formatNumber(activeReport.totalFiles)}</span>
              </div>
              <div className="h-6 w-px bg-black/[0.08] dark:bg-white/[0.08]" />
              <div>
                <span className="block opacity-60 text-[10px] uppercase font-sans">Folders</span>
                <span className="font-bold">{formatNumber(activeReport.totalFolders)}</span>
              </div>
            </div>
          </div>

          {/* Segmented multi-color progress capsule */}
          <div className={`w-full h-3.5 rounded-full overflow-hidden flex p-0.5 mb-5 ${isDarkMode ? 'bg-[#121316]' : 'bg-slate-100'}`}>
            {activeReport.categories.map((cat) => (
              <div
                key={cat.category}
                style={{
                  width: `${cat.percentage}%`,
                  backgroundColor: cat.color,
                }}
                className="h-full rounded-full transition-all hover:opacity-80 cursor-pointer"
                title={`${cat.label}: ${formatBytes(cat.totalBytes)} (${cat.percentage}%)`}
                onClick={() =>
                  setSelectedCategoryFilter(selectedCategoryFilter === cat.category ? null : cat.category)
                }
              />
            ))}
          </div>

          {/* Clickable Category Chips */}
          <div className="flex flex-wrap items-center gap-2">
            {activeReport.categories.map((cat) => {
              const isSelected = selectedCategoryFilter === cat.category;
              return (
                <button
                  key={cat.category}
                  onClick={() =>
                    setSelectedCategoryFilter(isSelected ? null : cat.category)
                  }
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    isSelected
                      ? 'bg-[#0072DE] text-white border-[#0072DE] shadow-xs'
                      : isDarkMode
                      ? 'bg-white/[0.04] text-slate-300 border-white/[0.06] hover:bg-white/[0.08]'
                      : 'bg-slate-50 text-slate-700 border-black/[0.05] hover:bg-slate-100'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span>{cat.label}</span>
                  <span className="font-mono text-[11px] opacity-70">
                    {formatBytes(cat.totalBytes)} ({cat.percentage}%)
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. One UI Device Care Space Reclaim Banner */}
        {activeReport.bloatItems && activeReport.bloatItems.length > 0 && (
          <div
            className={`p-5 rounded-3xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              isDarkMode
                ? 'bg-[#F59E0B]/10 border-[#F59E0B]/20 text-[#E3E2E6]'
                : 'bg-[#F59E0B]/10 border-[#F59E0B]/20 text-[#191C1E]'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-[#F59E0B]/20 text-[#F59E0B] flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold block text-[#F59E0B]">
                  Reclaim {activeReport.formattedPotentialReclaim} by Cleaning Caches
                </span>
                <span className="text-xs opacity-80">
                  Detected {activeReport.bloatItems.length} development build caches (<code className="font-mono">node_modules</code>, <code className="font-mono">.venv</code>, <code className="font-mono">Temp</code>).
                </span>
              </div>
            </div>

            <button
              onClick={handleCleanSelectedBloat}
              className="px-5 py-2.5 rounded-full bg-[#F59E0B] hover:bg-[#D97706] text-black font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clean Now ({formatBytes(selectedBloatTotal)})</span>
            </button>
          </div>
        )}

        {/* 3. Interactive Squarified Treemap with One UI Rounded Rectangles */}
        <div
          className={`p-6 rounded-3xl border space-y-4 ${
            isDarkMode ? 'bg-[#1C1D22] border-white/[0.06] shadow-sm' : 'bg-white border-black/[0.05] shadow-xs'
          }`}
        >
          {/* Breadcrumb Trail for Treemap Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs font-mono overflow-x-auto custom-scrollbar py-1">
              {nodeHistory.map((n, i) => (
                <React.Fragment key={n.id}>
                  {i > 0 && <ChevronRight className="w-3.5 h-3.5 opacity-40 shrink-0" />}
                  <button
                    onClick={() => handleZoomOut(i)}
                    className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                      i === nodeHistory.length - 1
                        ? 'bg-[#0072DE]/15 text-[#0072DE] font-bold'
                        : isDarkMode
                        ? 'hover:bg-white/[0.06] text-slate-300'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {n.name || 'Root'}
                  </button>
                </React.Fragment>
              ))}
            </div>

            {nodeHistory.length > 1 && (
              <button
                onClick={() => handleZoomOut(nodeHistory.length - 2)}
                className="px-3 py-1 rounded-full text-xs font-bold border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-1"
              >
                <ArrowUp className="w-3.5 h-3.5" />
                <span>Up Level</span>
              </button>
            )}
          </div>

          {/* Treemap Render Container */}
          <div
            ref={containerRef}
            className={`w-full h-[420px] rounded-2xl relative overflow-hidden select-none border transition-colors ${
              isDarkMode ? 'bg-[#121316] border-white/[0.04]' : 'bg-slate-50 border-black/[0.04]'
            }`}
          >
            {layoutRects.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-xs opacity-50">
                <Folder className="w-8 h-8 mb-2 opacity-40" />
                <span>Empty or restricted directory</span>
              </div>
            ) : (
              layoutRects.map((rect) => {
                const node = rect.node;
                const isHovered = hoveredRect?.node.id === node.id;
                const isCategoryMatch = !selectedCategoryFilter || node.category === selectedCategoryFilter;
                const opacity = isCategoryMatch ? 1 : 0.2;

                return (
                  <div
                    key={node.id}
                    onClick={() => handleDrilldown(node)}
                    onMouseEnter={() => setHoveredRect(rect)}
                    onMouseLeave={() => setHoveredRect(null)}
                    style={{
                      left: `${rect.x + 2}px`,
                      top: `${rect.y + 2}px`,
                      width: `${Math.max(0, rect.w - 4)}px`,
                      height: `${Math.max(0, rect.h - 4)}px`,
                      backgroundColor: node.color,
                      opacity,
                    }}
                    className={`rounded-xl p-2 transition-all cursor-pointer overflow-hidden flex flex-col justify-between select-none ${
                      isHovered
                        ? 'ring-2 ring-white z-20 brightness-110 shadow-lg scale-[1.01]'
                        : 'opacity-90 hover:opacity-100 hover:brightness-105'
                    }`}
                  >
                    {rect.w > 45 && rect.h > 30 && (
                      <div className="flex flex-col text-white drop-shadow-sm">
                        <span className="text-xs font-bold truncate leading-tight">{node.name}</span>
                        <span className="text-[10px] font-mono text-white/90 tabular-nums">
                          {node.formattedSize}
                        </span>
                      </div>
                    )}

                    {rect.w > 65 && rect.h > 50 && node.isDirectory && (
                      <span className="text-[10px] font-mono text-white/80 self-end">
                        {node.itemCount ? `${node.itemCount} items` : 'Folder'}
                      </span>
                    )}
                  </div>
                );
              })
            )}

            {/* Floating Info Tooltip */}
            {hoveredRect && (
              <div
                className="absolute z-30 pointer-events-none p-3 rounded-2xl bg-black/85 backdrop-blur-md text-white text-xs max-w-xs shadow-xl border border-white/10"
                style={{
                  left: `${Math.min(dimensions.width - 240, Math.max(10, hoveredRect.x + 10))}px`,
                  top: `${Math.min(dimensions.height - 110, Math.max(10, hoveredRect.y + 10))}px`,
                }}
              >
                <div className="font-bold truncate text-sm mb-1">{hoveredRect.node.name}</div>
                <div className="space-y-0.5 font-mono text-[11px] text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Size:</span>
                    <span className="text-white font-bold">{hoveredRect.node.formattedSize}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Type:</span>
                    <span>{hoveredRect.node.isDirectory ? 'Folder' : 'File'}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate pt-1 border-t border-white/10 mt-1">
                    {hoveredRect.node.path}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. Top Largest Files Table */}
        <div
          className={`p-6 rounded-3xl border space-y-4 ${
            isDarkMode ? 'bg-[#1C1D22] border-white/[0.06] shadow-sm' : 'bg-white border-black/[0.05] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Largest Files</h2>
            <span className="text-xs opacity-60 font-mono">Ranked by disk footprint</span>
          </div>

          <div
            className={`rounded-2xl border divide-y overflow-hidden ${
              isDarkMode
                ? 'border-white/[0.06] divide-white/[0.04]'
                : 'border-black/[0.05] divide-black/[0.04]'
            }`}
          >
            {activeReport.largestFiles.map((file, idx) => (
              <div
                key={file.id}
                className={`p-3.5 flex items-center justify-between transition-colors ${
                  isDarkMode ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3 truncate max-w-lg">
                  <span className="font-mono opacity-50 text-xs w-4">{idx + 1}</span>
                  <File className="w-4 h-4 text-[#0072DE] shrink-0" />
                  <div className="truncate">
                    <span className="text-xs font-bold block truncate">{file.name}</span>
                    <span className="text-[10px] opacity-60 font-mono truncate">{file.path}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-bold font-mono">{file.formattedSize}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onRevealItem(file.path)}
                      className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors"
                      title="Reveal in Explorer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onTrashItem(file.path)}
                      className="p-1.5 rounded-full hover:bg-red-500/20 text-[#EF4444] transition-colors"
                      title="Move to Recycle Bin"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
