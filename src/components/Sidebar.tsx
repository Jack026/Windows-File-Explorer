import React from 'react';
import {
  HardDrive,
  Folder,
  Monitor,
  Download,
  FileText,
  Image as ImageIcon,
  Music,
  Film,
  User,
  PieChart,
  Zap,
  Copy,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LayoutDashboard,
  ShieldCheck,
  AlertCircle,
  Package,
  Wrench,
  Clock,
  Layers,
  KeyRound,
  Settings,
} from 'lucide-react';
import { DriveInfo, QuickDirectory, ViewMode } from '../types';
import { formatBytes } from '../utils/formatters';

interface SidebarProps {
  drives: DriveInfo[];
  quickDirs: QuickDirectory[];
  currentPath: string;
  activeView: ViewMode;
  onNavigate: (path: string) => void;
  onSelectView: (view: ViewMode) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isDarkMode: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  drives,
  quickDirs,
  currentPath,
  activeView,
  onNavigate,
  onSelectView,
  isCollapsed,
  onToggleCollapse,
  isDarkMode,
}) => {
  const getDirIcon = (iconName: string) => {
    switch (iconName) {
      case 'Monitor': return <Monitor className="w-4 h-4 text-[#0072DE]" />;
      case 'Download': return <Download className="w-4 h-4 text-[#10B981]" />;
      case 'FileText': return <FileText className="w-4 h-4 text-[#3B82F6]" />;
      case 'Image': return <ImageIcon className="w-4 h-4 text-[#8B5CF6]" />;
      case 'Music': return <Music className="w-4 h-4 text-[#EC4899]" />;
      case 'Film': return <Film className="w-4 h-4 text-[#E11D48]" />;
      case 'User': return <User className="w-4 h-4 text-[#F59E0B]" />;
      default: return <Folder className="w-4 h-4 text-slate-400" />;
    }
  };

  const isDriveActive = (driveId: string) => {
    return activeView === 'list' && currentPath.toUpperCase().startsWith(driveId.toUpperCase());
  };

  const isDirActive = (dirPath: string) => {
    return activeView === 'list' && currentPath.toLowerCase() === dirPath.toLowerCase();
  };

  if (isCollapsed) {
    return (
      <aside
        className={`w-16 border-r flex flex-col items-center py-4 gap-4 select-none shrink-0 transition-colors ${
          isDarkMode
            ? 'bg-[#121316] border-white/[0.04]'
            : 'bg-[#F4F5F8] border-black/[0.05]'
        }`}
      >
        <button
          onClick={onToggleCollapse}
          className={`p-2 rounded-full transition-colors ${
            isDarkMode ? 'hover:bg-white/[0.08] text-slate-400' : 'hover:bg-black/[0.05] text-slate-600'
          }`}
          title="Expand Sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className={`w-8 h-px my-1 ${isDarkMode ? 'bg-white/[0.06]' : 'bg-black/[0.06]'}`} />

        <button
          onClick={() => onSelectView('dashboard')}
          className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
            activeView === 'dashboard'
              ? 'bg-[#0072DE] text-white shadow-md shadow-[#0072DE]/25'
              : isDarkMode
              ? 'text-slate-400 hover:bg-white/[0.08] hover:text-white'
              : 'text-slate-600 hover:bg-black/[0.05] hover:text-black'
          }`}
          title="Storage Dashboard"
        >
          <LayoutDashboard className="w-4 h-4" />
        </button>

        <button
          onClick={() => onSelectView('drives')}
          className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
            activeView === 'drives'
              ? 'bg-[#0072DE] text-white shadow-md shadow-[#0072DE]/25'
              : isDarkMode
              ? 'text-slate-400 hover:bg-white/[0.08] hover:text-white'
              : 'text-slate-600 hover:bg-black/[0.05] hover:text-black'
          }`}
          title="Drive Manager"
        >
          <HardDrive className="w-4 h-4" />
        </button>

        <div className="flex flex-col gap-2 items-center">
          {drives.map((d) => (
            <button
              key={d.deviceId}
              onClick={() => {
                onSelectView('list');
                onNavigate(d.deviceId + '\\');
              }}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-bold transition-all relative ${
                isDriveActive(d.deviceId)
                  ? 'bg-[#0072DE] text-white shadow-md shadow-[#0072DE]/25'
                  : isDarkMode
                  ? 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                  : 'bg-white text-slate-700 shadow-sm hover:bg-slate-50'
              }`}
              title={`${d.deviceId} (${formatBytes(d.freeBytes)} free)`}
            >
              {d.deviceId.replace(':', '')}
              {d.health === 'danger' && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#EF4444]" />
              )}
            </button>
          ))}
        </div>

        <div className={`w-8 h-px my-1 ${isDarkMode ? 'bg-white/[0.06]' : 'bg-black/[0.06]'}`} />

        <div className="flex flex-col gap-2">
          <button
            onClick={() => onSelectView('xray')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              activeView === 'xray'
                ? 'bg-[#0072DE] text-white'
                : isDarkMode
                ? 'text-slate-400 hover:bg-white/[0.08]'
                : 'text-slate-600 hover:bg-black/[0.05]'
            }`}
            title="Storage Analyzer"
          >
            <PieChart className="w-4 h-4" />
          </button>

          <button
            onClick={() => onSelectView('large_files')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              activeView === 'large_files'
                ? 'bg-[#0072DE] text-white'
                : isDarkMode
                ? 'text-slate-400 hover:bg-white/[0.08]'
                : 'text-slate-600 hover:bg-black/[0.05]'
            }`}
            title="Large File Finder"
          >
            <Layers className="w-4 h-4 text-rose-400" />
          </button>

          <button
            onClick={() => onSelectView('scan_history')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              activeView === 'scan_history'
                ? 'bg-[#0072DE] text-white'
                : isDarkMode
                ? 'text-slate-400 hover:bg-white/[0.08]'
                : 'text-slate-600 hover:bg-black/[0.05]'
            }`}
            title="Scan History & Growth"
          >
            <Clock className="w-4 h-4 text-emerald-400" />
          </button>

          <button
            onClick={() => onSelectView('bloat')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              activeView === 'bloat'
                ? 'bg-[#F59E0B] text-white'
                : isDarkMode
                ? 'text-slate-400 hover:bg-white/[0.08]'
                : 'text-slate-600 hover:bg-black/[0.05]'
            }`}
            title="Clean Up Caches"
          >
            <Zap className="w-4 h-4" />
          </button>

          <button
            onClick={() => onSelectView('duplicates')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              activeView === 'duplicates'
                ? 'bg-[#EC4899] text-white'
                : isDarkMode
                ? 'text-slate-400 hover:bg-white/[0.08]'
                : 'text-slate-600 hover:bg-black/[0.05]'
            }`}
            title="Duplicate Finder"
          >
            <Copy className="w-4 h-4" />
          </button>

          <button
            onClick={() => onSelectView('apps')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              activeView === 'apps' || activeView === 'app_details'
                ? 'bg-[#0072DE] text-white shadow-sm'
                : isDarkMode
                ? 'text-slate-400 hover:bg-white/[0.08]'
                : 'text-slate-600 hover:bg-black/[0.05]'
            }`}
            title="Installed Applications"
          >
            <Package className="w-4 h-4" />
          </button>

          <button
            onClick={() => onSelectView('utilities')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              activeView === 'utilities'
                ? 'bg-[#8B5CF6] text-white shadow-sm'
                : isDarkMode
                ? 'text-slate-400 hover:bg-white/[0.08]'
                : 'text-slate-600 hover:bg-black/[0.05]'
            }`}
            title="System Utilities"
          >
            <Wrench className="w-4 h-4" />
          </button>

          <button
            onClick={() => onSelectView('permissions')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              activeView === 'permissions'
                ? 'bg-[#10B981] text-white shadow-sm'
                : isDarkMode
                ? 'text-slate-400 hover:bg-white/[0.08]'
                : 'text-slate-600 hover:bg-black/[0.05]'
            }`}
            title="Permissions & Access"
          >
            <KeyRound className="w-4 h-4" />
          </button>

          <button
            onClick={() => onSelectView('settings')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              activeView === 'settings'
                ? 'bg-[#0072DE] text-white shadow-sm'
                : isDarkMode
                ? 'text-slate-400 hover:bg-white/[0.08]'
                : 'text-slate-600 hover:bg-black/[0.05]'
            }`}
            title="Settings & Preferences"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={`w-64 border-r flex flex-col h-full select-none shrink-0 overflow-hidden transition-colors ${
        isDarkMode
          ? 'bg-[#121316] border-white/[0.04] text-[#E3E2E6]'
          : 'bg-[#F4F5F8] border-black/[0.05] text-[#191C1E]'
      }`}
    >
      {/* Sidebar Header with One UI friendly title */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/icon.png" alt="App Icon" className="w-5 h-5 object-contain" />
          <span className="text-xs font-bold uppercase tracking-wider opacity-60">Storage Care</span>
        </div>
        <button
          onClick={onToggleCollapse}
          className={`p-1.5 rounded-full transition-colors ${
            isDarkMode ? 'hover:bg-white/[0.08] text-slate-400' : 'hover:bg-black/[0.05] text-slate-600'
          }`}
          title="Collapse Sidebar"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-6 custom-scrollbar">
        {/* Home & Applications View */}
        <div className="space-y-1">
          <button
            onClick={() => onSelectView('dashboard')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[13px] font-semibold transition-all ${
              activeView === 'dashboard'
                ? 'bg-[#0072DE] text-white shadow-sm shadow-[#0072DE]/20'
                : isDarkMode
                ? 'hover:bg-white/[0.06] text-slate-300 hover:text-white'
                : 'hover:bg-black/[0.05] text-slate-700 hover:text-black'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>Your Storage</span>
            <span
              className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                activeView === 'dashboard'
                  ? 'bg-white/20 text-white'
                  : isDarkMode
                  ? 'bg-white/[0.08] text-slate-400'
                  : 'bg-black/[0.06] text-slate-600'
              }`}
            >
              Home
            </span>
          </button>

          <button
            onClick={() => onSelectView('drives')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[13px] font-semibold transition-all ${
              activeView === 'drives'
                ? 'bg-[#0072DE] text-white shadow-sm shadow-[#0072DE]/20'
                : isDarkMode
                ? 'hover:bg-white/[0.06] text-slate-300 hover:text-white'
                : 'hover:bg-black/[0.05] text-slate-700 hover:text-black'
            }`}
          >
            <HardDrive className="w-4 h-4 shrink-0" />
            <span>Drives</span>
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10">
              {drives.length}
            </span>
          </button>

          <button
            onClick={() => onSelectView('apps')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[13px] font-semibold transition-all ${
              activeView === 'apps' || activeView === 'app_details'
                ? 'bg-[#0072DE] text-white shadow-sm shadow-[#0072DE]/20'
                : isDarkMode
                ? 'hover:bg-white/[0.06] text-slate-300 hover:text-white'
                : 'hover:bg-black/[0.05] text-slate-700 hover:text-black'
            }`}
          >
            <Package className="w-4 h-4 shrink-0" />
            <span>Applications</span>
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981]">
              Uninstaller
            </span>
          </button>
        </div>

        {/* Local Drives Section with One UI Cards */}
        <div>
          <div className="px-3 mb-2.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider opacity-60">
            <span>Drives</span>
            <span className="font-mono text-[11px] font-normal">{drives.length} Connected</span>
          </div>

          <div className="space-y-2">
            {drives.map((drive) => {
              const active = isDriveActive(drive.deviceId);
              const barColor =
                drive.health === 'danger'
                  ? 'bg-[#EF4444]'
                  : drive.health === 'warning'
                  ? 'bg-[#F59E0B]'
                  : 'bg-[#0072DE]';

              return (
                <div
                  key={drive.deviceId}
                  onClick={() => {
                    onSelectView('list');
                    onNavigate(drive.deviceId + '\\');
                  }}
                  className={`group p-3 rounded-2xl cursor-pointer transition-all border ${
                    active
                      ? isDarkMode
                        ? 'bg-[#1C1D22] border-[#0072DE]/50 shadow-sm'
                        : 'bg-white border-[#0072DE]/50 shadow-sm'
                      : isDarkMode
                      ? 'bg-[#1A1B20]/60 border-white/[0.04] hover:bg-[#1E2026] hover:border-white/[0.08]'
                      : 'bg-white/80 border-black/[0.04] hover:bg-white hover:border-black/[0.08] shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                          active
                            ? 'bg-[#0072DE] text-white shadow-xs'
                            : isDarkMode
                            ? 'bg-white/[0.06] text-slate-300'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        <HardDrive className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[13px] font-bold leading-tight truncate max-w-[110px]">
                          {drive.volumeName} ({drive.deviceId})
                        </span>
                        <span className="text-[10px] opacity-60 font-mono">
                          {drive.fileSystem}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-xs font-mono font-bold ${
                        drive.health === 'danger'
                          ? 'text-[#EF4444]'
                          : drive.health === 'warning'
                          ? 'text-[#F59E0B]'
                          : 'text-[#0072DE]'
                      }`}
                    >
                      {drive.usagePercent}%
                    </span>
                  </div>

                  {/* One UI Smooth Progress Bar */}
                  <div className={`w-full h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${Math.min(100, drive.usagePercent)}%` }}
                    />
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-[11px] opacity-70 font-mono">
                    <span>{formatBytes(drive.freeBytes)} available</span>
                    <span>{formatBytes(drive.totalBytes)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Favorites / Quick Access Folders */}
        <div>
          <div className="px-3 mb-2 text-xs font-bold uppercase tracking-wider opacity-60">
            <span>Favorites</span>
          </div>

          <div className="space-y-0.5">
            {quickDirs.map((dir) => {
              const active = isDirActive(dir.path);
              return (
                <button
                  key={dir.id}
                  onClick={() => {
                    onSelectView('list');
                    onNavigate(dir.path);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-[13px] font-medium transition-all ${
                    active
                      ? isDarkMode
                        ? 'bg-white/[0.1] text-white font-semibold'
                        : 'bg-white text-black font-semibold shadow-xs'
                      : isDarkMode
                      ? 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                      : 'text-slate-700 hover:bg-black/[0.04] hover:text-black'
                  }`}
                >
                  {getDirIcon(dir.icon)}
                  <span className="truncate">{dir.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Storage Care / Utilities */}
        <div>
          <div className="px-3 mb-2 text-xs font-bold uppercase tracking-wider opacity-60">
            <span>Storage Tools</span>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => onSelectView('xray')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-[13px] font-medium transition-all ${
                activeView === 'xray'
                  ? 'bg-[#0072DE]/15 text-[#0072DE] font-semibold dark:bg-[#0072DE]/20 dark:text-[#5B95FF]'
                  : isDarkMode
                  ? 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                  : 'text-slate-700 hover:bg-black/[0.04] hover:text-black'
              }`}
            >
              <PieChart className="w-4 h-4 text-[#0072DE]" />
              <span>Storage Analyzer</span>
            </button>

            <button
              onClick={() => onSelectView('large_files')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-[13px] font-medium transition-all ${
                activeView === 'large_files'
                  ? 'bg-[#0072DE]/15 text-[#0072DE] font-semibold dark:bg-[#0072DE]/20 dark:text-[#5B95FF]'
                  : isDarkMode
                  ? 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                  : 'text-slate-700 hover:bg-black/[0.04] hover:text-black'
              }`}
            >
              <Layers className="w-4 h-4 text-rose-400" />
              <span>Large File Finder</span>
            </button>

            <button
              onClick={() => onSelectView('scan_history')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-[13px] font-medium transition-all ${
                activeView === 'scan_history'
                  ? 'bg-[#0072DE]/15 text-[#0072DE] font-semibold dark:bg-[#0072DE]/20 dark:text-[#5B95FF]'
                  : isDarkMode
                  ? 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                  : 'text-slate-700 hover:bg-black/[0.04] hover:text-black'
              }`}
            >
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Scan History & Growth</span>
            </button>

            <button
              onClick={() => onSelectView('bloat')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-[13px] font-medium transition-all ${
                activeView === 'bloat'
                  ? 'bg-[#F59E0B]/15 text-[#F59E0B] font-semibold'
                  : isDarkMode
                  ? 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                  : 'text-slate-700 hover:bg-black/[0.04] hover:text-black'
              }`}
            >
              <Zap className="w-4 h-4 text-[#F59E0B]" />
              <span>Clean Up Caches</span>
            </button>

            <button
              onClick={() => onSelectView('duplicates')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-[13px] font-medium transition-all ${
                activeView === 'duplicates'
                  ? 'bg-[#EC4899]/15 text-[#EC4899] font-semibold'
                  : isDarkMode
                  ? 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                  : 'text-slate-700 hover:bg-black/[0.04] hover:text-black'
              }`}
            >
              <Copy className="w-4 h-4 text-[#EC4899]" />
              <span>Duplicate Finder</span>
            </button>

            <button
              onClick={() => onSelectView('apps')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-[13px] font-medium transition-all ${
                activeView === 'apps' || activeView === 'app_details'
                  ? 'bg-[#0072DE]/15 text-[#0072DE] font-semibold dark:bg-[#0072DE]/20 dark:text-[#5B95FF]'
                  : isDarkMode
                  ? 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                  : 'text-slate-700 hover:bg-black/[0.04] hover:text-black'
              }`}
            >
              <Package className="w-4 h-4 text-[#0072DE]" />
              <span>Installed Applications</span>
            </button>

            <button
              onClick={() => onSelectView('utilities')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-[13px] font-medium transition-all ${
                activeView === 'utilities'
                  ? 'bg-[#8B5CF6]/15 text-[#8B5CF6] font-semibold'
                  : isDarkMode
                  ? 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                  : 'text-slate-700 hover:bg-black/[0.04] hover:text-black'
              }`}
            >
              <Wrench className="w-4 h-4 text-[#8B5CF6]" />
              <span>System Utilities</span>
            </button>

            <button
              onClick={() => onSelectView('permissions')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-[13px] font-medium transition-all ${
                activeView === 'permissions'
                  ? 'bg-[#10B981]/15 text-[#10B981] font-semibold'
                  : isDarkMode
                  ? 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                  : 'text-slate-700 hover:bg-black/[0.04] hover:text-black'
              }`}
            >
              <KeyRound className="w-4 h-4 text-[#10B981]" />
              <span>Permissions & Access</span>
            </button>

            <button
              onClick={() => onSelectView('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-[13px] font-medium transition-all ${
                activeView === 'settings'
                  ? 'bg-[#0072DE]/15 text-[#0072DE] font-semibold dark:bg-[#0072DE]/20 dark:text-[#5B95FF]'
                  : isDarkMode
                  ? 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                  : 'text-slate-700 hover:bg-black/[0.04] hover:text-black'
              }`}
            >
              <Settings className="w-4 h-4 text-[#0072DE]" />
              <span>Settings & Preferences</span>
            </button>
          </div>
        </div>
      </div>

      {/* One UI Device Care Status Pill at bottom */}
      <div className={`p-3.5 m-2.5 rounded-2xl border ${isDarkMode ? 'bg-[#1C1D22] border-white/[0.04]' : 'bg-white border-black/[0.05] shadow-xs'}`}>
        <div className="flex items-center gap-2.5">
          {drives.some((d) => d.health === 'danger') ? (
            <>
              <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0" />
              <div className="flex flex-col text-[11px] leading-tight">
                <span className="font-bold text-[#EF4444]">Storage Critical</span>
                <span className="opacity-60 text-[10px]">C: drive is almost full</span>
              </div>
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0" />
              <div className="flex flex-col text-[11px] leading-tight">
                <span className="font-bold text-[#10B981]">Storage Optimized</span>
                <span className="opacity-60 text-[10px]">Everything looks good</span>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};
