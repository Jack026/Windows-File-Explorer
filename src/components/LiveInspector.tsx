import React, { useState, useEffect } from 'react';
import {
  FileText,
  Folder,
  Image as ImageIcon,
  Film,
  Music,
  FileCode,
  Copy,
  ExternalLink,
  Trash2,
  Edit2,
  Play,
  Terminal,
  Code2,
  Calendar,
  Layers,
  Sparkles,
  Check,
  ZoomIn,
  ZoomOut,
  X,
  Eye,
  Info,
} from 'lucide-react';
import { FileItem } from '../types';
import { formatBytes, formatDate } from '../utils/formatters';
import { getCategoryBadge } from '../utils/categories';
import { ApiService } from '../services/api';

interface LiveInspectorProps {
  selectedItem: FileItem | null;
  onOpen: (item: FileItem) => void;
  onReveal: (item: FileItem) => void;
  onRename: (item: FileItem) => void;
  onTrash: (item: FileItem) => void;
  onOpenProperties?: (item: FileItem) => void;
  onQuickPreview?: (item: FileItem) => void;
  onOpenTerminal: (path: string) => void;
  onOpenVSCode: (path: string) => void;
  onClose: () => void;
  isDarkMode: boolean;
}

export const LiveInspector: React.FC<LiveInspectorProps> = ({
  selectedItem,
  onOpen,
  onReveal,
  onRename,
  onTrash,
  onOpenProperties,
  onQuickPreview,
  onOpenTerminal,
  onOpenVSCode,
  onClose,
  isDarkMode,
}) => {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textInfo, setTextInfo] = useState<{ totalLines: number; isTruncated: boolean } | null>(null);
  const [copiedPath, setCopiedPath] = useState(false);
  const [imgZoom, setImgZoom] = useState(1);
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    setTextContent(null);
    setTextInfo(null);
    setImgDimensions(null);
    setImgZoom(1);

    if (!selectedItem || selectedItem.isDirectory) return;

    const ext = selectedItem.extension.toLowerCase();
    const codeOrText = [
      '.txt', '.md', '.json', '.js', '.ts', '.tsx', '.jsx', '.py', '.rs', '.go',
      '.html', '.css', '.yaml', '.yml', '.xml', '.log', '.sh', '.bat', '.cmd', '.ps1', '.sql', '.toml', '.env'
    ];

    if (codeOrText.includes(ext)) {
      ApiService.getFilePreview(selectedItem.path, 'text')
        .then((res) => {
          setTextContent(res.content);
          setTextInfo({ totalLines: res.totalLines, isTruncated: res.isTruncated });
        })
        .catch(() => {
          setTextContent('Preview unavailable');
        });
    }
  }, [selectedItem]);

  const handleCopyPath = () => {
    if (!selectedItem) return;
    navigator.clipboard.writeText(selectedItem.path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  if (!selectedItem) {
    return (
      <aside
        className={`w-80 border-l flex flex-col items-center justify-center p-6 text-center select-none shrink-0 transition-colors ${
          isDarkMode
            ? 'bg-[#121316] border-white/[0.04] text-[#8E9196]'
            : 'bg-[#F4F5F8] border-black/[0.05] text-[#64748B]'
        }`}
      >
        <div className="w-12 h-12 rounded-3xl bg-black/[0.03] dark:bg-white/[0.05] flex items-center justify-center mb-3">
          <Layers className="w-6 h-6 stroke-1 opacity-50" />
        </div>
        <span className="text-sm font-bold block">No item selected</span>
        <span className="text-xs opacity-70 mt-1 max-w-[200px]">
          Select any file or folder to preview details and quick actions
        </span>
      </aside>
    );
  }

  const isFolder = selectedItem.isDirectory;
  const ext = selectedItem.extension.toLowerCase();
  const isImage = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext);
  const isVideo = ['.mp4', '.webm', '.mkv'].includes(ext);
  const isAudio = ['.mp3', '.wav', '.ogg', '.flac'].includes(ext);
  const isPdf = ext === '.pdf';
  const badge = getCategoryBadge(selectedItem.category, selectedItem.extension, isFolder, selectedItem.isDevCache, isDarkMode);

  const previewUrl = `http://127.0.0.1:3579/api/preview?path=${encodeURIComponent(selectedItem.path)}`;

  return (
    <aside
      className={`w-80 border-l flex flex-col h-full select-none shrink-0 overflow-hidden transition-colors ${
        isDarkMode
          ? 'bg-[#121316] border-white/[0.04] text-[#E3E2E6]'
          : 'bg-[#F4F5F8] border-black/[0.05] text-[#191C1E]'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-black/[0.05] dark:border-white/[0.04] flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider opacity-60">Details</span>
        <button
          onClick={onClose}
          className="p-1 rounded-full opacity-60 hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {/* Item Header & Type Pill */}
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs"
            style={{ backgroundColor: badge.bgColor }}
          >
            {isFolder ? (
              <Folder className="w-6 h-6 text-[#0072DE]" />
            ) : isImage ? (
              <ImageIcon className="w-6 h-6 text-[#8B5CF6]" />
            ) : isVideo ? (
              <Film className="w-6 h-6 text-[#E11D48]" />
            ) : isAudio ? (
              <Music className="w-6 h-6 text-[#EC4899]" />
            ) : (
              <FileCode className="w-6 h-6 text-[#F59E0B]" />
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold break-words select-text leading-tight">
              {selectedItem.name}
            </span>
            <span
              className="text-[10px] font-mono font-bold uppercase mt-1 self-start px-2 py-0.5 rounded-full"
              style={{ color: badge.color, backgroundColor: badge.bgColor }}
            >
              {badge.text}
            </span>
          </div>
        </div>

        {/* Live Native Preview Container (One UI Rounded Card) */}
        <div
          className={`rounded-3xl border overflow-hidden relative ${
            isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
          }`}
        >
          {isImage ? (
            <div className="relative flex flex-col items-center justify-center p-2 min-h-[190px] max-h-[260px] overflow-hidden bg-black/10 dark:bg-black/30">
              <img
                src={previewUrl}
                alt={selectedItem.name}
                style={{ transform: `scale(${imgZoom})` }}
                onLoad={(e) => {
                  const target = e.target as HTMLImageElement;
                  setImgDimensions({ width: target.naturalWidth, height: target.naturalHeight });
                }}
                className="max-h-[220px] object-contain transition-transform duration-200"
              />

              {/* Zoom Controls */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur rounded-full px-2 py-0.5 text-[10px] text-white">
                <button onClick={() => setImgZoom((z) => Math.max(0.5, z - 0.25))} className="hover:opacity-80">
                  <ZoomOut className="w-3 h-3" />
                </button>
                <span className="font-mono">{Math.round(imgZoom * 100)}%</span>
                <button onClick={() => setImgZoom((z) => Math.min(3, z + 0.25))} className="hover:opacity-80">
                  <ZoomIn className="w-3 h-3" />
                </button>
              </div>

              {imgDimensions && (
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur text-[10px] font-mono text-white">
                  {imgDimensions.width} × {imgDimensions.height} px
                </div>
              )}
            </div>
          ) : isVideo ? (
            <div className="p-2 bg-black">
              <video src={previewUrl} controls className="w-full max-h-[220px] rounded-2xl" />
            </div>
          ) : isAudio ? (
            <div className="p-5 flex flex-col items-center justify-center gap-3">
              <Music className="w-10 h-10 text-[#EC4899]" />
              <audio src={previewUrl} controls className="w-full h-8" />
            </div>
          ) : textContent !== null ? (
            <div className="p-3.5 max-h-[240px] overflow-y-auto font-mono text-[11px] custom-scrollbar select-text bg-black/5 dark:bg-black/20">
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-black/[0.05] dark:border-white/[0.05] text-[10px] opacity-60">
                <span>{textInfo?.totalLines || 0} lines</span>
                {textInfo?.isTruncated && <span className="text-[#F59E0B] font-sans">First 500 lines</span>}
              </div>
              <pre className="whitespace-pre-wrap break-all leading-relaxed opacity-90">{textContent}</pre>
            </div>
          ) : isPdf ? (
            <div className="h-44 flex flex-col items-center justify-center p-4 text-center">
              <FileText className="w-10 h-10 text-[#E11D48] mb-2 stroke-1" />
              <span className="text-xs font-bold">PDF Document</span>
              <button
                onClick={() => onOpen(selectedItem)}
                className="mt-3 px-4 py-1.5 rounded-full bg-[#E11D48]/15 text-[#E11D48] text-xs font-bold transition-colors"
              >
                Open in PDF Viewer
              </button>
            </div>
          ) : isFolder ? (
            <div className="p-6 flex flex-col items-center justify-center text-center">
              <Folder className="w-12 h-12 text-[#0072DE] mb-2 stroke-1" />
              <span className="text-xs font-bold">Folder Properties</span>
              <span className="text-xs font-mono opacity-70 mt-1">
                {selectedItem.size !== null ? formatBytes(selectedItem.size) : 'Calculating size...'}
              </span>
            </div>
          ) : (
            <div className="h-28 flex flex-col items-center justify-center text-center opacity-50">
              <FileText className="w-8 h-8 mb-1" />
              <span className="text-xs">No preview available</span>
            </div>
          )}
        </div>

        {/* Action Buttons Row in One UI Pill Style */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onOpen(selectedItem)}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-full bg-[#0072DE] hover:bg-[#0062C4] text-white text-xs font-bold shadow-xs transition-all"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Open</span>
          </button>

          <button
            onClick={() => onReveal(selectedItem)}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-full text-xs font-bold transition-all border ${
              isDarkMode
                ? 'bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border-white/[0.06]'
                : 'bg-white hover:bg-slate-50 text-slate-800 border-black/[0.06] shadow-xs'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Reveal</span>
          </button>

          {onQuickPreview && !isFolder && (
            <button
              onClick={() => onQuickPreview(selectedItem)}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-full text-xs font-bold transition-all border ${
                isDarkMode
                  ? 'bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border-white/[0.06]'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-black/[0.06] shadow-xs'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-[#0072DE]" />
              <span>Preview</span>
            </button>
          )}

          {onOpenProperties && (
            <button
              onClick={() => onOpenProperties(selectedItem)}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-full text-xs font-bold transition-all border ${
                isDarkMode
                  ? 'bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border-white/[0.06]'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-black/[0.06] shadow-xs'
              }`}
            >
              <Info className="w-3.5 h-3.5 text-amber-500" />
              <span>Properties</span>
            </button>
          )}

          <button
            onClick={() => onRename(selectedItem)}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-full text-xs font-bold transition-all border ${
              isDarkMode
                ? 'bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border-white/[0.06]'
                : 'bg-white hover:bg-slate-50 text-slate-800 border-black/[0.06] shadow-xs'
            }`}
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Rename</span>
          </button>

          <button
            onClick={() => onTrash(selectedItem)}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-full bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] text-xs font-bold transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Recycle</span>
          </button>
        </div>

        {/* Quick Launchers for Folders */}
        {isFolder && (
          <div
            className={`p-4 rounded-3xl border space-y-2.5 ${
              isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
            }`}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-60 block">
              Quick Launch
            </span>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => onOpenTerminal(selectedItem.path)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl text-xs font-semibold bg-[#10B981]/15 text-[#10B981] hover:bg-[#10B981]/25 transition-colors"
              >
                <Terminal className="w-4 h-4" />
                <span>Open in PowerShell</span>
              </button>

              <button
                onClick={() => onOpenVSCode(selectedItem.path)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl text-xs font-semibold bg-[#0072DE]/15 text-[#0072DE] dark:text-[#5B95FF] hover:bg-[#0072DE]/25 transition-colors"
              >
                <Code2 className="w-4 h-4" />
                <span>Open in VS Code</span>
              </button>
            </div>
          </div>
        )}

        {/* File / Folder Properties Card */}
        <div
          className={`p-4 rounded-3xl border space-y-3 text-xs ${
            isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider opacity-60 block">
            Properties
          </span>

          <div className="flex justify-between items-center">
            <span className="opacity-60">Size:</span>
            <span className="font-bold font-mono">
              {selectedItem.size !== null ? formatBytes(selectedItem.size) : 'Calculating...'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="opacity-60">Category:</span>
            <span className="capitalize font-semibold">{selectedItem.category}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="opacity-60">Modified:</span>
            <span className="font-mono text-[11px] truncate max-w-[170px]" title={selectedItem.modifiedAt}>
              {formatDate(selectedItem.modifiedAt)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="opacity-60">Created:</span>
            <span className="font-mono text-[11px] truncate max-w-[170px]" title={selectedItem.createdAt}>
              {formatDate(selectedItem.createdAt)}
            </span>
          </div>

          <div className="pt-2 border-t border-black/[0.05] dark:border-white/[0.05]">
            <div className="flex items-center justify-between mb-1">
              <span className="opacity-60 text-[10px] uppercase font-bold">Location</span>
              <button
                onClick={handleCopyPath}
                className="text-[10px] font-bold text-[#0072DE] hover:underline flex items-center gap-1"
              >
                {copiedPath ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3" />}
                <span>{copiedPath ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="text-[11px] opacity-70 break-all select-text font-mono bg-black/5 dark:bg-black/20 p-2 rounded-2xl">
              {selectedItem.path}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
