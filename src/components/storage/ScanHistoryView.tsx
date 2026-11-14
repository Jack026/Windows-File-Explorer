import React, { useState, useEffect } from 'react';
import {
  Clock,
  HardDrive,
  FolderOpen,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Trash2,
  RotateCw,
  GitCompare,
  X,
  CheckCircle2,
  Calendar,
  Layers,
  FileCode,
  FileVideo,
  FileArchive,
  FileText,
} from 'lucide-react';
import { ScanHistoryRecord, ScanComparisonResult, FileCategory } from '../../types';
import { ApiService } from '../../services/api';
import { formatBytes, formatDate } from '../../utils/formatters';
import { CATEGORY_COLORS } from '../../utils/categories';

interface ScanHistoryViewProps {
  onNavigateToScan: (path: string) => void;
  isDarkMode: boolean;
}

export const ScanHistoryView: React.FC<ScanHistoryViewProps> = ({
  onNavigateToScan,
  isDarkMode,
}) => {
  const [history, setHistory] = useState<ScanHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedScanA, setSelectedScanA] = useState<string | null>(null);
  const [selectedScanB, setSelectedScanB] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ScanComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const records = await ApiService.getScanHistory(50);
      setHistory(records);
    } catch (err) {
      console.error('Failed to fetch scan history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id: string) => {
    await ApiService.deleteScanHistory(id);
    setHistory((prev) => prev.filter((r) => r.id !== id));
  };

  const handleClearAll = async () => {
    if (window.confirm('Clear all recorded storage scan history?')) {
      await ApiService.clearScanHistory();
      setHistory([]);
      setComparison(null);
    }
  };

  const handleCompare = async (idA: string, idB: string) => {
    setIsComparing(true);
    try {
      const res = await ApiService.compareScanHistory(idA, idB);
      setComparison(res);
    } catch (err) {
      console.error('Failed to compare scans:', err);
    } finally {
      setIsComparing(false);
    }
  };

  const uniquePathsCount = new Set(history.map((h) => h.targetPath.toLowerCase())).size;
  const latestScan = history[0];

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full select-none">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Scan History & Growth Monitoring</h1>
          <p className="text-sm text-slate-400">
            Track historical storage scans across drives and directories, audit storage trends, and compare growth over time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchHistory}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
              isDarkMode
                ? 'bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border-white/[0.08]'
                : 'bg-white hover:bg-slate-50 text-slate-800 border-black/[0.08] shadow-xs'
            }`}
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#0072DE]' : ''}`} />
            <span>Refresh</span>
          </button>

          {history.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </div>

      {/* Aggregate Overview Card */}
      <div
        className={`p-6 rounded-3xl border transition-all ${
          isDarkMode
            ? 'bg-gradient-to-br from-[#16181D] to-[#121316] border-white/[0.06]'
            : 'bg-white border-black/[0.06] shadow-sm'
        }`}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-xs text-slate-400 font-medium block">Total Scans Saved</span>
            <span className="text-2xl font-bold font-mono text-[#0072DE]">{history.length}</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium block">Unique Target Paths</span>
            <span className="text-2xl font-bold font-mono text-emerald-400">{uniquePathsCount}</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium block">Latest Scan Size</span>
            <span className="text-2xl font-bold font-mono text-amber-500">
              {latestScan ? latestScan.formattedTotalBytes : 'None'}
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium block">Latest Activity</span>
            <span className="text-sm font-semibold truncate text-slate-300 mt-1 block">
              {latestScan ? formatDate(latestScan.timestamp) : 'No scans yet'}
            </span>
          </div>
        </div>
      </div>

      {/* Comparison Drawer / Modal (if active) */}
      {comparison && (
        <div
          className={`p-6 rounded-3xl border space-y-4 animate-slide-up shadow-xl ${
            isDarkMode
              ? 'bg-[#181B22] border-white/[0.1] text-white'
              : 'bg-white border-black/[0.08] shadow-md'
          }`}
        >
          <div className="flex items-center justify-between border-b pb-3 border-black/[0.05] dark:border-white/[0.05]">
            <div className="flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-[#0072DE]" />
              <h2 className="text-base font-bold">Storage Growth Comparison</h2>
            </div>
            <button
              onClick={() => setComparison(null)}
              className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-black/10 dark:bg-black/25">
              <span className="text-[11px] text-slate-400 font-semibold uppercase block">Baseline Scan</span>
              <span className="font-bold text-sm block mt-1">{formatDate(comparison.scanA.timestamp)}</span>
              <span className="text-xs font-mono opacity-70 block">{comparison.scanA.formattedTotalBytes}</span>
            </div>

            <div className="p-4 rounded-2xl bg-black/10 dark:bg-black/25">
              <span className="text-[11px] text-slate-400 font-semibold uppercase block">Target Scan</span>
              <span className="font-bold text-sm block mt-1">{formatDate(comparison.scanB.timestamp)}</span>
              <span className="text-xs font-mono opacity-70 block">{comparison.scanB.formattedTotalBytes}</span>
            </div>

            <div className="p-4 rounded-2xl bg-black/10 dark:bg-black/25">
              <span className="text-[11px] text-slate-400 font-semibold uppercase block">Growth Delta</span>
              <div className="flex items-center gap-1.5 mt-1">
                {comparison.isGrowth ? (
                  <TrendingUp className="w-4 h-4 text-red-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-emerald-400" />
                )}
                <span
                  className={`text-lg font-bold font-mono ${
                    comparison.isGrowth ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {comparison.formattedDeltaBytes}
                </span>
                <span className="text-xs opacity-60">({comparison.deltaPercent > 0 ? '+' : ''}{comparison.deltaPercent}%)</span>
              </div>
            </div>
          </div>

          {/* Category Breakdown Deltas */}
          <div className="pt-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Category Changes
            </span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {Object.entries(comparison.categoryDeltas).map(([cat, delta]) => (
                <div
                  key={cat}
                  className="p-3 rounded-2xl bg-black/5 dark:bg-black/20 flex justify-between items-center"
                >
                  <span className="capitalize font-medium text-slate-300">{cat}:</span>
                  <span
                    className={`font-mono font-bold ${
                      delta.deltaBytes > 0
                        ? 'text-red-400'
                        : delta.deltaBytes < 0
                        ? 'text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {delta.formattedDeltaBytes}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Timeline List of Saved Scans */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 space-y-2">
          <RotateCw className="w-6 h-6 mx-auto animate-spin text-[#0072DE]" />
          <span className="text-xs font-semibold">Loading scan history...</span>
        </div>
      ) : history.length === 0 ? (
        <div className="p-12 text-center text-slate-400 space-y-2 rounded-3xl border border-dashed border-black/10 dark:border-white/10">
          <Clock className="w-10 h-10 mx-auto opacity-40 mb-2" />
          <p className="text-base font-semibold">No storage scan history recorded yet</p>
          <p className="text-xs opacity-70">
            Run a Storage X-Ray scan on any drive or directory to automatically start tracking storage history.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((record, index) => {
            const isLatest = index === 0;
            const prevRecord = history[index + 1];

            return (
              <div
                key={record.id}
                className={`p-6 rounded-3xl border transition-all ${
                  isDarkMode
                    ? 'bg-[#16181D] hover:bg-[#1A1D23] border-white/[0.06]'
                    : 'bg-white hover:bg-slate-50 border-black/[0.06] shadow-sm'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-black/[0.04] dark:border-white/[0.04]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#0072DE]/15 text-[#0072DE] flex items-center justify-center shrink-0">
                      <HardDrive className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-200 dark:text-white truncate max-w-md">
                          {record.targetPath}
                        </span>
                        {isLatest && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400">
                            Latest
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0072DE]/15 text-[#0072DE] uppercase">
                          {record.mode}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3" />
                          {formatDate(record.timestamp)}
                        </span>
                        <span>•</span>
                        <span>{record.totalFiles.toLocaleString()} files</span>
                        <span>•</span>
                        <span>{record.durationMs}ms</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 justify-end">
                    <div className="text-right">
                      <span className="text-xs text-slate-400 font-medium block">Scanned Size</span>
                      <span className="text-lg font-bold font-mono text-amber-500">
                        {record.formattedTotalBytes}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 pl-2 border-l border-black/[0.05] dark:border-white/[0.05]">
                      <button
                        onClick={() => onNavigateToScan(record.targetPath)}
                        className="px-3 py-1.5 rounded-full bg-[#0072DE] hover:bg-[#0062C4] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                        title="Re-run Storage X-Ray on this path"
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>Re-Scan</span>
                      </button>

                      {prevRecord && (
                        <button
                          onClick={() => handleCompare(prevRecord.id, record.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1 ${
                            isDarkMode
                              ? 'bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border-white/[0.08]'
                              : 'bg-white hover:bg-slate-50 text-slate-700 border-black/[0.08]'
                          }`}
                          title="Compare with previous scan"
                        >
                          <GitCompare className="w-3 h-3 text-[#0072DE]" />
                          <span>Compare</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(record.id)}
                        className="p-2 rounded-full hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                        title="Delete this snapshot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Category Visual Distribution Bar */}
                <div className="pt-3">
                  <div className="h-2 w-full rounded-full overflow-hidden flex bg-black/20 mb-2">
                    {Object.entries(record.categories).map(([cat, data]) => {
                      if (!data || data.percent <= 0) return null;
                      return (
                        <div
                          key={cat}
                          style={{
                            width: `${data.percent}%`,
                            backgroundColor: CATEGORY_COLORS[cat as FileCategory] || '#94A3B8',
                          }}
                          title={`${cat}: ${formatBytes(data.totalBytes)} (${data.percent}%)`}
                        />
                      );
                    })}
                  </div>

                  {/* Top Consumers Preview */}
                  {record.topConsumers && record.topConsumers.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-500">Top Space Hogs:</span>
                      {record.topConsumers.slice(0, 3).map((f) => (
                        <span
                          key={f.path}
                          className="px-2 py-0.5 rounded-full bg-black/10 dark:bg-black/30 font-mono text-[10px] truncate max-w-[200px]"
                          title={`${f.name} (${f.formattedSize})`}
                        >
                          {f.name} (<strong className="text-amber-400">{f.formattedSize}</strong>)
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
