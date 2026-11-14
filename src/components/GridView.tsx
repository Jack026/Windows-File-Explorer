import React from 'react';
import {
  Folder,
  File,
  Lock,
  HardDrive,
  FileCode,
  FileArchive,
  FileText,
  FileVideo,
  FileAudio,
  FileImage,
  Layers,
} from 'lucide-react';
import { FileItem } from '../types';
import { formatBytes } from '../utils/formatters';
import { getCategoryBadge } from '../utils/categories';

interface GridViewProps {
  items: FileItem[];
  selectedItems: Set<string>;
  onToggleSelect: (item: FileItem, multiSelect: boolean, rangeSelect: boolean) => void;
  onOpenItem: (item: FileItem) => void;
  onContextMenu: (e: React.MouseEvent, item: FileItem) => void;
  variant?: 'grid' | 'compact' | 'large_icons' | 'xl_icons' | 'gallery';
  isDarkMode: boolean;
}

export const GridView: React.FC<GridViewProps> = ({
  items,
  selectedItems,
  onToggleSelect,
  onOpenItem,
  onContextMenu,
  variant = 'grid',
  isDarkMode,
}) => {
  const getItemIcon = (item: FileItem, sizeClass = 'w-8 h-8') => {
    if (item.isLocked) return <Lock className={`${sizeClass} text-slate-400`} />;
    if (item.isDirectory) {
      if (item.isDevCache) return <Layers className={`${sizeClass} text-[#F59E0B]`} />;
      return <Folder className={`${sizeClass} text-[#0072DE]`} fill="currentColor" fillOpacity={0.25} />;
    }

    switch (item.category) {
      case 'media':
        if (['.mp4', '.mkv', '.mov', '.avi'].includes(item.extension)) {
          return <FileVideo className={`${sizeClass} text-[#E11D48]`} />;
        }
        if (['.mp3', '.wav', '.flac', '.ogg'].includes(item.extension)) {
          return <FileAudio className={`${sizeClass} text-[#EC4899]`} />;
        }
        return <FileImage className={`${sizeClass} text-[#8B5CF6]`} />;
      case 'code':
        return <FileCode className={`${sizeClass} text-[#F59E0B]`} />;
      case 'archive':
        return <FileArchive className={`${sizeClass} text-[#EC4899]`} />;
      case 'document':
        return <FileText className={`${sizeClass} text-[#0072DE]`} />;
      case 'executable':
        return <HardDrive className={`${sizeClass} text-[#10B981]`} />;
      default:
        return <File className={`${sizeClass} text-slate-400`} />;
    }
  };

  // Determine grid columns & preview height based on variant
  let gridClass = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5';
  let previewHeight = 'h-28';
  let iconSize = 'w-8 h-8';

  if (variant === 'compact') {
    gridClass = 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2';
    previewHeight = 'h-10';
    iconSize = 'w-5 h-5';
  } else if (variant === 'large_icons') {
    gridClass = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4';
    previewHeight = 'h-40';
    iconSize = 'w-12 h-12';
  } else if (variant === 'xl_icons') {
    gridClass = 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5';
    previewHeight = 'h-56';
    iconSize = 'w-16 h-16';
  } else if (variant === 'gallery') {
    gridClass = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3';
    previewHeight = 'h-44';
    iconSize = 'w-10 h-10';
  }

  return (
    <div
      className={`flex-1 overflow-y-auto p-5 custom-scrollbar select-none transition-colors ${
        isDarkMode ? 'bg-[#121316] text-[#E3E2E6]' : 'bg-[#F4F5F8] text-[#191C1E]'
      }`}
    >
      <div className={`grid ${gridClass}`}>
        {items.map((item) => {
          const isSelected = selectedItems.has(item.path);
          const badge = getCategoryBadge(item.category, item.extension, item.isDirectory, item.isDevCache, isDarkMode);
          const isImage = item.category === 'media' && ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(item.extension);

          if (variant === 'compact') {
            return (
              <div
                key={item.id}
                onClick={(e) => onToggleSelect(item, e.ctrlKey || e.metaKey, e.shiftKey)}
                onDoubleClick={() => onOpenItem(item)}
                onContextMenu={(e) => onContextMenu(e, item)}
                className={`flex items-center gap-2.5 p-2 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#0072DE]/20 border-[#0072DE] text-[#0072DE]'
                    : isDarkMode
                    ? 'bg-[#1C1D22] border-white/[0.04] hover:bg-[#23252C]'
                    : 'bg-white border-black/[0.04] hover:bg-slate-50'
                }`}
              >
                <div className="shrink-0">{getItemIcon(item, 'w-4 h-4')}</div>
                <span className="text-xs font-medium truncate flex-1" title={item.name}>
                  {item.name}
                </span>
                <span className="text-[10px] font-mono opacity-50 shrink-0">
                  {item.size !== null ? formatBytes(item.size) : '--'}
                </span>
              </div>
            );
          }

          return (
            <div
              key={item.id}
              onClick={(e) => onToggleSelect(item, e.ctrlKey || e.metaKey, e.shiftKey)}
              onDoubleClick={() => onOpenItem(item)}
              onContextMenu={(e) => onContextMenu(e, item)}
              className={`group flex flex-col p-3 rounded-3xl border transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? isDarkMode
                    ? 'bg-[#0072DE]/20 border-[#0072DE] shadow-md shadow-[#0072DE]/10 ring-1 ring-[#0072DE]'
                    : 'bg-[#0072DE]/10 border-[#0072DE] shadow-md shadow-[#0072DE]/10 ring-1 ring-[#0072DE]'
                  : isDarkMode
                  ? 'bg-[#1C1D22] border-white/[0.04] hover:bg-[#23252C] hover:border-white/[0.08]'
                  : 'bg-white border-black/[0.04] hover:bg-slate-50 hover:border-black/[0.08] shadow-xs'
              }`}
            >
              {/* Rounded Preview Container */}
              <div
                className={`${previewHeight} w-full rounded-2xl flex items-center justify-center relative overflow-hidden mb-2.5 transition-colors ${
                  isDarkMode ? 'bg-black/30' : 'bg-slate-100'
                }`}
              >
                {isImage ? (
                  <img
                    src={`http://127.0.0.1:3579/api/preview?path=${encodeURIComponent(item.path)}`}
                    alt={item.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    {getItemIcon(item, iconSize)}
                    <span
                      className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full"
                      style={{ color: badge.color, backgroundColor: badge.bgColor }}
                    >
                      {badge.text}
                    </span>
                  </div>
                )}

                {item.isDevCache && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#F59E0B] text-black shadow-xs">
                    Cache
                  </span>
                )}
              </div>

              {/* Title & Size Metadata */}
              <div className="flex flex-col gap-0.5 px-1">
                <span className="text-xs font-bold truncate" title={item.name}>
                  {item.name}
                </span>

                <div className="flex items-center justify-between text-[11px] font-mono opacity-60">
                  <span>{item.size !== null ? formatBytes(item.size) : '--'}</span>
                  <span>{item.relativeTime}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
