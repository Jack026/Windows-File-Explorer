import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  ExternalLink,
  FolderOpen,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Copy,
  Check,
  Maximize2,
  FileText,
  Code2,
  Table,
  Eye,
} from 'lucide-react';
import { FileItem } from '../../types';
import { ApiService } from '../../services/api';
import { formatBytes } from '../../utils/formatters';

interface AdvancedPreviewModalProps {
  item: FileItem | null;
  isOpen: boolean;
  onClose: () => void;
  onReveal: (item: FileItem) => void;
  onOpenExternal: (item: FileItem) => void;
  isDarkMode: boolean;
}

export const AdvancedPreviewModal: React.FC<AdvancedPreviewModalProps> = ({
  item,
  isOpen,
  onClose,
  onReveal,
  onOpenExternal,
  isDarkMode,
}) => {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textInfo, setTextInfo] = useState<{ totalLines: number; isTruncated: boolean } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [copied, setCopied] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'rendered' | 'source'>('rendered');
  const [parsedCsv, setParsedCsv] = useState<string[][] | null>(null);

  useEffect(() => {
    setTextContent(null);
    setTextInfo(null);
    setParsedCsv(null);
    setZoom(1);
    setRotation(0);
    setActiveSubTab('rendered');

    if (!isOpen || !item || item.isDirectory) return;

    const ext = item.extension.toLowerCase();
    const isTextLike = [
      '.txt', '.md', '.json', '.js', '.ts', '.tsx', '.jsx', '.py', '.rs', '.go',
      '.html', '.css', '.yaml', '.yml', '.xml', '.log', '.sh', '.bat', '.cmd', '.ps1',
      '.sql', '.toml', '.env', '.csv'
    ].includes(ext);

    if (isTextLike) {
      ApiService.getFilePreview(item.path, 'text')
        .then((res) => {
          setTextContent(res.content);
          setTextInfo({ totalLines: res.totalLines, isTruncated: res.isTruncated });

          if (ext === '.csv' && res.content) {
            const rows = res.content
              .split('\n')
              .slice(0, 100)
              .map((row: string) => row.split(',').map((cell: string) => cell.trim()));
            setParsedCsv(rows);
          }
        })
        .catch(() => {
          setTextContent('Preview could not be loaded.');
        });
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const ext = item.extension.toLowerCase();
  const isImage = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.bmp', '.tiff'].includes(ext);
  const isVideo = ['.mp4', '.webm', '.mkv', '.mov'].includes(ext);
  const isAudio = ['.mp3', '.wav', '.ogg', '.flac', '.aac'].includes(ext);
  const isPdf = ext === '.pdf';
  const isMarkdown = ext === '.md';
  const isCsv = ext === '.csv';

  const previewUrl = `http://127.0.0.1:3579/api/preview?path=${encodeURIComponent(item.path)}`;

  const handleCopyContent = () => {
    if (!textContent) return;
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`w-full max-w-5xl h-[85vh] rounded-3xl shadow-2xl border flex flex-col overflow-hidden transition-all ${
          isDarkMode
            ? 'bg-[#12141A] border-white/[0.08] text-[#E3E2E6]'
            : 'bg-white border-black/[0.08] text-slate-800'
        }`}
      >
        {/* Header Bar */}
        <div className="h-14 px-5 flex items-center justify-between border-b border-inherit shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-base font-bold truncate max-w-md">{item.name}</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#0072DE]/10 text-[#0072DE] font-semibold uppercase">
              {item.extension.replace('.', '') || 'file'}
            </span>
            <span className="text-xs text-slate-400">
              {item.formattedSize || formatBytes(item.size || 0)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {textContent && (
              <button
                onClick={handleCopyContent}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1 text-xs"
                title="Copy Content"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
              </button>
            )}

            <button
              onClick={() => onReveal(item)}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="Reveal in Explorer"
            >
              <FolderOpen className="w-4 h-4" />
            </button>

            <button
              onClick={() => onOpenExternal(item)}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="Open with Default App"
            >
              <ExternalLink className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-red-500/10 hover:text-red-400 transition-colors ml-2"
              title="Close Preview (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="flex-1 overflow-hidden relative flex flex-col items-center justify-center p-4">
          {/* Images */}
          {isImage && (
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              <div
                className="transition-transform duration-200"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                }}
              >
                <img
                  src={previewUrl}
                  alt={item.name}
                  className="max-h-[70vh] max-w-full object-contain rounded-2xl shadow-lg select-none"
                />
              </div>

              {/* Floating Image Controls */}
              <div className="absolute bottom-4 flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md text-white shadow-lg border border-white/10 text-xs">
                <button
                  onClick={() => setZoom((z) => Math.max(0.2, z - 0.25))}
                  className="p-1 hover:text-[#0072DE] transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="w-12 text-center font-mono">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                  className="p-1 hover:text-[#0072DE] transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-white/20 mx-1" />
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1 hover:text-[#0072DE] transition-colors flex items-center gap-1"
                  title="Rotate 90°"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>90°</span>
                </button>
              </div>
            </div>
          )}

          {/* Videos */}
          {isVideo && (
            <div className="w-full h-full flex items-center justify-center">
              <video
                src={previewUrl}
                controls
                autoPlay
                className="max-h-[72vh] max-w-full rounded-2xl shadow-xl bg-black"
              >
                Your system does not support native video playback for this format.
              </video>
            </div>
          )}

          {/* Audio */}
          {isAudio && (
            <div className="flex flex-col items-center justify-center p-8 space-y-6 max-w-md w-full">
              <div className="w-24 h-24 rounded-3xl bg-[#0072DE]/10 text-[#0072DE] flex items-center justify-center shadow-inner">
                <div className="flex items-end gap-1 h-10">
                  <div className="w-1.5 h-6 bg-[#0072DE] rounded-full animate-pulse" />
                  <div className="w-1.5 h-10 bg-[#0072DE] rounded-full animate-pulse delay-75" />
                  <div className="w-1.5 h-4 bg-[#0072DE] rounded-full animate-pulse delay-150" />
                  <div className="w-1.5 h-8 bg-[#0072DE] rounded-full animate-pulse delay-100" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="font-bold text-lg">{item.name}</h3>
                <p className="text-xs text-slate-400 mt-1">{item.formattedSize}</p>
              </div>
              <audio src={previewUrl} controls className="w-full" />
            </div>
          )}

          {/* PDF */}
          {isPdf && (
            <iframe
              src={previewUrl}
              title={item.name}
              className="w-full h-full rounded-2xl border border-inherit"
            />
          )}

          {/* CSV Table Preview */}
          {isCsv && parsedCsv && (
            <div className="w-full h-full overflow-auto rounded-2xl border border-inherit text-xs">
              <table className="w-full text-left border-collapse">
                <tbody>
                  {parsedCsv.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={
                        rIdx === 0
                          ? 'bg-black/5 dark:bg-white/[0.05] font-bold border-b border-inherit sticky top-0'
                          : 'border-b border-inherit hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                      }
                    >
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="p-2.5 border-r border-inherit truncate max-w-xs">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Markdown & Code/Text */}
          {!isImage && !isVideo && !isAudio && !isPdf && !isCsv && textContent !== null && (
            <div className="w-full h-full flex flex-col">
              {isMarkdown && (
                <div className="flex items-center gap-2 mb-2 shrink-0">
                  <button
                    onClick={() => setActiveSubTab('rendered')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      activeSubTab === 'rendered'
                        ? 'bg-[#0072DE] text-white'
                        : 'bg-black/5 dark:bg-white/[0.05] text-slate-400'
                    }`}
                  >
                    Rendered
                  </button>
                  <button
                    onClick={() => setActiveSubTab('source')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      activeSubTab === 'source'
                        ? 'bg-[#0072DE] text-white'
                        : 'bg-black/5 dark:bg-white/[0.05] text-slate-400'
                    }`}
                  >
                    Source Code
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-auto rounded-2xl border border-inherit p-4 font-mono text-xs leading-relaxed select-text bg-black/[0.02] dark:bg-white/[0.02]">
                {textInfo?.isTruncated && (
                  <div className="mb-3 p-2 rounded-xl bg-amber-500/10 text-amber-400 text-xs font-sans">
                    File is large. Displaying preview of first {textInfo.totalLines} lines.
                  </div>
                )}
                <pre className="whitespace-pre-wrap break-all">{textContent}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
