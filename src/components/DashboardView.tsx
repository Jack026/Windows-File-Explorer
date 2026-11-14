import React from 'react';
import {
  HardDrive,
  Folder,
  Download,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Monitor,
  Zap,
  PieChart,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  File,
  ExternalLink,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { DriveInfo, QuickDirectory, StorageXRayReport, FileItem, BloatItem } from '../types';
import { formatBytes, formatNumber } from '../utils/formatters';
import { CATEGORY_COLORS } from '../utils/categories';

interface DashboardViewProps {
  drives: DriveInfo[];
  quickDirs: QuickDirectory[];
  xrayReport: StorageXRayReport | null;
  onNavigateTo: (path: string) => void;
  onOpenXRay: () => void;
  onOpenLargeFiles?: () => void;
  onOpenScanHistory?: () => void;
  onOpenBloatCleaner: () => void;
  onOpenFile: (item: FileItem) => void;
  onRevealFile: (path: string) => void;
  isDarkMode: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  drives,
  quickDirs,
  xrayReport,
  onNavigateTo,
  onOpenXRay,
  onOpenLargeFiles,
  onOpenScanHistory,
  onOpenBloatCleaner,
  onOpenFile,
  onRevealFile,
  isDarkMode,
}) => {
  // Primary drive (typically C:)
  const primaryDrive = drives[0] || {
    deviceId: 'C:',
    volumeName: 'Local Disk',
    totalBytes: 512 * 1024 * 1024 * 1024,
    freeBytes: 120 * 1024 * 1024 * 1024,
    usedBytes: 392 * 1024 * 1024 * 1024,
    usagePercent: 76,
    health: 'warning' as const,
  };

  const getFolderIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'downloads': return <Download className="w-5 h-5 text-[#10B981]" />;
      case 'desktop': return <Monitor className="w-5 h-5 text-[#0072DE]" />;
      case 'documents': return <FileText className="w-5 h-5 text-[#3B82F6]" />;
      case 'pictures': return <ImageIcon className="w-5 h-5 text-[#8B5CF6]" />;
      case 'music': return <Music className="w-5 h-5 text-[#EC4899]" />;
      case 'videos': return <Film className="w-5 h-5 text-[#E11D48]" />;
      default: return <Folder className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div
      className={`flex-1 overflow-y-auto px-6 py-8 custom-scrollbar select-none transition-colors ${
        isDarkMode ? 'bg-[#121316] text-[#E3E2E6]' : 'bg-[#F4F5F8] text-[#191C1E]'
      }`}
    >
      <div className="max-w-5xl mx-auto space-y-8 animate-oneui-fade">
        {/* 1. Large One UI Page Title (Viewing Area) */}
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Your Storage</h1>
          <p className="mt-1.5 text-sm sm:text-base opacity-70">
            {primaryDrive.health === 'danger'
              ? `${formatBytes(primaryDrive.freeBytes)} available on ${primaryDrive.deviceId} • Space is running critically low`
              : `${formatBytes(primaryDrive.freeBytes)} available of ${formatBytes(primaryDrive.totalBytes)} on ${primaryDrive.volumeName}`}
          </p>
        </div>

        {/* 2. Hero Storage Overview Card (One UI 7/8 Signature Card) */}
        <div
          className={`p-6 sm:p-8 rounded-3xl border transition-all ${
            isDarkMode
              ? 'bg-[#1C1D22] border-white/[0.06] shadow-lg shadow-black/20'
              : 'bg-white border-black/[0.05] shadow-md shadow-slate-200/50'
          }`}
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider opacity-60 block mb-1">
                Main Storage ({primaryDrive.deviceId})
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold tracking-tight font-mono">
                  {formatBytes(primaryDrive.usedBytes)}
                </span>
                <span className="text-sm opacity-60 font-mono">used of {formatBytes(primaryDrive.totalBytes)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onOpenBloatCleaner}
                className="px-4 py-2 rounded-full text-xs font-bold bg-[#F59E0B]/15 hover:bg-[#F59E0B]/25 text-[#F59E0B] transition-colors flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Clean Caches</span>
              </button>

              <button
                onClick={onOpenXRay}
                className="px-4 py-2 rounded-full text-xs font-bold bg-[#0072DE] hover:bg-[#0062C4] text-white shadow-sm shadow-[#0072DE]/25 transition-all flex items-center gap-1.5"
              >
                <PieChart className="w-3.5 h-3.5" />
                <span>Analyze Storage</span>
              </button>
            </div>
          </div>

          {/* Segmented storage capsule bar */}
          <div className={`w-full h-4 rounded-full overflow-hidden flex p-0.5 ${isDarkMode ? 'bg-[#121316]' : 'bg-slate-100'}`}>
            {xrayReport?.categories && xrayReport.categories.length > 0 ? (
              xrayReport.categories.map((cat) => (
                <div
                  key={cat.category}
                  style={{
                    width: `${cat.percentage}%`,
                    backgroundColor: cat.color,
                  }}
                  className="h-full rounded-full transition-all hover:opacity-85"
                  title={`${cat.label}: ${formatBytes(cat.totalBytes)} (${cat.percentage}%)`}
                />
              ))
            ) : (
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  primaryDrive.health === 'danger'
                    ? 'bg-[#EF4444]'
                    : primaryDrive.health === 'warning'
                    ? 'bg-[#F59E0B]'
                    : 'bg-[#0072DE]'
                }`}
                style={{ width: `${Math.min(100, primaryDrive.usagePercent)}%` }}
              />
            )}
          </div>

          {/* Category Pills / Breakdown */}
          {xrayReport?.categories && xrayReport.categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mt-6 pt-5 border-t border-black/[0.05] dark:border-white/[0.05]">
              {xrayReport.categories.slice(0, 5).map((cat) => (
                <div key={cat.category} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="font-medium opacity-80">{cat.label}</span>
                  <span className="font-mono opacity-60 text-[11px]">{formatBytes(cat.totalBytes)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Local Drives Cards Grid */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-lg font-bold">Local Drives</h2>
            <span className="text-xs opacity-60 font-mono">{drives.length} drives available</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {drives.map((d) => (
              <div
                key={d.deviceId}
                onClick={() => onNavigateTo(d.deviceId + '\\')}
                className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                  isDarkMode
                    ? 'bg-[#1C1D22] border-white/[0.05] hover:bg-[#22242B] hover:border-white/[0.1]'
                    : 'bg-white border-black/[0.05] hover:bg-slate-50 hover:border-black/[0.1] shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#0072DE]/10 text-[#0072DE] flex items-center justify-center font-bold">
                      <HardDrive className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-bold block">{d.volumeName}</span>
                      <span className="text-xs opacity-60 font-mono">{d.deviceId} • {d.fileSystem}</span>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                      d.health === 'danger'
                        ? 'bg-[#EF4444]/15 text-[#EF4444]'
                        : d.health === 'warning'
                        ? 'bg-[#F59E0B]/15 text-[#F59E0B]'
                        : 'bg-[#10B981]/15 text-[#10B981]'
                    }`}
                  >
                    {d.usagePercent}%
                  </span>
                </div>

                <div className={`w-full h-2 rounded-full overflow-hidden mb-2 ${isDarkMode ? 'bg-white/[0.08]' : 'bg-slate-100'}`}>
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      d.health === 'danger'
                        ? 'bg-[#EF4444]'
                        : d.health === 'warning'
                        ? 'bg-[#F59E0B]'
                        : 'bg-[#0072DE]'
                    }`}
                    style={{ width: `${Math.min(100, d.usagePercent)}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-xs opacity-70 font-mono">
                  <span>{formatBytes(d.freeBytes)} free</span>
                  <span>{formatBytes(d.totalBytes)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Quick Access Folders */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-lg font-bold">Quick Access</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {quickDirs.slice(1).map((dir) => (
              <div
                key={dir.id}
                onClick={() => onNavigateTo(dir.path)}
                className={`p-4 rounded-2xl border text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                  isDarkMode
                    ? 'bg-[#1C1D22] border-white/[0.05] hover:bg-[#22242B]'
                    : 'bg-white border-black/[0.05] hover:bg-slate-50 shadow-xs'
                }`}
              >
                <div className="p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05]">
                  {getFolderIcon(dir.name)}
                </div>
                <span className="text-xs font-semibold truncate w-full">{dir.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Safe Space Reclaim Recommendation */}
        {xrayReport?.bloatItems && xrayReport.bloatItems.length > 0 && (
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
                  Reclaim {xrayReport.formattedPotentialReclaim} of Space
                </span>
                <span className="text-xs opacity-80">
                  Clean up safe development build caches (<code className="font-mono">node_modules</code>, <code className="font-mono">.venv</code>, <code className="font-mono">Temp</code>).
                </span>
              </div>
            </div>

            <button
              onClick={onOpenBloatCleaner}
              className="px-4 py-2 rounded-full bg-[#F59E0B] hover:bg-[#D97706] text-black text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 shadow-sm"
            >
              <span>Review & Clean</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 6. Top Largest Files Preview */}
        {xrayReport?.largestFiles && xrayReport.largestFiles.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-lg font-bold">Largest Files</h2>
              <button
                onClick={onOpenLargeFiles || onOpenXRay}
                className="text-xs font-bold text-[#0072DE] hover:underline flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div
              className={`rounded-2xl border divide-y overflow-hidden ${
                isDarkMode
                  ? 'bg-[#1C1D22] border-white/[0.05] divide-white/[0.04]'
                  : 'bg-white border-black/[0.05] divide-black/[0.04] shadow-xs'
              }`}
            >
              {xrayReport.largestFiles.slice(0, 5).map((file, idx) => (
                <div
                  key={file.id}
                  onClick={() => onOpenFile(file)}
                  className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRevealFile(file.path);
                      }}
                      className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors"
                      title="Reveal in Explorer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
