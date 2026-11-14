import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  Folder,
  File,
  Lock,
  ChevronDown,
  ChevronUp,
  Loader2,
  HardDrive,
  FileCode,
  FileArchive,
  FileText,
  FileVideo,
  FileAudio,
  FileImage,
  Layers,
  ArrowUpDown,
} from 'lucide-react';
import { FileItem, FileCategory, SortField, SortDirection } from '../types';
import { formatBytes, formatDate } from '../utils/formatters';
import { CATEGORY_COLORS, getCategoryBadge } from '../utils/categories';

interface EnrichedListViewProps {
  items: FileItem[];
  totalDirectoryBytes: number;
  selectedItems: Set<string>;
  onToggleSelect: (item: FileItem, multiSelect: boolean, rangeSelect: boolean) => void;
  onOpenItem: (item: FileItem) => void;
  onContextMenu: (e: React.MouseEvent, item: FileItem) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField) => void;
  isFolderSizingActive: boolean;
  isDarkMode: boolean;
}

const ROW_HEIGHT = 52;
const OVERSCAN = 8;

export const EnrichedListView: React.FC<EnrichedListViewProps> = ({
  items,
  totalDirectoryBytes,
  selectedItems,
  onToggleSelect,
  onOpenItem,
  onContextMenu,
  sortField,
  sortDirection,
  onSortChange,
  isFolderSizingActive,
  isDarkMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    observer.observe(el);
    setContainerHeight(el.clientHeight);

    return () => observer.disconnect();
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const totalCount = items.length;
  const totalHeight = totalCount * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(totalCount - 1, Math.floor((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN);

  const visibleItems = useMemo(() => {
    const list: { item: FileItem; index: number }[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      if (items[i]) {
        list.push({ item: items[i], index: i });
      }
    }
    return list;
  }, [items, startIndex, endIndex]);

  const getItemIcon = (item: FileItem) => {
    if (item.isLocked) return <Lock className="w-4 h-4 text-slate-400" />;
    if (item.isDirectory) {
      if (item.isDevCache) return <Layers className="w-4 h-4 text-[#F59E0B]" />;
      return <Folder className="w-4 h-4 text-[#0072DE]" fill="currentColor" fillOpacity={0.25} />;
    }

    switch (item.category) {
      case 'media':
        if (['.mp4', '.mkv', '.mov', '.avi'].includes(item.extension)) {
          return <FileVideo className="w-4 h-4 text-[#E11D48]" />;
        }
        if (['.mp3', '.wav', '.flac', '.ogg'].includes(item.extension)) {
          return <FileAudio className="w-4 h-4 text-[#EC4899]" />;
        }
        return <FileImage className="w-4 h-4 text-[#8B5CF6]" />;
      case 'code':
        return <FileCode className="w-4 h-4 text-[#F59E0B]" />;
      case 'archive':
        return <FileArchive className="w-4 h-4 text-[#EC4899]" />;
      case 'document':
        return <FileText className="w-4 h-4 text-[#0072DE]" />;
      case 'executable':
        return <HardDrive className="w-4 h-4 text-[#10B981]" />;
      default:
        return <File className="w-4 h-4 text-slate-400" />;
    }
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity ml-1" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-[#0072DE] ml-1" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-[#0072DE] ml-1" />
    );
  };

  return (
    <div
      className={`flex-1 flex flex-col h-full overflow-hidden select-none transition-colors ${
        isDarkMode ? 'bg-[#121316] text-[#E3E2E6]' : 'bg-[#F4F5F8] text-[#191C1E]'
      }`}
    >
      {/* Column Headers with One UI Soft Styling */}
      <div
        className={`h-10 px-5 flex items-center text-xs font-bold uppercase tracking-wider shrink-0 transition-colors border-b ${
          isDarkMode
            ? 'bg-[#121316] border-white/[0.04] text-[#94A3B8]'
            : 'bg-[#F4F5F8] border-black/[0.04] text-[#64748B]'
        }`}
      >
        <div
          onClick={() => onSortChange('name')}
          className="flex-1 min-w-[240px] flex items-center cursor-pointer group hover:text-black dark:hover:text-white transition-colors"
        >
          <span>Name</span>
          {renderSortIndicator('name')}
        </div>

        <div className="w-44 px-3 flex items-center gap-1.5">
          <span>Storage Share</span>
          {isFolderSizingActive && (
            <Loader2 className="w-3 h-3 text-[#0072DE] animate-spin" title="Scanning sizes..." />
          )}
        </div>

        <div
          onClick={() => onSortChange('size')}
          className="w-28 px-2 flex items-center justify-end cursor-pointer group hover:text-black dark:hover:text-white transition-colors"
        >
          <span>Size</span>
          {renderSortIndicator('size')}
        </div>

        <div
          onClick={() => onSortChange('extension')}
          className="w-28 px-3 flex items-center cursor-pointer group hover:text-black dark:hover:text-white transition-colors"
        >
          <span>Type</span>
          {renderSortIndicator('extension')}
        </div>

        <div
          onClick={() => onSortChange('modified')}
          className="w-36 px-2 flex items-center justify-end cursor-pointer group hover:text-black dark:hover:text-white transition-colors"
        >
          <span>Modified</span>
          {renderSortIndicator('modified')}
        </div>
      </div>

      {/* Virtualized Rows Container with One UI Generous Row Padding & Squircles */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-1 relative custom-scrollbar"
        tabIndex={0}
      >
        {items.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
            <Folder className="w-10 h-10 stroke-1 opacity-40" />
            <span className="font-medium">No items in this folder</span>
          </div>
        ) : (
          <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
            {visibleItems.map(({ item, index }) => {
              const isSelected = selectedItems.has(item.path);
              const badge = getCategoryBadge(item.category, item.extension, item.isDirectory, item.isDevCache, isDarkMode);

              const itemSize = item.size || 0;
              const sharePercent =
                totalDirectoryBytes > 0 && itemSize > 0
                  ? Math.min(100, Math.round((itemSize / totalDirectoryBytes) * 100))
                  : 0;

              const barFillColor = CATEGORY_COLORS[item.category] || '#0072DE';

              return (
                <div
                  key={item.id}
                  onClick={(e) => onToggleSelect(item, e.ctrlKey || e.metaKey, e.shiftKey)}
                  onDoubleClick={() => onOpenItem(item)}
                  onContextMenu={(e) => onContextMenu(e, item)}
                  style={{
                    position: 'absolute',
                    top: `${index * ROW_HEIGHT}px`,
                    left: 0,
                    right: 0,
                    height: `${ROW_HEIGHT - 4}px`, // 4px margin for clean row separation
                  }}
                  className={`flex items-center px-3.5 rounded-2xl transition-all cursor-pointer text-xs ${
                    isSelected
                      ? isDarkMode
                        ? 'bg-[#0072DE]/20 text-white font-semibold ring-1 ring-[#0072DE]/50'
                        : 'bg-[#0072DE]/10 text-[#0072DE] font-semibold ring-1 ring-[#0072DE]/40'
                      : isDarkMode
                      ? 'hover:bg-white/[0.05] text-[#E3E2E6]'
                      : 'hover:bg-black/[0.04] text-[#191C1E]'
                  }`}
                >
                  {/* Name Column with Squircle Category Icon */}
                  <div className="flex-1 min-w-[240px] flex items-center gap-3 overflow-hidden pr-3">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
                      style={{ backgroundColor: badge.bgColor }}
                    >
                      {getItemIcon(item)}
                    </div>
                    <span className="truncate font-semibold">{item.name}</span>

                    {item.isDevCache && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F59E0B]/15 text-[#F59E0B] shrink-0">
                        Build Cache
                      </span>
                    )}

                    {item.isLocked && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-500/20 text-slate-400 shrink-0">
                        Protected
                      </span>
                    )}
                  </div>

                  {/* Storage Share Column (One UI Smooth Capsule Bar) */}
                  <div className="w-44 px-3 flex items-center gap-2.5 shrink-0">
                    <div
                      className={`flex-1 h-2 rounded-full overflow-hidden ${
                        isDarkMode ? 'bg-white/[0.06]' : 'bg-slate-200/80'
                      }`}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${sharePercent}%`,
                          backgroundColor: barFillColor,
                        }}
                      />
                    </div>
                    <span className="w-9 text-[11px] font-mono opacity-70 text-right">
                      {sharePercent > 0 ? `${sharePercent}%` : '--'}
                    </span>
                  </div>

                  {/* Size Column */}
                  <div className="w-28 px-2 flex items-center justify-end font-mono text-xs tabular-nums shrink-0 font-medium">
                    {item.size !== null ? (
                      <span>{formatBytes(item.size)}</span>
                    ) : (
                      <span className="opacity-40 flex items-center gap-1 text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0072DE] animate-pulse" />
                        Scanning
                      </span>
                    )}
                  </div>

                  {/* Type / Item Count Badge */}
                  <div className="w-28 px-3 flex items-center shrink-0">
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold truncate max-w-[90px]"
                      style={{
                        color: badge.color,
                        backgroundColor: badge.bgColor,
                      }}
                    >
                      {item.isDirectory
                        ? item.fileCount !== undefined
                          ? `${item.fileCount} items`
                          : 'Folder'
                        : badge.text}
                    </span>
                  </div>

                  {/* Modified Date */}
                  <div
                    className="w-36 px-2 flex items-center justify-end opacity-60 font-mono text-[11px] truncate shrink-0"
                    title={formatDate(item.modifiedAt)}
                  >
                    {item.relativeTime}
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
