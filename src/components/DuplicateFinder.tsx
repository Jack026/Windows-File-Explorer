import React, { useState, useMemo } from 'react';
import {
  Copy,
  Trash2,
  CheckCircle2,
  File,
  ExternalLink,
  Sparkles,
  RotateCw,
  Folder,
  Search,
  Download,
  CheckCheck,
  Filter,
} from 'lucide-react';
import { DuplicateGroup, FileItem, FileCategory } from '../types';
import { formatBytes } from '../utils/formatters';

interface DuplicateFinderProps {
  duplicates: DuplicateGroup[];
  isLoading: boolean;
  onRefresh: () => void;
  onReveal: (path: string) => void;
  onTrashItems: (paths: string[]) => void;
  isDarkMode: boolean;
}

export const DuplicateFinder: React.FC<DuplicateFinderProps> = ({
  duplicates,
  isLoading,
  onRefresh,
  onReveal,
  onTrashItems,
  isDarkMode,
}) => {
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const totalWaste = duplicates.reduce((acc, curr) => acc + curr.wasteBytes, 0);

  const toggleSelect = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleSelectKeepNewest = () => {
    const toSelect = new Set<string>();
    for (const group of filteredGroups) {
      const sorted = [...group.items].sort(
        (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
      );
      for (let i = 1; i < sorted.length; i++) {
        toSelect.add(sorted[i].path);
      }
    }
    setSelectedPaths(toSelect);
  };

  const handleSelectKeepOldest = () => {
    const toSelect = new Set<string>();
    for (const group of filteredGroups) {
      const sorted = [...group.items].sort(
        (a, b) => new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime()
      );
      for (let i = 1; i < sorted.length; i++) {
        toSelect.add(sorted[i].path);
      }
    }
    setSelectedPaths(toSelect);
  };

  const handleClearSelection = () => {
    setSelectedPaths(new Set());
  };

  const handleDeleteSelected = () => {
    if (selectedPaths.size > 0) {
      onTrashItems(Array.from(selectedPaths));
      setSelectedPaths(new Set());
    }
  };

  const handleExport = (format: 'csv' | 'json') => {
    if (format === 'json') {
      const jsonContent = JSON.stringify(duplicates, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `duplicate-files-report-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      let csv = 'Group ID,File Name,File Path,Size Bytes,Formatted Size,Modified Date,SHA256\n';
      duplicates.forEach((group, gIdx) => {
        group.items.forEach((item) => {
          csv += `"${gIdx + 1}","${item.name.replace(/"/g, '""')}","${item.path.replace(/"/g, '""')}","${item.size}","${item.formattedSize}","${item.modifiedAt}","${group.hash}"\n`;
        });
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `duplicate-files-report-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Filter duplicate groups based on category and search query
  const filteredGroups = useMemo(() => {
    return duplicates.filter((group) => {
      // Category filter check
      if (categoryFilter !== 'all') {
        const matchesCategory = group.items.some((item) => {
          const cat = item.category || 'other';
          return cat.toLowerCase() === categoryFilter.toLowerCase();
        });
        if (!matchesCategory) return false;
      }

      // Search query filter check
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery = group.items.some(
          (item) => item.name.toLowerCase().includes(q) || item.path.toLowerCase().includes(q)
        );
        if (!matchesQuery) return false;
      }

      return true;
    });
  }, [duplicates, categoryFilter, searchQuery]);

  const filteredWaste = useMemo(() => {
    return filteredGroups.reduce((acc, curr) => acc + curr.wasteBytes, 0);
  }, [filteredGroups]);

  if (isLoading) {
    return (
      <div
        className={`flex-1 flex flex-col items-center justify-center p-8 transition-colors ${
          isDarkMode ? 'bg-[#121316] text-[#E3E2E6]' : 'bg-[#F4F5F8] text-[#191C1E]'
        }`}
      >
        <div className="w-12 h-12 rounded-full border-3 border-[#EC4899]/20 border-t-[#EC4899] animate-spin mb-4" />
        <span className="text-lg font-bold">Scanning for Duplicate Files...</span>
        <span className="text-xs opacity-60 mt-1">Comparing file sizes & verifying SHA-256 signatures</span>
      </div>
    );
  }

  return (
    <div
      className={`flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar select-none transition-colors ${
        isDarkMode ? 'bg-[#121316] text-[#E3E2E6]' : 'bg-[#F4F5F8] text-[#191C1E]'
      }`}
    >
      <div className="max-w-5xl mx-auto space-y-6 animate-oneui-fade">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Duplicate Files</h1>
            <p className="mt-1 text-sm opacity-70">
              Find and safely clean duplicate files wasting space on your drive
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('csv')}
              className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
                isDarkMode
                  ? 'bg-white/[0.06] hover:bg-white/[0.1] text-white border-white/[0.06]'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-black/[0.05] shadow-xs'
              }`}
              title="Export report as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              onClick={() => handleExport('json')}
              className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
                isDarkMode
                  ? 'bg-white/[0.06] hover:bg-white/[0.1] text-white border-white/[0.06]'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-black/[0.05] shadow-xs'
              }`}
              title="Export report as JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
            <button
              onClick={onRefresh}
              className={`p-2 rounded-full transition-all border ${
                isDarkMode
                  ? 'bg-white/[0.06] hover:bg-white/[0.1] text-white border-white/[0.06]'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-black/[0.05] shadow-xs'
              }`}
              title="Rescan for duplicates"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Overview Banner Card (One UI Style) */}
        <div
          className={`p-6 rounded-3xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
            isDarkMode ? 'bg-[#1C1D22] border-white/[0.06] shadow-sm' : 'bg-white border-black/[0.05] shadow-xs'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#EC4899]/15 text-[#EC4899] flex items-center justify-center shrink-0">
              <Copy className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold">
                  Found {filteredGroups.length} duplicate group{filteredGroups.length === 1 ? '' : 's'}
                </span>
                {categoryFilter !== 'all' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EC4899]/15 text-[#EC4899] capitalize">
                    {categoryFilter}
                  </span>
                )}
              </div>
              <p className="text-xs opacity-70 mt-0.5">
                Redundant files are consuming{' '}
                <strong className="text-[#EC4899] font-mono text-sm">{formatBytes(filteredWaste)}</strong> of disk space.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={handleSelectKeepNewest}
              className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all border ${
                isDarkMode
                  ? 'bg-white/[0.06] hover:bg-white/[0.1] text-white border-white/[0.06]'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-black/[0.05]'
              }`}
              title="Select all older copies, keeping the newest file in each group"
            >
              Keep Newest
            </button>

            <button
              onClick={handleSelectKeepOldest}
              className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all border ${
                isDarkMode
                  ? 'bg-white/[0.06] hover:bg-white/[0.1] text-white border-white/[0.06]'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-black/[0.05]'
              }`}
              title="Select all newer copies, keeping the original oldest file in each group"
            >
              Keep Oldest
            </button>

            {selectedPaths.size > 0 && (
              <button
                onClick={handleClearSelection}
                className="px-3 py-2 rounded-full text-xs font-bold text-slate-400 hover:text-white transition-all"
              >
                Clear ({selectedPaths.size})
              </button>
            )}

            <button
              onClick={handleDeleteSelected}
              disabled={selectedPaths.size === 0}
              className="px-5 py-2 rounded-full bg-[#EC4899] hover:bg-[#DB2777] disabled:opacity-40 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Recycle Selected ({selectedPaths.size})</span>
            </button>
          </div>
        </div>

        {/* Category Filters & Search Bar */}
        <div
          className={`p-4 rounded-3xl border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 ${
            isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
          }`}
        >
          <div className="flex-1 flex items-center gap-2">
            <Search className="w-4 h-4 opacity-50 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search duplicates by file name or path..."
              className="flex-1 bg-transparent text-xs font-mono outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs opacity-50 hover:opacity-100 px-2"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'all', label: 'All Files' },
              { id: 'media', label: 'Media' },
              { id: 'document', label: 'Documents' },
              { id: 'code', label: 'Code' },
              { id: 'archive', label: 'Archives' },
              { id: 'other', label: 'Other' },
            ].map((cat) => {
              const isSel = categoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    isSel
                      ? 'bg-[#EC4899] text-white shadow-xs'
                      : isDarkMode
                      ? 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Duplicate Clusters List */}
        {filteredGroups.length === 0 ? (
          <div
            className={`p-12 text-center rounded-3xl border ${
              isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05]'
            }`}
          >
            <CheckCircle2 className="w-12 h-12 text-[#10B981] mx-auto mb-3 stroke-1" />
            <span className="text-base font-bold block">No Duplicate Files Found</span>
            <span className="text-xs opacity-60 mt-1 block">
              {searchQuery || categoryFilter !== 'all'
                ? 'No duplicates match your current search query or category filter.'
                : 'All scanned files have distinct content.'}
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredGroups.map((group, groupIdx) => (
              <div
                key={group.hash}
                className={`p-5 rounded-3xl border space-y-3 transition-all ${
                  isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-black/[0.05] dark:border-white/[0.05] text-xs">
                  <div className="flex items-center gap-2">
                    <span className="opacity-50 font-mono text-[11px]">#{groupIdx + 1}</span>
                    <span className="font-bold text-sm">
                      {group.items[0]?.name}
                    </span>
                    <span className="text-[10px] font-mono opacity-60 bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-0.5 rounded-full">
                      {group.items.length} copies • {group.formattedSize} each
                    </span>
                    <span className="text-[9px] font-mono opacity-40 px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 truncate max-w-[120px]" title={group.hash}>
                      SHA: {group.hash.slice(0, 8)}...
                    </span>
                  </div>

                  <span className="text-xs font-mono text-[#EC4899] font-bold">
                    Wastes {group.formattedWaste}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {group.items.map((item) => {
                    const isSelected = selectedPaths.has(item.path);
                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleSelect(item.path)}
                        className={`flex items-center justify-between p-2.5 rounded-2xl text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#EC4899]/15 border border-[#EC4899]/40 font-semibold'
                            : isDarkMode ? 'hover:bg-white/[0.04]' : 'hover:bg-black/[0.03]'
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate max-w-xl">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded-full text-[#EC4899] focus:ring-0 shrink-0"
                          />
                          <File className="w-4 h-4 opacity-50 shrink-0" />
                          <span className="truncate font-mono text-[11px] opacity-80">{item.path}</span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 font-mono text-[11px] opacity-70">
                          <span>{item.relativeTime}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onReveal(item.path);
                            }}
                            className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                            title="Reveal in Explorer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
