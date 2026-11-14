import React, { useState, useEffect, useMemo } from 'react';
import {
  HardDrive,
  File,
  FileVideo,
  FileArchive,
  FileCode,
  FileText,
  Trash2,
  ExternalLink,
  Eye,
  Copy,
  Check,
  RotateCw,
  Search,
  SlidersHorizontal,
  Clock,
  AlertTriangle,
  FolderOpen,
  ArrowUpDown,
  Layers,
} from 'lucide-react';
import { LargeFileItem, FileCategory, FileItem } from '../../types';
import { ApiService } from '../../services/api';
import { formatBytes, formatDate } from '../../utils/formatters';
import { CATEGORY_COLORS } from '../../utils/categories';

interface LargeFilesViewProps {
  currentPath: string;
  onPreviewItem: (fileItem: FileItem) => void;
  onRevealPath: (path: string) => void;
  onTrashItems: (paths: string[]) => void;
  isDarkMode: boolean;
}

const SIZE_PRESETS = [
  { label: '>50 MB', bytes: 50 * 1024 * 1024 },
  { label: '>100 MB', bytes: 100 * 1024 * 1024 },
  { label: '>500 MB', bytes: 500 * 1024 * 1024 },
  { label: '>1 GB', bytes: 1024 * 1024 * 1024 },
  { label: '>5 GB', bytes: 5 * 1024 * 1024 * 1024 },
];

