import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Package,
  HardDrive,
  Folder,
  File,
  Trash2,
  ExternalLink,
  Copy,
  ChevronRight,
  ChevronDown,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Activity,
  FolderOpen,
  RotateCw,
  FileCode,
  FileText,
  Database,
  Layers,
  Sparkles,
  Play,
  Search,
  Download,
} from 'lucide-react';
import {
  InstalledApp,
  AppStorageBreakdown,
  AppFileTreeNode,
  AppLargestFile,
  OwnershipConfidence,
} from '../../types';
import { formatBytes, formatNumber } from '../../utils/formatters';
import { ApiService } from '../../services/api';

interface ApplicationDetailsViewProps {
  app: InstalledApp;
  onBack: () => void;
  onOpenUninstallModal: (app: InstalledApp) => void;
  onRevealPath: (path: string) => void;
  isDarkMode: boolean;
}

export const ApplicationDetailsView: React.FC<ApplicationDetailsViewProps> = ({
  app,
  onBack,
  onOpenUninstallModal,
  onRevealPath,
  isDarkMode,
}) => {
  const [breakdown, setBreakdown] = useState<AppStorageBreakdown | null>(null);
  const [fileTree, setFileTree] = useState<AppFileTreeNode[]>([]);
  const [largestFiles, setLargestFiles] = useState<AppLargestFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'breakdown' | 'tree' | 'largest'>('breakdown');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [treeSearchQuery, setTreeSearchQuery] = useState('');
  const [treeExtFilter, setTreeExtFilter] = useState('all');

  const handleLaunchApp = async () => {
    try {
      const res = await ApiService.launchApp(app.id);
      if (!res.success) {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to launch application');
    }
  };

  const handleExportTree = () => {
    const rows: string[] = ['Name,Path,Size,Type,Confidence'];
    const walk = (nodes: AppFileTreeNode[]) => {
      for (const n of nodes) {
        rows.push(
          `"${(n.name || '').replace(/"/g, '""')}","${(n.path || '').replace(/"/g, '""')}",${n.size},"${
            n.isDirectory ? 'folder' : 'file'
          }","${n.confidence}"`
        );
        if (n.children) walk(n.children);
      }
    };
    walk(fileTree);
    const blob = new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${app.displayName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_file_inventory.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const loadDetails = async () => {
    setIsLoading(true);
    try {
      const [bData, tData, lData] = await Promise.all([
        ApiService.getAppFootprint(app.id),
        ApiService.getAppTree(app.id, 3),
        ApiService.getAppLargestFiles(app.id, 50),
      ]);
      setBreakdown(bData);
      setFileTree(tData.tree || []);
      setLargestFiles(lData.largestFiles || []);
      // Expand top-level roots by default
      if (tData.tree) {
        setExpandedNodes(new Set(tData.tree.map((n) => n.id)));
      }
    } catch (err) {
      console.error('Failed to load app footprint details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [app.id]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const handleCopyPath = (pathText: string) => {
    navigator.clipboard.writeText(pathText);
    setCopiedPath(pathText);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const renderConfidenceBadge = (confidence: OwnershipConfidence) => {
    switch (confidence) {
      case 'verified':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#10B981]/15 text-[#10B981] flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Verified
          </span>
        );
      case 'high_confidence':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0072DE]/15 text-[#0072DE] flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> High Confidence
          </span>
        );
      case 'possible':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F59E0B]/15 text-[#F59E0B] flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" /> Possible
          </span>
        );
      case 'shared':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8B5CF6]/15 text-[#8B5CF6] flex items-center gap-1">
            <Layers className="w-3 h-3" /> Shared
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/15 text-slate-400">
            Unknown
          </span>
        );
    }
  };

  const nodeMatchesSearch = (n: AppFileTreeNode, query: string): boolean => {
    if (!query) return true;
    const q = query.toLowerCase();
    if (n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q)) return true;
    if (n.children && n.children.some((c) => nodeMatchesSearch(c, query))) return true;
    return false;
  };

  const renderTreeNode = (node: AppFileTreeNode, depth = 0) => {
    if (treeSearchQuery.trim() && !nodeMatchesSearch(node, treeSearchQuery)) {
      return null;
    }

    const isExpanded = treeSearchQuery.trim() ? true : expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="select-none">
        <div
          className={`flex items-center justify-between py-1.5 px-2 rounded-xl transition-colors ${
            isDarkMode ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-100'
          }`}
          style={{ paddingLeft: `${Math.max(8, depth * 20)}px` }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {node.isDirectory ? (
              <button
                onClick={() => toggleNode(node.id)}
                className="p-0.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 opacity-70"
              >
                {hasChildren && isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <span className="w-4" />
            )}

            {node.isDirectory ? (
              <Folder className="w-4 h-4 text-[#F59E0B] shrink-0" />
            ) : (
              <File className="w-4 h-4 text-[#0072DE] shrink-0" />
            )}

            <span className="text-xs font-medium truncate block max-w-sm" title={node.name}>
              {node.name}
            </span>

            {node.isDirectory && node.fileCount !== undefined && (
              <span className="text-[10px] opacity-40 font-mono">
                ({node.fileCount} files)
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {node.isSafeToClean && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#F59E0B]/15 text-[#F59E0B]">
                Cache
              </span>
            )}
            <span className="text-xs font-mono font-bold opacity-80">{node.formattedSize}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onRevealPath(node.path)}
                className="p-1 rounded-md opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
                title="Reveal in Explorer"
              >
                <ExternalLink className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleCopyPath(node.path)}
                className="p-1 rounded-md opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
                title="Copy Path"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div className="mt-0.5">
            {node.children!.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar select-none transition-colors ${
        isDarkMode ? 'bg-[#121316] text-[#E3E2E6]' : 'bg-[#F4F5F8] text-[#191C1E]'
      }`}
    >
      <div className="max-w-6xl mx-auto space-y-6 animate-oneui-fade">
        {/* Back Link */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-[#0072DE] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Applications</span>
        </button>

        {/* 1. App Header Hero Card */}
        <div
          className={`p-6 rounded-3xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all ${
            isDarkMode ? 'bg-[#1C1D22] border-white/[0.06] shadow-sm' : 'bg-white border-black/[0.05] shadow-xs'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-3xl bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center shrink-0 overflow-hidden">
              {app.iconPath ? (
                <img src={app.iconPath} alt="" className="w-10 h-10 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
              ) : (
                <Package className="w-8 h-8 text-[#0072DE]" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight">{app.displayName}</h1>
                {app.isRunning && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#10B981]/15 text-[#10B981] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
                    Running
                  </span>
                )}
              </div>
              <p className="text-xs opacity-60 mt-0.5">
                {app.publisher} • Version {app.version} • {app.installType.replace('_', ' ').toUpperCase()}
              </p>
            </div>
          </div>

          {/* Footprint badge & Action Buttons */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
            <div className="text-left md:text-right px-4 py-2 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] w-full sm:w-auto">
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-60 block">Verified Footprint</span>
              <span className="text-2xl font-extrabold font-mono text-[#0072DE] dark:text-[#5B95FF]">
                {breakdown ? breakdown.formattedTotalMeasuredFootprint : 'Measuring...'}
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleLaunchApp}
                className="px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                title="Launch Application"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Launch</span>
              </button>

              <button
                onClick={() => onOpenUninstallModal(app)}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-full bg-[#0072DE] hover:bg-[#005fb8] text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Deep Uninstall</span>
              </button>

              {app.installLocation && (
                <button
                  onClick={() => onRevealPath(app.installLocation!)}
                  className="p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors border border-black/10 dark:border-white/10"
                  title="Open Installation Folder"
                >
                  <FolderOpen className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2. Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-black/[0.06] dark:border-white/[0.06] pb-2">
          <button
            onClick={() => setActiveTab('breakdown')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === 'breakdown'
                ? 'bg-[#0072DE] text-white shadow-xs'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            Storage Breakdown
          </button>
          <button
            onClick={() => setActiveTab('tree')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === 'tree'
                ? 'bg-[#0072DE] text-white shadow-xs'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            Explore Application Files ({fileTree.length} roots)
          </button>
          <button
            onClick={() => setActiveTab('largest')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === 'largest'
                ? 'bg-[#0072DE] text-white shadow-xs'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            Largest Files ({largestFiles.length})
          </button>
        </div>

        {/* 3. Tab Contents */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full border-3 border-[#0072DE]/20 border-t-[#0072DE] animate-spin mb-3" />
            <span className="text-sm font-bold">Measuring application filesystem footprint...</span>
          </div>
        ) : activeTab === 'breakdown' && breakdown ? (
          <div className="space-y-6">
            {/* Storage Distribution Capsule */}
            <div
              className={`p-6 rounded-3xl border space-y-4 ${
                isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider opacity-60">Storage Distribution</span>
                <span className="text-xs font-mono opacity-60">
                  {formatNumber(breakdown.totalFiles)} files in {formatNumber(breakdown.totalFolders)} folders
                </span>
              </div>

              {/* Multi-segment capsule */}
              <div className={`w-full h-3.5 rounded-full overflow-hidden flex p-0.5 ${isDarkMode ? 'bg-[#121316]' : 'bg-slate-100'}`}>
                {breakdown.mainInstallSize > 0 && (
                  <div
                    style={{ width: `${(breakdown.mainInstallSize / breakdown.totalMeasuredFootprint) * 100}%` }}
                    className="h-full bg-[#0072DE] rounded-full transition-all"
                    title={`Main: ${breakdown.formattedMainInstallSize}`}
                  />
                )}
                {breakdown.appDataLocalSize > 0 && (
                  <div
                    style={{ width: `${(breakdown.appDataLocalSize / breakdown.totalMeasuredFootprint) * 100}%` }}
                    className="h-full bg-[#10B981] rounded-full transition-all"
                    title={`AppData Local: ${breakdown.formattedAppDataLocalSize}`}
                  />
                )}
                {breakdown.appDataRoamingSize > 0 && (
                  <div
                    style={{ width: `${(breakdown.appDataRoamingSize / breakdown.totalMeasuredFootprint) * 100}%` }}
                    className="h-full bg-[#8B5CF6] rounded-full transition-all"
                    title={`AppData Roaming: ${breakdown.formattedAppDataRoamingSize}`}
                  />
                )}
                {breakdown.cacheSize > 0 && (
                  <div
                    style={{ width: `${(breakdown.cacheSize / breakdown.totalMeasuredFootprint) * 100}%` }}
                    className="h-full bg-[#F59E0B] rounded-full transition-all"
                    title={`Caches: ${breakdown.formattedCacheSize}`}
                  />
                )}
                {breakdown.programDataSize > 0 && (
                  <div
                    style={{ width: `${(breakdown.programDataSize / breakdown.totalMeasuredFootprint) * 100}%` }}
                    className="h-full bg-[#EC4899] rounded-full transition-all"
                    title={`ProgramData: ${breakdown.formattedProgramDataSize}`}
                  />
                )}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0072DE]" /> Main Install ({breakdown.formattedMainInstallSize})
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" /> AppData Local ({breakdown.formattedAppDataLocalSize})
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" /> AppData Roaming ({breakdown.formattedAppDataRoamingSize})
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" /> Caches ({breakdown.formattedCacheSize})
                </span>
              </div>
            </div>

            {/* Locations Table */}
            <div
              className={`rounded-3xl border divide-y overflow-hidden ${
                isDarkMode
                  ? 'bg-[#1C1D22] border-white/[0.06] divide-white/[0.04]'
                  : 'bg-white border-black/[0.05] divide-black/[0.04] shadow-xs'
              }`}
            >
              <div className="p-4 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between text-xs font-bold opacity-60">
                <span>Discovered Storage Location</span>
                <span>Measured Disk Space</span>
              </div>

              {breakdown.locations.map((loc, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">{loc.label}</span>
                      {renderConfidenceBadge(loc.confidence)}
                    </div>
                    <span className="text-xs font-mono opacity-60 truncate block mt-0.5" title={loc.path}>
                      {loc.path}
                    </span>
                    <span className="text-[10px] opacity-40 font-mono mt-0.5 block">
                      {loc.fileCount} files • {loc.folderCount} folders
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-extrabold font-mono">{loc.formattedSize}</span>
                    <button
                      onClick={() => onRevealPath(loc.path)}
                      className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100"
                      title="Reveal in Explorer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'tree' ? (
          <div
            className={`p-6 rounded-3xl border space-y-4 ${
              isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Application File Hierarchy</h3>
                <p className="text-xs opacity-60 mt-0.5">
                  Real files and folders associated with this application on your local drive.
                </p>
              </div>
              <button
                onClick={() =>
                  setExpandedNodes(
                    expandedNodes.size > 0 ? new Set() : new Set(fileTree.map((n) => n.id))
                  )
                }
                className="text-xs font-bold text-[#0072DE] hover:underline"
              >
                {expandedNodes.size > 0 ? 'Collapse All' : 'Expand All'}
              </button>
            </div>

            {/* Tree Search & Export Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div
                className={`relative flex-1 w-full sm:max-w-xs h-9 rounded-full flex items-center px-3 border transition-all ${
                  isDarkMode ? 'bg-[#16181D] border-white/[0.08]' : 'bg-slate-50 border-black/[0.06]'
                }`}
              >
                <Search className="w-3.5 h-3.5 opacity-50 shrink-0 mr-2" />
                <input
                  type="text"
                  value={treeSearchQuery}
                  onChange={(e) => setTreeSearchQuery(e.target.value)}
                  placeholder="Filter files in application..."
                  className="bg-transparent border-none outline-none w-full text-xs font-medium"
                />
                {treeSearchQuery && (
                  <button onClick={() => setTreeSearchQuery('')} className="text-xs opacity-50 hover:opacity-100">
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportTree}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border transition-all ${
                    isDarkMode
                      ? 'bg-[#16181D] border-white/[0.08] hover:bg-white/[0.06] text-slate-300'
                      : 'bg-slate-50 border-black/[0.06] hover:bg-slate-100 text-slate-700'
                  }`}
                  title="Export File Tree as CSV"
                >
                  <Download className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Export Inventory</span>
                </button>
              </div>
            </div>

            <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
              {fileTree.map((root) => renderTreeNode(root))}
            </div>
          </div>
        ) : (
          /* Largest Files Table */
          <div
            className={`rounded-3xl border divide-y overflow-hidden ${
              isDarkMode
                ? 'bg-[#1C1D22] border-white/[0.06] divide-white/[0.04]'
                : 'bg-white border-black/[0.05] divide-black/[0.04] shadow-xs'
            }`}
          >
            <div className="p-4 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between text-xs font-bold opacity-60">
              <span>File Details</span>
              <span>Size on Disk</span>
            </div>

            {largestFiles.map((file, idx) => (
              <div key={idx} className="p-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="font-mono text-xs opacity-40 w-5">{idx + 1}</span>
                  <File className="w-4 h-4 text-[#0072DE] shrink-0" />
                  <div className="truncate">
                    <span className="text-xs font-bold block truncate">{file.name}</span>
                    <span className="text-[10px] font-mono opacity-50 truncate block" title={file.path}>
                      {file.path}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono font-bold">{file.formattedSize}</span>
                  <button
                    onClick={() => onRevealPath(file.path)}
                    className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100"
                    title="Reveal in Explorer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
