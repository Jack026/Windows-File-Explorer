import React, { useState, useEffect } from 'react';
import {
  Folder,
  File,
  ArrowRight,
  ArrowLeft,
  Copy,
  MoveRight,
  HardDrive,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
} from 'lucide-react';
import { FileItem, DirectoryListing } from '../types';
import { formatBytes } from '../utils/formatters';
import { ApiService } from '../services/api';

interface DualPaneViewProps {
  initialLeftPath: string;
  initialRightPath: string;
  onFileAction: (action: string, source: string, destination: string) => Promise<void>;
  onOpenItem: (item: FileItem) => void;
  isDarkMode: boolean;
}

export const DualPaneView: React.FC<DualPaneViewProps> = ({
  initialLeftPath,
  initialRightPath,
  onFileAction,
  onOpenItem,
  isDarkMode,
}) => {
  const [leftPath, setLeftPath] = useState(initialLeftPath);
  const [rightPath, setRightPath] = useState(initialRightPath);

  const [leftListing, setLeftListing] = useState<DirectoryListing | null>(null);
  const [rightListing, setRightListing] = useState<DirectoryListing | null>(null);

  const [leftSelected, setLeftSelected] = useState<FileItem | null>(null);
  const [rightSelected, setRightSelected] = useState<FileItem | null>(null);

  const [isLoadingLeft, setIsLoadingLeft] = useState(false);
  const [isLoadingRight, setIsLoadingRight] = useState(false);

  const loadLeft = async (p: string) => {
    setIsLoadingLeft(true);
    try {
      const data = await ApiService.listDirectory(p);
      setLeftListing(data);
      setLeftPath(data.currentPath);
      setLeftSelected(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingLeft(false);
    }
  };

  const loadRight = async (p: string) => {
    setIsLoadingRight(true);
    try {
      const data = await ApiService.listDirectory(p);
      setRightListing(data);
      setRightPath(data.currentPath);
      setRightSelected(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingRight(false);
    }
  };

  useEffect(() => {
    loadLeft(initialLeftPath);
    loadRight(initialRightPath);
  }, []);

  const handleCopyLeftToRight = async () => {
    if (!leftSelected || !rightListing) return;
    await onFileAction('copy', leftSelected.path, rightListing.currentPath);
    loadRight(rightListing.currentPath);
  };

  const handleCopyRightToLeft = async () => {
    if (!rightSelected || !leftListing) return;
    await onFileAction('copy', rightSelected.path, leftListing.currentPath);
    loadLeft(leftListing.currentPath);
  };

  const handleMoveLeftToRight = async () => {
    if (!leftSelected || !rightListing) return;
    await onFileAction('move', leftSelected.path, rightListing.currentPath);
    loadLeft(leftListing.currentPath);
    loadRight(rightListing.currentPath);
  };

  return (
    <div
      className={`flex-1 flex flex-col h-full overflow-hidden select-none transition-colors ${
        isDarkMode ? 'bg-[#121316] text-[#E3E2E6]' : 'bg-[#F4F5F8] text-[#191C1E]'
      }`}
    >
      {/* Top Toolbar */}
      <div
        className={`h-12 border-b flex items-center justify-between px-4 transition-colors ${
          isDarkMode ? 'bg-[#1C1D22] border-white/[0.04]' : 'bg-white border-black/[0.05]'
        }`}
      >
        <span className="text-xs font-bold flex items-center gap-2 text-[#0072DE]">
          <HardDrive className="w-4 h-4" />
          <span>Dual Pane Commander (F3)</span>
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLeftToRight}
            disabled={!leftSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0072DE] hover:bg-[#0062C4] disabled:opacity-30 text-white font-bold text-xs transition-all shadow-xs"
          >
            <span>Copy to Right</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleCopyRightToLeft}
            disabled={!rightSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0072DE] hover:bg-[#0062C4] disabled:opacity-30 text-white font-bold text-xs transition-all shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Copy to Left</span>
          </button>

          <button
            onClick={handleMoveLeftToRight}
            disabled={!leftSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-30 text-black font-bold text-xs transition-all shadow-xs"
          >
            <span>Move</span>
            <MoveRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Split Panes */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        {/* Left Pane Card */}
        <div
          className={`flex-1 flex flex-col rounded-3xl border overflow-hidden transition-all ${
            isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
          }`}
        >
          <div className="h-10 border-b border-black/[0.05] dark:border-white/[0.05] flex items-center px-3.5 gap-2 text-xs">
            <button
              onClick={() => leftListing?.parentPath && loadLeft(leftListing.parentPath)}
              disabled={!leftListing?.parentPath}
              className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30"
              title="Parent"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-xs font-semibold truncate max-w-sm opacity-80" title={leftPath}>
              {leftPath}
            </span>
            <button
              onClick={() => loadLeft(leftPath)}
              className="ml-auto p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {isLoadingLeft ? (
              <div className="h-32 flex items-center justify-center text-xs opacity-50">Loading...</div>
            ) : (
              leftListing?.items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setLeftSelected(item)}
                  onDoubleClick={() => (item.isDirectory ? loadLeft(item.path) : onOpenItem(item))}
                  className={`flex items-center justify-between px-3 py-2 rounded-2xl text-xs cursor-pointer transition-all ${
                    leftSelected?.path === item.path
                      ? 'bg-[#0072DE]/20 text-[#0072DE] dark:text-[#5B95FF] font-bold ring-1 ring-[#0072DE]/40'
                      : isDarkMode ? 'hover:bg-white/[0.05]' : 'hover:bg-black/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {item.isDirectory ? (
                      <Folder className="w-4 h-4 text-[#0072DE] shrink-0" />
                    ) : (
                      <File className="w-4 h-4 opacity-50 shrink-0" />
                    )}
                    <span className="truncate">{item.name}</span>
                  </div>
                  <span className="font-mono text-[11px] opacity-60 shrink-0">
                    {item.size !== null ? formatBytes(item.size) : 'Folder'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Pane Card */}
        <div
          className={`flex-1 flex flex-col rounded-3xl border overflow-hidden transition-all ${
            isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
          }`}
        >
          <div className="h-10 border-b border-black/[0.05] dark:border-white/[0.05] flex items-center px-3.5 gap-2 text-xs">
            <button
              onClick={() => rightListing?.parentPath && loadRight(rightListing.parentPath)}
              disabled={!rightListing?.parentPath}
              className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30"
              title="Parent"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-xs font-semibold truncate max-w-sm opacity-80" title={rightPath}>
              {rightPath}
            </span>
            <button
              onClick={() => loadRight(rightPath)}
              className="ml-auto p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {isLoadingRight ? (
              <div className="h-32 flex items-center justify-center text-xs opacity-50">Loading...</div>
            ) : (
              rightListing?.items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setRightSelected(item)}
                  onDoubleClick={() => (item.isDirectory ? loadRight(item.path) : onOpenItem(item))}
                  className={`flex items-center justify-between px-3 py-2 rounded-2xl text-xs cursor-pointer transition-all ${
                    rightSelected?.path === item.path
                      ? 'bg-[#0072DE]/20 text-[#0072DE] dark:text-[#5B95FF] font-bold ring-1 ring-[#0072DE]/40'
                      : isDarkMode ? 'hover:bg-white/[0.05]' : 'hover:bg-black/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {item.isDirectory ? (
                      <Folder className="w-4 h-4 text-[#0072DE] shrink-0" />
                    ) : (
                      <File className="w-4 h-4 opacity-50 shrink-0" />
                    )}
                    <span className="truncate">{item.name}</span>
                  </div>
                  <span className="font-mono text-[11px] opacity-60 shrink-0">
                    {item.size !== null ? formatBytes(item.size) : 'Folder'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