export const LargeFilesView: React.FC<LargeFilesViewProps> = ({
  currentPath,
  onPreviewItem,
  onRevealPath,
  onTrashItems,
  isDarkMode,
}) => {
  const [files, setFiles] = useState<LargeFileItem[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMinSize, setSelectedMinSize] = useState(50 * 1024 * 1024);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [staleOnly, setStaleOnly] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<'size' | 'modified' | 'name'>('size');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const fetchLargeFiles = async () => {
    setIsLoading(true);
    setSelectedPaths(new Set());
    try {
      const res = await ApiService.getLargeFiles({
        path: currentPath,
        minSize: selectedMinSize,
        category: selectedCategory,
        staleOnly,
        limit: 250,
      });
      setFiles(res.files);
      setTotalBytes(res.totalBytes);
    } catch (err) {
      console.error('Failed to fetch large files:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLargeFiles();
  }, [currentPath, selectedMinSize, selectedCategory, staleOnly]);

  const handleCopyPath = (filePath: string) => {
    navigator.clipboard.writeText(filePath);
    setCopiedPath(filePath);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const handleToggleSelect = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedPaths.size === filteredAndSortedFiles.length) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(filteredAndSortedFiles.map((f) => f.path)));
    }
  };

  const handleTrashSelected = () => {
    if (selectedPaths.size === 0) return;
    onTrashItems(Array.from(selectedPaths));
    setSelectedPaths(new Set());
  };

  const getCategoryIcon = (category: FileCategory) => {
    switch (category) {
      case 'media':
        return <FileVideo className="w-4 h-4 text-[#8B5CF6]" />;
      case 'archive':
        return <FileArchive className="w-4 h-4 text-[#EC4899]" />;
      case 'code':
        return <FileCode className="w-4 h-4 text-[#F59E0B]" />;
      case 'document':
        return <FileText className="w-4 h-4 text-[#3B82F6]" />;
      default:
        return <File className="w-4 h-4 text-slate-400" />;
    }
  };

  const filteredAndSortedFiles = useMemo(() => {
    let result = [...files];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q) || f.extension.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      if (sortField === 'size') {
        return sortDirection === 'desc' ? b.size - a.size : a.size - b.size;
      }
      if (sortField === 'name') {
        const cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      if (sortField === 'modified') {
        const timeA = new Date(a.modifiedAt).getTime();
        const timeB = new Date(b.modifiedAt).getTime();
        return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }
      return 0;
    });

    return result;
  }, [files, searchQuery, sortField, sortDirection]);

  const selectedBytes = useMemo(() => {
    return files
      .filter((f) => selectedPaths.has(f.path))
      .reduce((acc, curr) => acc + curr.size, 0);
  }, [files, selectedPaths]);

  const toFileItem = (f: LargeFileItem): FileItem => ({
    id: f.id,
    name: f.name,
    path: f.path,
    isDirectory: false,
    isFile: true,
    size: f.size,
    formattedSize: f.formattedSize,
    extension: f.extension,
    category: f.category,
    createdAt: f.createdAt,
    modifiedAt: f.modifiedAt,
    relativeTime: f.relativeTime,
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full select-none">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Large File Finder</h1>
          <p className="text-sm text-slate-400">
            Identify the largest disk-space consumers across <span className="font-mono text-slate-300">{currentPath}</span> and safely reclaim storage.
          </p>
        </div>

        <button
          onClick={fetchLargeFiles}
          disabled={isLoading}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
            isDarkMode
              ? 'bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border-white/[0.08]'
              : 'bg-white hover:bg-slate-50 text-slate-800 border-black/[0.08] shadow-xs'
          }`}
        >
          <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#0072DE]' : ''}`} />
          <span>Refresh Scan</span>
        </button>
      </div>

      {/* Aggregate Storage Stats Card */}
      <div
        className={`p-6 rounded-3xl border transition-all ${
          isDarkMode
            ? 'bg-gradient-to-br from-[#16181D] to-[#121316] border-white/[0.06]'
            : 'bg-white border-black/[0.06] shadow-sm'
        }`}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-xs text-slate-400 font-medium block">Total Large Files</span>
            <span className="text-2xl font-bold font-mono text-[#0072DE]">{files.length}</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium block">Total Consumed</span>
            <span className="text-2xl font-bold font-mono text-amber-500">{formatBytes(totalBytes)}</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium block">Largest File</span>
            <span className="text-2xl font-bold font-mono text-rose-500">
              {files.length > 0 ? formatBytes(files[0].size) : '0 B'}
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium block">Stale Hogs (&gt;180d)</span>
            <span className="text-2xl font-bold font-mono text-violet-400">
              {files.filter((f) => f.isStale).length}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div
        className={`p-4 rounded-3xl border flex flex-col md:flex-row items-center justify-between gap-4 ${
          isDarkMode ? 'bg-[#181A20] border-white/[0.06]' : 'bg-white border-black/[0.06] shadow-xs'
        }`}
      >
        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search large files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-3 py-1.5 rounded-full text-xs outline-none transition-colors border ${
              isDarkMode
                ? 'bg-black/30 border-white/[0.08] text-white focus:border-[#0072DE]'
                : 'bg-slate-50 border-black/[0.08] text-slate-900 focus:border-[#0072DE]'
            }`}
          />
        </div>

        {/* Size Preset Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-400 font-medium mr-1">Threshold:</span>
          {SIZE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => setSelectedMinSize(preset.bytes)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                selectedMinSize === preset.bytes
                  ? 'bg-[#0072DE] text-white shadow-xs'
                  : isDarkMode
                  ? 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Stale Toggle */}
        <button
          onClick={() => setStaleOnly(!staleOnly)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            staleOnly
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              : isDarkMode
              ? 'bg-white/[0.04] text-slate-400 border-white/[0.08] hover:text-slate-200'
              : 'bg-slate-100 text-slate-600 border-black/[0.08] hover:text-slate-900'
          }`}
          title="Filter files not modified or accessed in >180 days"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Stale (&gt;180d)</span>
        </button>
      </div>

      {/* Batch Actions Bar (when items selected) */}
      {selectedPaths.size > 0 && (
        <div
          className={`p-3.5 px-6 rounded-full border flex items-center justify-between animate-slide-up shadow-lg ${
            isDarkMode
              ? 'bg-[#1C1F26] border-white/[0.1] text-white'
              : 'bg-slate-900 text-white border-transparent'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold bg-[#0072DE] px-2.5 py-0.5 rounded-full">
              {selectedPaths.size} selected
            </span>
            <span className="text-xs text-slate-300 font-mono">
              Reclaimable: <strong className="text-emerald-400">{formatBytes(selectedBytes)}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedPaths(new Set())}
              className="text-xs text-slate-400 hover:text-white px-3 py-1 rounded-full transition-colors"
            >
              Deselect All
            </button>
            <button
              onClick={handleTrashSelected}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Move to Recycle Bin</span>
            </button>
          </div>
        </div>
      )}

      {/* Files List / Table */}
      <div
        className={`rounded-3xl border overflow-hidden transition-all ${
          isDarkMode ? 'bg-[#16181D] border-white/[0.06]' : 'bg-white border-black/[0.06] shadow-sm'
        }`}
      >
        <div
          className={`grid grid-cols-12 gap-2 px-6 py-3 border-b text-[11px] font-bold uppercase tracking-wider ${
            isDarkMode
              ? 'bg-black/20 border-white/[0.06] text-slate-400'
              : 'bg-slate-50 border-black/[0.06] text-slate-500'
          }`}
        >
          <div className="col-span-1 flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedPaths.size > 0 && selectedPaths.size === filteredAndSortedFiles.length}
              onChange={handleSelectAll}
              className="rounded accent-[#0072DE] cursor-pointer"
            />
            <span>Type</span>
          </div>
          <div
            className="col-span-5 flex items-center gap-1 cursor-pointer hover:text-[#0072DE]"
            onClick={() => {
              if (sortField === 'name') setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
              else {
                setSortField('name');
                setSortDirection('asc');
              }
            }}
          >
            <span>File Name & Path</span>
            <ArrowUpDown className="w-3 h-3 opacity-60" />
          </div>
          <div
            className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-[#0072DE] justify-end"
            onClick={() => {
              if (sortField === 'size') setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
              else {
                setSortField('size');
                setSortDirection('desc');
              }
            }}
          >
            <span>Size</span>
            <ArrowUpDown className="w-3 h-3 opacity-60" />
          </div>
          <div
            className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-[#0072DE] justify-end"
            onClick={() => {
              if (sortField === 'modified') setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
              else {
                setSortField('modified');
                setSortDirection('desc');
              }
            }}
          >
            <span>Modified</span>
            <ArrowUpDown className="w-3 h-3 opacity-60" />
          </div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RotateCw className="w-6 h-6 animate-spin text-[#0072DE]" />
            <span className="text-xs font-semibold">Scanning directory for large files...</span>
          </div>
        ) : filteredAndSortedFiles.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-1">
            <HardDrive className="w-8 h-8 mx-auto opacity-40 mb-2" />
            <p className="text-sm font-semibold">No large files found matching criteria</p>
            <p className="text-xs opacity-60">Try lowering the threshold or clearing filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {filteredAndSortedFiles.map((file) => {
              const isSelected = selectedPaths.has(file.path);
              return (
                <div
                  key={file.id}
                  className={`grid grid-cols-12 gap-2 px-6 py-3 items-center text-xs transition-colors ${
                    isSelected
                      ? isDarkMode
                        ? 'bg-[#0072DE]/10'
                        : 'bg-[#0072DE]/5'
                      : isDarkMode
                      ? 'hover:bg-white/[0.02]'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="col-span-1 flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(file.path)}
                      className="rounded accent-[#0072DE] cursor-pointer"
                    />
                    <div className="shrink-0">{getCategoryIcon(file.category)}</div>
                  </div>

                  <div className="col-span-5 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate text-slate-200 dark:text-white" title={file.name}>
                        {file.name}
                      </span>
                      {file.isStale && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-semibold shrink-0">
                          Stale
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate font-mono" title={file.path}>
                      {file.path}
                    </div>
                  </div>

                  <div className="col-span-2 text-right font-mono font-bold text-amber-500">
                    {file.formattedSize}
                  </div>

                  <div className="col-span-2 text-right font-mono text-[11px] text-slate-400">
                    {file.relativeTime}
                  </div>

                  <div className="col-span-2 flex items-center justify-end gap-1">
                    <button
                      onClick={() => onPreviewItem(toFileItem(file))}
                      className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                      title="Quick Preview"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onRevealPath(file.path)}
                      className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                      title="Reveal in File Explorer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleCopyPath(file.path)}
                      className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                      title="Copy Full Path"
                    >
                      {copiedPath === file.path ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      onClick={() => onTrashItems([file.path])}
                      className="p-1.5 rounded-full hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                      title="Move to Recycle Bin"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
