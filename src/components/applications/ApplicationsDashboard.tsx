import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Search,
  RotateCw,
  HardDrive,
  Activity,
  Trash2,
  ExternalLink,
  ChevronRight,
  Filter,
  LayoutGrid,
  List,
  Layers,
  Sparkles,
  ArrowUpDown,
  Zap,
  Folder,
  FolderOpen,
  Play,
  Download,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { InstalledApp, AppCategory } from '../../types';
import { formatBytes, formatNumber } from '../../utils/formatters';
import { ApiService } from '../../services/api';
import { ApplicationCompareModal } from './ApplicationCompareModal';

interface ApplicationsDashboardProps {
  onSelectApp: (app: InstalledApp) => void;
  onOpenUninstallModal: (app: InstalledApp) => void;
  isDarkMode: boolean;
}

const CATEGORIES: { key: AppCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All Apps' },
  { key: 'development', label: 'Development' },
  { key: 'games', label: 'Games' },
  { key: 'productivity', label: 'Productivity' },
  { key: 'graphics', label: 'Graphics & Design' },
  { key: 'multimedia', label: 'Multimedia' },
  { key: 'browsers', label: 'Browsers' },
  { key: 'utilities', label: 'Utilities' },
  { key: 'store', label: 'Microsoft Store' },
  { key: 'system', label: 'System' },
  { key: 'other', label: 'Other' },
];

