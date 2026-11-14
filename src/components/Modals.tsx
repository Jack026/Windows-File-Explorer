import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  Trash2,
  Edit2,
  X,
  Check,
  Folder,
  File,
  Terminal,
  Code2,
  ExternalLink,
  PieChart,
  Copy,
  Scissors,
  ClipboardPaste,
} from 'lucide-react';
import { FileItem } from '../types';

// ==========================================
// 1. One UI Rename Modal (F2)
// ==========================================
interface RenameModalProps {
  item: FileItem | null;
  isOpen: boolean;
  onClose: () => void;
  onRename: (source: string, newName: string) => Promise<void>;
  isDarkMode: boolean;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  item,
  isOpen,
  onClose,
  onRename,
  isDarkMode,
}) => {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (item && isOpen) {
      setName(item.name);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          if (item.isFile && item.extension) {
            const extIndex = item.name.lastIndexOf(item.extension);
            if (extIndex > 0) {
              inputRef.current.setSelectionRange(0, extIndex);
              return;
            }
          }
          inputRef.current.select();
        }
      }, 50);
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && name !== item.name) {
      await onRename(item.path, name.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 select-none animate-oneui-fade">
      <div
        className={`w-full max-w-md rounded-3xl p-6 shadow-2xl border transition-all ${
          isDarkMode
            ? 'bg-[#1C1D22] border-white/[0.08] text-[#E3E2E6]'
            : 'bg-white border-black/[0.06] text-[#191C1E]'
        }`}
      >
        <div className="flex items-center justify-between pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0072DE]/15 text-[#0072DE] flex items-center justify-center">
              <Edit2 className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-base">Rename</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-full opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-xs opacity-60 block mb-2 font-semibold">Name:</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0072DE] font-mono border ${
                isDarkMode ? 'bg-[#121316] border-white/[0.08] text-white' : 'bg-slate-50 border-black/[0.06] text-black'
              }`}
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-5 py-2.5 rounded-full text-xs font-bold transition-colors ${
                isDarkMode ? 'bg-white/[0.06] hover:bg-white/[0.1] text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full bg-[#0072DE] hover:bg-[#0062C4] text-white text-xs font-bold transition-all shadow-xs"
            >
              Rename
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 2. One UI Recycle Bin Confirmation Modal
// ==========================================
interface DeleteConfirmModalProps {
  isOpen: boolean;
  items: FileItem[];
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDarkMode: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  items,
  onClose,
  onConfirm,
  isDarkMode,
}) => {
  if (!isOpen || items.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 select-none animate-oneui-fade">
      <div
        className={`w-full max-w-md rounded-3xl p-6 shadow-2xl border transition-all ${
          isDarkMode
            ? 'bg-[#1C1D22] border-white/[0.08] text-[#E3E2E6]'
            : 'bg-white border-black/[0.06] text-[#191C1E]'
        }`}
      >
        <div className="flex items-center gap-3.5 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-[#EF4444]/15 text-[#EF4444] flex items-center justify-center shrink-0">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <span className="font-extrabold text-base block">Move to Recycle Bin?</span>
            <span className="text-xs opacity-70 truncate max-w-[280px] block">
              {items.length === 1 ? `"${items[0].name}"` : `${items.length} selected items`}
            </span>
          </div>
        </div>

        <p className={`text-xs p-3.5 rounded-2xl leading-relaxed my-4 ${isDarkMode ? 'bg-[#121316]' : 'bg-slate-50'}`}>
          These files will be sent to the <strong>Windows Recycle Bin</strong>. You can easily restore them at any time if needed.
        </p>

        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className={`px-5 py-2.5 rounded-full text-xs font-bold transition-colors ${
              isDarkMode ? 'bg-white/[0.06] hover:bg-white/[0.1] text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2.5 rounded-full bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Move to Recycle Bin</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. One UI Transfer Toast Pill
// ==========================================
interface TransferToastProps {
  isVisible: boolean;
  message: string;
  subMessage?: string;
  isDarkMode: boolean;
}

export const TransferToast: React.FC<TransferToastProps> = ({
  isVisible,
  message,
  subMessage,
  isDarkMode,
}) => {
  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3.5 px-4 py-3 rounded-full border shadow-2xl backdrop-blur-md text-xs select-none animate-slide-up max-w-sm ${
        isDarkMode
          ? 'bg-[#1C1D22]/95 border-white/[0.1] text-white'
          : 'bg-white/95 border-black/[0.08] text-black'
      }`}
    >
      <div className="w-3 h-3 rounded-full bg-[#0072DE] animate-pulse shrink-0" />
      <div className="flex flex-col min-w-0">
        <span className="font-bold truncate">{message}</span>
        {subMessage && <span className="text-[11px] opacity-60 font-mono truncate">{subMessage}</span>}
      </div>
    </div>
  );
};

// ==========================================
// 4. One UI Clean Desktop Context Menu
// ==========================================
interface ContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  item: FileItem | null;
  onClose: () => void;
  onOpen: () => void;
  onPreview?: () => void;
  onProperties?: () => void;
  onDuplicate?: () => void;
  onAnalyzeStorage: () => void;
  onOpenTerminal: () => void;
  onOpenVSCode: () => void;
  onCopyPath: () => void;
  onCopyFileName?: () => void;
  onRename: () => void;
  onTrash: () => void;
  onCopy: () => void;
  onCut: () => void;
  isDarkMode: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  isOpen,
  item,
  onClose,
  onOpen,
  onPreview,
  onProperties,
  onDuplicate,
  onAnalyzeStorage,
  onOpenTerminal,
  onOpenVSCode,
  onCopyPath,
  onCopyFileName,
  onRename,
  onTrash,
  onCopy,
  onCut,
  isDarkMode,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const clampedX = Math.min(x, window.innerWidth - 220);
  const clampedY = Math.min(y, window.innerHeight - 380);

  return (
    <div
      ref={menuRef}
      style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
      className={`fixed z-50 w-56 rounded-3xl p-1.5 shadow-2xl border backdrop-blur-md text-xs select-none animate-oneui-fade ${
        isDarkMode
          ? 'bg-[#1C1D22]/95 border-white/[0.08] text-[#E3E2E6]'
          : 'bg-white/95 border-black/[0.08] text-[#191C1E]'
      }`}
    >
      <div className="px-3.5 py-2 font-bold opacity-60 border-b border-black/[0.05] dark:border-white/[0.05] text-[11px] truncate">
        {item.name}
      </div>

      <div className="py-1 space-y-0.5 max-h-[70vh] overflow-y-auto custom-scrollbar">
        <button
          onClick={() => { onOpen(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-[#0072DE]/10 hover:text-[#0072DE] font-semibold transition-colors"
        >
          <ExternalLink className="w-4 h-4 text-[#0072DE]" />
          <span>Open</span>
          <span className="ml-auto text-[10px] opacity-40 font-mono">Enter</span>
        </button>

        {onPreview && !item.isDirectory && (
          <button
            onClick={() => { onPreview(); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-[#0072DE]/10 hover:text-[#0072DE] font-semibold transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-[#0072DE]" />
            <span>Quick Preview</span>
            <span className="ml-auto text-[10px] opacity-40 font-mono">Space</span>
          </button>
        )}

        {item.isDirectory && (
          <button
            onClick={() => { onAnalyzeStorage(); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-[#0072DE]/10 hover:text-[#0072DE] font-semibold transition-colors"
          >
            <PieChart className="w-4 h-4 text-[#0072DE]" />
            <span>Analyze Storage</span>
          </button>
        )}

        <button
          onClick={() => { onOpenTerminal(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <Terminal className="w-4 h-4 text-[#10B981]" />
          <span>Open Terminal</span>
        </button>

        <button
          onClick={() => { onOpenVSCode(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <Code2 className="w-4 h-4 text-[#0072DE]" />
          <span>Open in VS Code</span>
        </button>

        <div className="h-px bg-black/[0.05] dark:bg-white/[0.05] my-1" />

        <button
          onClick={() => { onCopy(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <Copy className="w-4 h-4 opacity-60" />
          <span>Copy</span>
          <span className="ml-auto text-[10px] opacity-40 font-mono">Ctrl+C</span>
        </button>

        <button
          onClick={() => { onCut(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <Scissors className="w-4 h-4 opacity-60" />
          <span>Cut</span>
          <span className="ml-auto text-[10px] opacity-40 font-mono">Ctrl+X</span>
        </button>

        {onDuplicate && (
          <button
            onClick={() => { onDuplicate(); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <Copy className="w-4 h-4 text-[#10B981]" />
            <span>Duplicate</span>
            <span className="ml-auto text-[10px] opacity-40 font-mono">Ctrl+D</span>
          </button>
        )}

        <button
          onClick={() => { onCopyPath(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <Copy className="w-4 h-4 opacity-60" />
          <span>Copy Full Path</span>
        </button>

        {onCopyFileName && (
          <button
            onClick={() => { onCopyFileName(); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <Copy className="w-4 h-4 opacity-60" />
            <span>Copy Name</span>
          </button>
        )}

        <button
          onClick={() => { onRename(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <Edit2 className="w-4 h-4 opacity-60" />
          <span>Rename</span>
          <span className="ml-auto text-[10px] opacity-40 font-mono">F2</span>
        </button>

        {onProperties && (
          <button
            onClick={() => { onProperties(); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-[#0072DE]/10 hover:text-[#0072DE] font-semibold transition-colors"
          >
            <File className="w-4 h-4 text-[#0072DE]" />
            <span>Properties</span>
            <span className="ml-auto text-[10px] opacity-40 font-mono">Alt+Enter</span>
          </button>
        )}

        <div className="h-px bg-black/[0.05] dark:bg-white/[0.05] my-1" />

        <button
          onClick={() => { onTrash(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl text-[#EF4444] hover:bg-[#EF4444]/15 font-semibold transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete</span>
          <span className="ml-auto text-[10px] opacity-50 font-mono">Del</span>
        </button>
      </div>
    </div>
  );
};
