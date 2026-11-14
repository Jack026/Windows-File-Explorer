import React, { useState, useEffect } from 'react';
import { HardDrive, Minus, Square, Copy, X, FolderTree, Sun, Moon } from 'lucide-react';

interface TitlebarProps {
  currentPath: string;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      onMaximizedChange: (callback: (isMax: boolean) => void) => () => void;
    };
  }
}

export const Titlebar: React.FC<TitlebarProps> = ({ currentPath, isDarkMode, onToggleTheme }) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (window.electronAPI?.onMaximizedChange) {
      const cleanup = window.electronAPI.onMaximizedChange((isMax) => {
        setIsMaximized(isMax);
      });
      window.electronAPI.isMaximized().then(setIsMaximized).catch(() => {});
      return cleanup;
    }
  }, []);

  const handleMinimize = () => {
    window.electronAPI?.minimize();
  };

  const handleMaximize = () => {
    window.electronAPI?.maximize();
    setIsMaximized(!isMaximized);
  };

  const handleClose = () => {
    window.electronAPI?.close();
  };

  return (
    <div
      className={`h-[40px] flex items-center justify-between px-3.5 select-none z-50 text-xs transition-colors ${
        isDarkMode
          ? 'bg-[#121316] text-[#E3E2E6] border-b border-white/[0.04]'
          : 'bg-[#F4F5F8] text-[#191C1E] border-b border-black/[0.04]'
      }`}
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Left: App Identity in One UI Pebble Style */}
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center overflow-hidden">
          <img src="/icon.png" alt="App Icon" className="w-5 h-5 object-contain" />
        </div>
        <span className="font-bold text-[13px] tracking-tight">Windows File Explorer</span>
        <span className="opacity-30">•</span>
        <span
          className={`font-mono text-[11px] truncate max-w-[320px] md:max-w-[480px] px-2 py-0.5 rounded-full ${
            isDarkMode ? 'bg-white/[0.05] text-[#94A3B8]' : 'bg-black/[0.04] text-[#64748B]'
          }`}
          title={currentPath}
        >
          {currentPath || 'Storage Overview'}
        </span>
      </div>

      {/* Right: Theme Toggle & Window Controls */}
      <div
        className="flex items-center h-full -mr-3.5 gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <button
          onClick={onToggleTheme}
          className={`p-1.5 rounded-full mr-1 transition-colors ${
            isDarkMode
              ? 'text-amber-300 hover:bg-white/[0.08]'
              : 'text-slate-700 hover:bg-black/[0.06]'
          }`}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={handleMinimize}
          className={`h-full px-3.5 transition-colors flex items-center justify-center ${
            isDarkMode ? 'hover:bg-white/[0.08] text-slate-400 hover:text-white' : 'hover:bg-black/[0.06] text-slate-600 hover:text-black'
          }`}
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleMaximize}
          className={`h-full px-3.5 transition-colors flex items-center justify-center ${
            isDarkMode ? 'hover:bg-white/[0.08] text-slate-400 hover:text-white' : 'hover:bg-black/[0.06] text-slate-600 hover:text-black'
          }`}
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
        </button>

        <button
          onClick={handleClose}
          className="h-full px-4 hover:bg-[#E11D48] text-slate-400 hover:text-white transition-colors flex items-center justify-center"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