export const ApplicationsDashboard: React.FC<ApplicationsDashboardProps> = ({
  onSelectApp,
  onOpenUninstallModal,
  isDarkMode,
}) => {
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AppCategory | 'all'>('all');
  const [viewLayout, setViewLayout] = useState<'list' | 'grid'>('list');
  const [sortField, setSortField] = useState<'name' | 'size' | 'publisher' | 'date'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [measuringAppId, setMeasuringAppId] = useState<string | null>(null);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [compareInitialApp, setCompareInitialApp] = useState<InstalledApp | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [onlyRunning, setOnlyRunning] = useState(false);

  const loadApps = async (refresh = false) => {
    setIsLoading(true);
    try {
      const data = await ApiService.getApps(refresh);
      setApps(data.apps || []);
    } catch (err) {
      console.error('Failed to load apps:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApps();
  }, []);

  const handleMeasureFootprint = async (app: InstalledApp, e: React.MouseEvent) => {
    e.stopPropagation();
    setMeasuringAppId(app.id);
    try {
      const breakdown = await ApiService.getAppFootprint(app.id);
      setApps((prev) =>
        prev.map((a) =>
          a.id === app.id
            ? {
                ...a,
                measuredSize: breakdown.totalMeasuredFootprint,
                formattedMeasuredSize: breakdown.formattedTotalMeasuredFootprint,
              }
            : a
        )
      );
    } catch (err) {
      console.error('Failed to measure footprint:', err);
    } finally {
      setMeasuringAppId(null);
    }
  };

  const handleLaunchApp = async (app: InstalledApp, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await ApiService.launchApp(app.id);
      if (!res.success) {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to launch application');
    }
  };

  const handleOpenLocation = async (app: InstalledApp, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await ApiService.openAppLocation(app.id);
    } catch (err: any) {
      alert(err.message || 'Failed to open application location');
    }
  };

  const handleOpenCompare = (app?: InstalledApp, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCompareInitialApp(app || null);
    setIsCompareModalOpen(true);
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setIsExporting(true);
    try {
      const content = await ApiService.exportApps(format);
      const blob = new Blob([content], {
        type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `installed-applications.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const filteredAndSortedApps = useMemo(() => {
    let result = [...apps];

    // Filter by Running
    if (onlyRunning) {
      result = result.filter((a) => a.isRunning);
    }

    // Filter by Category
    if (selectedCategory !== 'all') {
      result = result.filter((a) => a.category === selectedCategory);
    }

    // Filter by Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.displayName.toLowerCase().includes(q) ||
          a.publisher.toLowerCase().includes(q) ||
          (a.installLocation && a.installLocation.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      let comp = 0;
      if (sortField === 'size') {
        const sizeA = a.measuredSize || a.estimatedSize || 0;
        const sizeB = b.measuredSize || b.estimatedSize || 0;
        comp = sizeA - sizeB;
      } else if (sortField === 'publisher') {
        comp = a.publisher.localeCompare(b.publisher);
      } else if (sortField === 'date') {
        comp = (a.installDate || '').localeCompare(b.installDate || '');
      } else {
        comp = a.displayName.localeCompare(b.displayName);
      }
      return sortDirection === 'asc' ? comp : -comp;
    });

    return result;
  }, [apps, selectedCategory, searchQuery, sortField, sortDirection]);

  // Aggregate stats
  const totalAppsCount = apps.length;
  const runningAppsCount = apps.filter((a) => a.isRunning).length;
  const totalMeasuredBytes = apps.reduce((acc, a) => acc + (a.measuredSize || a.estimatedSize || 0), 0);
  const largestApp = useMemo(() => {
    if (apps.length === 0) return null;
    return [...apps].sort((a, b) => (b.measuredSize || b.estimatedSize || 0) - (a.measuredSize || a.estimatedSize || 0))[0];
  }, [apps]);

  return (
    <div
      className={`flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar select-none transition-colors ${
        isDarkMode ? 'bg-[#121316] text-[#E3E2E6]' : 'bg-[#F4F5F8] text-[#191C1E]'
      }`}
    >
      <div className="max-w-6xl mx-auto space-y-6 animate-oneui-fade">
        {/* 1. Page Header (Viewing Area) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Installed Applications</h1>
            <p className="mt-1 text-sm opacity-70">
              Measure real on-disk footprint, inspect application file trees, and perform deep uninstallation with leftover removal.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenCompare()}
              className={`px-3.5 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 border transition-all ${
                isDarkMode
                  ? 'bg-[#1C1D22] border-white/[0.08] hover:bg-white/[0.06] text-slate-200'
                  : 'bg-white border-black/[0.06] hover:bg-slate-50 text-slate-700 shadow-xs'
              }`}
              title="Compare Two Applications Side-by-Side"
            >
              <Layers className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span>Compare</span>
            </button>

            <button
              onClick={() => handleExport('csv')}
              disabled={isExporting}
              className={`px-3.5 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 border transition-all ${
                isDarkMode
                  ? 'bg-[#1C1D22] border-white/[0.08] hover:bg-white/[0.06] text-slate-200'
                  : 'bg-white border-black/[0.06] hover:bg-slate-50 text-slate-700 shadow-xs'
              }`}
              title="Export Installed Applications List (CSV)"
            >
              <Download className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => loadApps(true)}
              className={`px-3.5 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 border transition-all ${
                isDarkMode
                  ? 'bg-[#1C1D22] border-white/[0.08] hover:bg-white/[0.06] text-slate-200'
                  : 'bg-white border-black/[0.06] hover:bg-slate-50 text-slate-700 shadow-xs'
              }`}
              title="Rescan Installed Applications"
            >
              <RotateCw className={`w-3.5 h-3.5 text-[#0072DE] ${isLoading ? 'animate-spin' : ''}`} />
              <span>Rescan</span>
            </button>
          </div>
        </div>

        {/* 2. Top Summary Squircles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div
            className={`p-4 rounded-3xl border transition-all ${
              isDarkMode ? 'bg-[#1C1D22] border-white/[0.06] shadow-sm' : 'bg-white border-black/[0.05] shadow-xs'
            }`}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-[#0072DE]/15 text-[#0072DE] flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">Installed Apps</span>
            </div>
            <span className="text-2xl font-extrabold font-mono">{formatNumber(totalAppsCount)}</span>
          </div>

          <div
            className={`p-4 rounded-3xl border transition-all ${
              isDarkMode ? 'bg-[#1C1D22] border-white/[0.06] shadow-sm' : 'bg-white border-black/[0.05] shadow-xs'
            }`}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-[#10B981]/15 text-[#10B981] flex items-center justify-center">
                <HardDrive className="w-4 h-4" />
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">Total Footprint</span>
            </div>
            <span className="text-2xl font-extrabold font-mono text-[#0072DE] dark:text-[#5B95FF]">
              {formatBytes(totalMeasuredBytes)}
            </span>
          </div>

          <div
            className={`p-4 rounded-3xl border transition-all ${
              isDarkMode ? 'bg-[#1C1D22] border-white/[0.06] shadow-sm' : 'bg-white border-black/[0.05] shadow-xs'
            }`}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-[#F59E0B]/15 text-[#F59E0B] flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">Running Now</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-extrabold font-mono">{runningAppsCount}</span>
              {runningAppsCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
              )}
            </div>
          </div>

          <div
            className={`p-4 rounded-3xl border transition-all ${
              isDarkMode ? 'bg-[#1C1D22] border-white/[0.06] shadow-sm' : 'bg-white border-black/[0.05] shadow-xs'
            }`}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-[#8B5CF6]/15 text-[#8B5CF6] flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">Largest App</span>
            </div>
            <span className="text-sm font-bold block truncate" title={largestApp?.displayName || 'None'}>
              {largestApp?.displayName || 'None'}
            </span>
            <span className="text-xs font-mono opacity-70">
              {largestApp?.formattedMeasuredSize || (largestApp?.estimatedSize ? formatBytes(largestApp.estimatedSize) : 'Measuring')}
            </span>
          </div>
        </div>

        {/* 3. Category Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-1">
          <button
            onClick={() => setOnlyRunning(!onlyRunning)}
            className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 ${
              onlyRunning
                ? 'bg-[#10B981] text-white border-[#10B981] shadow-xs'
                : isDarkMode
                ? 'bg-[#1C1D22] text-slate-300 border-white/[0.06] hover:bg-white/[0.06]'
                : 'bg-white text-slate-700 border-black/[0.05] hover:bg-slate-50 shadow-xs'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Running Only ({runningAppsCount})</span>
          </button>

          {CATEGORIES.map((c) => {
            const isSelected = selectedCategory === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setSelectedCategory(c.key)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-[#0072DE] text-white border-[#0072DE] shadow-xs'
                    : isDarkMode
                    ? 'bg-[#1C1D22] text-slate-300 border-white/[0.06] hover:bg-white/[0.06]'
                    : 'bg-white text-slate-700 border-black/[0.05] hover:bg-slate-50 shadow-xs'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* 4. Filter Toolbar & Layout Switcher */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div
            className={`relative flex-1 w-full sm:max-w-md h-10 rounded-full flex items-center px-3.5 border transition-all ${
              isDarkMode ? 'bg-[#1C1D22] border-white/[0.08]' : 'bg-white border-black/[0.06] shadow-xs'
            }`}
          >
            <Search className="w-4 h-4 opacity-50 shrink-0 mr-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search installed applications..."
              className="bg-transparent border-none outline-none w-full text-xs font-medium"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-xs opacity-50 hover:opacity-100 p-1">
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* Sort Dropdown */}
            <div
              className={`flex items-center gap-1.5 h-10 px-3 rounded-full border text-xs font-bold ${
                isDarkMode ? 'bg-[#1C1D22] border-white/[0.08]' : 'bg-white border-black/[0.06] shadow-xs'
              }`}
            >
              <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as any)}
                className="bg-transparent outline-none cursor-pointer"
              >
                <option value="name" className={isDarkMode ? 'bg-[#1C1D22]' : 'bg-white'}>Sort by Name</option>
                <option value="size" className={isDarkMode ? 'bg-[#1C1D22]' : 'bg-white'}>Sort by Size</option>
                <option value="publisher" className={isDarkMode ? 'bg-[#1C1D22]' : 'bg-white'}>Sort by Publisher</option>
                <option value="date" className={isDarkMode ? 'bg-[#1C1D22]' : 'bg-white'}>Sort by Date</option>
              </select>
            </div>

            {/* Layout Toggle */}
            <div
              className={`flex items-center p-1 rounded-full border ${
                isDarkMode ? 'bg-[#1C1D22] border-white/[0.08]' : 'bg-white border-black/[0.06]'
              }`}
            >
              <button
                onClick={() => setViewLayout('list')}
                className={`p-1.5 rounded-full transition-all ${
                  viewLayout === 'list' ? 'bg-[#0072DE] text-white shadow-xs' : 'opacity-60 hover:opacity-100'
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewLayout('grid')}
                className={`p-1.5 rounded-full transition-all ${
                  viewLayout === 'grid' ? 'bg-[#0072DE] text-white shadow-xs' : 'opacity-60 hover:opacity-100'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 5. Applications List / Grid */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full border-3 border-[#0072DE]/20 border-t-[#0072DE] animate-spin mb-4" />
            <span className="text-base font-bold">Scanning Installed Applications...</span>
            <span className="text-xs opacity-60 mt-1">Inspecting 64-bit, 32-bit registry, AppX packages, and running processes</span>
          </div>
        ) : filteredAndSortedApps.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <Package className="w-12 h-12 text-[#0072DE] opacity-30 mb-3" />
            <span className="text-base font-bold">No applications found</span>
            <span className="text-xs opacity-60 mt-1">Try changing your search query or category filter</span>
          </div>
        ) : viewLayout === 'list' ? (
          <div
            className={`rounded-3xl border divide-y overflow-hidden ${
              isDarkMode
                ? 'bg-[#1C1D22] border-white/[0.06] divide-white/[0.04]'
                : 'bg-white border-black/[0.05] divide-black/[0.04] shadow-xs'
            }`}
          >
            {filteredAndSortedApps.map((app) => (
              <div
                key={app.id}
                onClick={() => onSelectApp(app)}
                className={`p-4 flex items-center justify-between gap-4 cursor-pointer transition-colors ${
                  isDarkMode ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50'
                }`}
              >
                {/* Left: Icon & Info */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center shrink-0 overflow-hidden">
                    {app.iconPath ? (
                      <img src={app.iconPath} alt="" className="w-7 h-7 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    ) : (
                      <Package className="w-5 h-5 text-[#0072DE]" />
                    )}
                  </div>

                  <div className="truncate min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold truncate block">{app.displayName}</span>
                      {app.isRunning && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#10B981]/15 text-[#10B981] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                          Running
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs opacity-60 font-medium truncate mt-0.5">
                      <span>{app.publisher}</span>
                      {app.version && (
                        <>
                          <span>•</span>
                          <span className="font-mono">{app.version}</span>
                        </>
                      )}
                      <span>•</span>
                      <span className="capitalize">{app.installType.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Footprint Badge & Actions */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    {app.measuredSize ? (
                      <span className="text-xs font-extrabold font-mono block text-[#0072DE] dark:text-[#5B95FF]">
                        {app.formattedMeasuredSize}
                      </span>
                    ) : app.estimatedSize ? (
                      <span className="text-xs font-bold font-mono opacity-80 block">
                        ~{formatBytes(app.estimatedSize)}
                      </span>
                    ) : (
                      <button
                        onClick={(e) => handleMeasureFootprint(app, e)}
                        disabled={measuringAppId === app.id}
                        className="text-[11px] font-bold text-[#0072DE] hover:underline"
                      >
                        {measuringAppId === app.id ? 'Measuring...' : 'Measure Size'}
                      </button>
                    )}
                    <span className="text-[10px] opacity-50 uppercase font-bold tracking-wider block">
                      {app.measuredSize ? 'Verified Footprint' : 'Reported Size'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {(app.installLocation || app.iconPath || app.packageFamilyName) && (
                      <button
                        onClick={(e) => handleLaunchApp(app, e)}
                        className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors text-emerald-500"
                        title="Launch Application"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    )}

                    {(app.installLocation || app.iconPath) && (
                      <button
                        onClick={(e) => handleOpenLocation(app, e)}
                        className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors text-[#0072DE]"
                        title="Open Installation Location"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={(e) => handleOpenCompare(app, e)}
                      className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors text-[#8B5CF6]"
                      title="Compare with another application"
                    >
                      <Layers className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectApp(app);
                      }}
                      className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors"
                      title="Inspect Application Storage"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenUninstallModal(app);
                      }}
                      className="p-2 rounded-full hover:bg-red-500/15 text-red-500 transition-colors"
                      title="Deep Uninstall Application"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAndSortedApps.map((app) => (
              <div
                key={app.id}
                onClick={() => onSelectApp(app)}
                className={`p-5 rounded-3xl border cursor-pointer transition-all hover:scale-[1.01] ${
                  isDarkMode
                    ? 'bg-[#1C1D22] border-white/[0.06] hover:border-[#0072DE]/40 shadow-sm'
                    : 'bg-white border-black/[0.05] hover:border-[#0072DE]/40 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                    <Package className="w-6 h-6 text-[#0072DE]" />
                  </div>
                  {app.isRunning && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#10B981]/15 text-[#10B981] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                      Running
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-sm truncate" title={app.displayName}>
                  {app.displayName}
                </h3>
                <p className="text-xs opacity-60 truncate mt-0.5">{app.publisher}</p>

                <div className="mt-4 pt-3 border-t border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold opacity-50 block">Footprint</span>
                    <span className="text-xs font-extrabold font-mono text-[#0072DE] dark:text-[#5B95FF]">
                      {app.formattedMeasuredSize || (app.estimatedSize ? `~${formatBytes(app.estimatedSize)}` : 'Click to measure')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {(app.installLocation || app.iconPath || app.packageFamilyName) && (
                      <button
                        onClick={(e) => handleLaunchApp(app, e)}
                        className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors text-emerald-500"
                        title="Launch Application"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    )}

                    {(app.installLocation || app.iconPath) && (
                      <button
                        onClick={(e) => handleOpenLocation(app, e)}
                        className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors text-[#0072DE]"
                        title="Open Installation Folder"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={(e) => handleOpenCompare(app, e)}
                      className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors text-[#8B5CF6]"
                      title="Compare"
                    >
                      <Layers className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenUninstallModal(app);
                      }}
                      className="p-2 rounded-full hover:bg-red-500/15 text-red-500 transition-colors"
                      title="Deep Uninstall"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comparison Modal */}
      <ApplicationCompareModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        apps={apps}
        initialAppA={compareInitialApp}
        onInspectApp={(app) => {
          setIsCompareModalOpen(false);
          onSelectApp(app);
        }}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};
