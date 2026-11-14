import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  RotateCw,
  Search,
  List,
  LayoutGrid,
  PieChart,
  Columns,
  Terminal,
  Code2,
  FolderPlus,
  ArrowDownWideNarrow,
  X,
  SlidersHorizontal,
  CheckSquare,
  PanelRight,
  Undo2,
  Redo2,
  FilePlus,
  Activity,
  Image as ImageIcon,
  Grid,
} from 'lucide-react';
import { ViewMode, SortField, SortDirection } from '../types';
import { ApiService } from '../services/api';

interface HeaderProps {
  currentPath: string;
  parentPath: string | null;
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onGoUp: () => void;
  onRefresh: () => void;
  onNavigate: (path: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction?: SortDirection) => void;
  onOpenTerminal: () => void;
  onOpenVSCode: () => void;
  onCreateFolder: () => void;
  onCreateFile?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onToggleActivity?: () => void;
  activeTransferCount?: number;
  isInspectorOpen?: boolean;
  onToggleInspector?: () => void;
  onSelectAll?: () => void;
  isDarkMode: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentPath,
  parentPath,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  onGoUp,
  onRefresh,
  onNavigate,
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  sortField,
  sortDirection,
  onSortChange,
  onOpenTerminal,
  onOpenVSCode,
  onCreateFolder,
  onCreateFile,
  onUndo,
  onRedo,
  onToggleActivity,
  activeTransferCount = 0,
  isInspectorOpen = true,
  onToggleInspector,
  onSelectAll,
  isDarkMode,
}) => {
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState(currentPath);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showSearchFilters, setShowSearchFilters] = useState(false);
  const pathInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPathInput(currentPath);
  }, [currentPath]);

  useEffect(() => {
    if (isEditingPath && pathInputRef.current) {
      pathInputRef.current.focus();
      pathInputRef.current.select();
    }
  }, [isEditingPath]);

  // Query autocomplete suggestions when typing path
  useEffect(() => {
    if (!isEditingPath || !pathInput) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      ApiService.getPathAutocomplete(pathInput).then((res) => {
        setSuggestions(res);
        setShowSuggestions(res.length > 0);
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [pathInput, isEditingPath]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        setIsEditingPath(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        onToggleInspector?.();
      } else if (e.key === 'F3') {
        e.preventDefault();
        onViewModeChange(viewMode === 'dual' ? 'list' : 'dual');
      } else if (e.key === 'F5') {
        e.preventDefault();
        onRefresh();
      } else if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        if (parentPath) onGoUp();
      } else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        if (canGoBack) onGoBack();
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        if (canGoForward) onGoForward();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [parentPath, canGoBack, canGoForward, viewMode, onGoUp, onGoBack, onGoForward, onRefresh, onViewModeChange]);

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pathInput.trim()) {
      onNavigate(pathInput.trim());
      setIsEditingPath(false);
    }
  };

  const pathSegments = React.useMemo(() => {
    if (!currentPath) return [];
    const parts = currentPath.split(/[\\\/]/).filter(Boolean);
    const crumbs: { name: string; fullPath: string }[] = [];

    if (parts.length > 0) {
      let accumulated = parts[0].includes(':') ? parts[0] + '\\' : parts[0];
      crumbs.push({ name: parts[0], fullPath: accumulated });

      for (let i = 1; i < parts.length; i++) {
        accumulated = accumulated.endsWith('\\') ? accumulated + parts[i] : accumulated + '\\' + parts[i];
        crumbs.push({ name: parts[i], fullPath: accumulated });
      }
    }
    return crumbs;
  }, [currentPath]);

  const toggleLargestFirst = () => {
    if (sortField === 'size' && sortDirection === 'desc') {
      onSortChange('name', 'asc');
    } else {
      onSortChange('size', 'desc');
    }
  };

  return (
    <header
      className={`h-14 px-4 flex items-center justify-between gap-3 select-none z-40 transition-colors border-b ${
        isDarkMode
          ? 'bg-[#121316] border-white/[0.04] text-[#E3E2E6]'
          : 'bg-[#F4F5F8] border-black/[0.05] text-[#191C1E]'
      }`}
    >
      {/* Navigation History Buttons in One UI Soft Circle Style */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onGoBack}
          disabled={!canGoBack}
          className={`p-2 rounded-full transition-colors ${
            canGoBack
              ? isDarkMode ? 'hover:bg-white/[0.08] text-slate-200' : 'hover:bg-black/[0.05] text-slate-700'
              : 'opacity-30 cursor-not-allowed'
          }`}
          title="Back (Alt + Left)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          onClick={onGoForward}
          disabled={!canGoForward}
          className={`p-2 rounded-full transition-colors ${
            canGoForward
              ? isDarkMode ? 'hover:bg-white/[0.08] text-slate-200' : 'hover:bg-black/[0.05] text-slate-700'
              : 'opacity-30 cursor-not-allowed'
          }`}
          title="Forward (Alt + Right)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          onClick={onGoUp}
          disabled={!parentPath}
          className={`p-2 rounded-full transition-colors ${
            parentPath
              ? isDarkMode ? 'hover:bg-white/[0.08] text-slate-200' : 'hover:bg-black/[0.05] text-slate-700'
              : 'opacity-30 cursor-not-allowed'
          }`}
          title="Up One Level (Alt + Up)"
        >
          <ArrowUp className="w-4 h-4" />
        </button>

        <button
          onClick={onRefresh}
          className={`p-2 rounded-full transition-colors ${
            isDarkMode ? 'hover:bg-white/[0.08] text-slate-200' : 'hover:bg-black/[0.05] text-slate-700'
          }`}
          title="Refresh (F5)"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Interactive Breadcrumb Bar with Autocomplete Dropdown */}
      <div className="relative flex-1 min-w-[200px] max-w-xl">
        <div
          className={`h-9 rounded-full flex items-center px-3.5 relative overflow-hidden transition-all border ${
            isDarkMode
              ? 'bg-[#1C1D22] border-white/[0.06] text-slate-200'
              : 'bg-white border-black/[0.05] text-slate-700 shadow-xs'
          }`}
        >
          {isEditingPath ? (
            <form onSubmit={handlePathSubmit} className="w-full h-full flex items-center">
              <input
                ref={pathInputRef}
                type="text"
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="w-full bg-transparent text-xs focus:outline-none font-mono"
                placeholder="Enter path (e.g. C:\Users\...)"
              />
            </form>
          ) : (
            <div
              onClick={() => setIsEditingPath(true)}
              className="w-full h-full flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none cursor-text font-medium"
            >
              {pathSegments.map((crumb, idx) => (
                <React.Fragment key={crumb.fullPath}>
                  {idx > 0 && <span className="opacity-30 text-[10px]">›</span>}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate(crumb.fullPath);
                    }}
                    className={`px-2 py-0.5 rounded-full text-xs transition-colors truncate max-w-[140px] ${
                      idx === pathSegments.length - 1
                        ? 'font-bold text-[#0072DE] dark:text-[#5B95FF] bg-[#0072DE]/10'
                        : isDarkMode ? 'opacity-70 hover:opacity-100 hover:bg-white/5' : 'opacity-70 hover:opacity-100 hover:bg-black/5'
                    }`}
                    title={crumb.fullPath}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* Autocomplete Suggestions Popover */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            className={`absolute top-11 left-0 right-0 z-50 rounded-2xl border shadow-xl overflow-hidden py-1 max-h-60 overflow-y-auto ${
              isDarkMode
                ? 'bg-[#1C1D22] border-white/[0.08] text-slate-200'
                : 'bg-white border-black/[0.08] text-slate-800'
            }`}
          >
            {suggestions.map((sug) => (
              <div
                key={sug}
                onMouseDown={() => {
                  onNavigate(sug);
                  setIsEditingPath(false);
                  setShowSuggestions(false);
                }}
                className="px-3.5 py-2 text-xs font-mono hover:bg-[#0072DE]/15 hover:text-[#0072DE] cursor-pointer truncate transition-colors flex items-center gap-2"
              >
                <FolderPlus className="w-3.5 h-3.5 opacity-50 shrink-0" />
                <span className="truncate">{sug}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* One UI Search Capsule with Smart Filters */}
      <div className="relative">
        <div
          className={`w-44 md:w-56 h-9 rounded-full flex items-center px-3 gap-2 shrink-0 transition-all border ${
            isDarkMode
              ? 'bg-[#1C1D22] border-white/[0.06] focus-within:border-[#0072DE]/60'
              : 'bg-white border-black/[0.05] focus-within:border-[#0072DE]/60 shadow-xs'
          }`}
        >
          <Search className="w-4 h-4 opacity-50 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setShowSearchFilters(true)}
            onBlur={() => setTimeout(() => setShowSearchFilters(false), 250)}
            placeholder="Search (*.pdf, size:>100MB)..."
            className="w-full bg-transparent text-xs focus:outline-none placeholder:opacity-50"
          />
          {searchQuery && (
            <button onClick={() => onSearchChange('')} className="opacity-50 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Smart Search Filter Presets Dropdown */}
        {showSearchFilters && !searchQuery && (
          <div
            className={`absolute top-11 right-0 w-64 z-50 p-2.5 rounded-2xl border shadow-xl space-y-1.5 ${
              isDarkMode ? 'bg-[#1C1D22] border-white/[0.08]' : 'bg-white border-black/[0.08]'
            }`}
          >
            <p className="text-[10px] uppercase font-bold text-slate-400 px-2 tracking-wider">Quick Filters</p>
            <div className="flex flex-wrap gap-1 text-[11px]">
              {[
                { label: 'PDFs (*.pdf)', query: '*.pdf' },
                { label: 'Videos (*.mp4)', query: '*.mp4' },
                { label: 'Images (*.png)', query: '*.png' },
                { label: '> 100 MB', query: 'size:>100MB' },
                { label: '> 1 GB', query: 'size:>1GB' },
                { label: 'Modified Today', query: 'modified:today' },
                { label: 'Documents', query: 'type:document' },
              ].map((filter) => (
                <button
                  key={filter.label}
                  onMouseDown={() => onSearchChange(filter.query)}
                  className="px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/5 hover:bg-[#0072DE]/15 hover:text-[#0072DE] text-inherit transition-colors"
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* View Mode Switcher (All 7 View Modes) */}
      <div
        className={`flex items-center rounded-full p-1 shrink-0 border ${
          isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
        }`}
      >
        <button
          onClick={() => onViewModeChange('list')}
          className={`p-1.5 rounded-full transition-all ${
            viewMode === 'list'
              ? 'bg-[#0072DE] text-white shadow-xs'
              : 'opacity-60 hover:opacity-100'
          }`}
          title="Detailed List"
        >
          <List className="w-4 h-4" />
        </button>

        <button
          onClick={() => onViewModeChange('compact')}
          className={`p-1.5 rounded-full transition-all ${
            viewMode === 'compact'
              ? 'bg-[#0072DE] text-white shadow-xs'
              : 'opacity-60 hover:opacity-100'
          }`}
          title="Compact List"
        >
          <Grid className="w-4 h-4" />
        </button>

        <button
          onClick={() => onViewModeChange('grid')}
          className={`p-1.5 rounded-full transition-all ${
            viewMode === 'grid'
              ? 'bg-[#0072DE] text-white shadow-xs'
              : 'opacity-60 hover:opacity-100'
          }`}
          title="Grid View"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>

        <button
          onClick={() => onViewModeChange('large_icons')}
          className={`p-1.5 rounded-full transition-all ${
            viewMode === 'large_icons'
              ? 'bg-[#0072DE] text-white shadow-xs'
              : 'opacity-60 hover:opacity-100'
          }`}
          title="Large Icons"
        >
          <ImageIcon className="w-4 h-4" />
        </button>

        <button
          onClick={() => onViewModeChange('dual')}
          className={`p-1.5 rounded-full transition-all ${
            viewMode === 'dual'
              ? 'bg-[#0072DE] text-white shadow-xs'
              : 'opacity-60 hover:opacity-100'
          }`}
          title="Dual Pane (F3)"
        >
          <Columns className="w-4 h-4" />
        </button>

        <button
          onClick={() => onViewModeChange('xray')}
          className={`p-1.5 rounded-full transition-all ${
            viewMode === 'xray'
              ? 'bg-[#0072DE] text-white shadow-xs'
              : 'opacity-60 hover:opacity-100'
          }`}
          title="Storage Analysis"
        >
          <PieChart className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Shell Action Buttons */}
      <div className="flex items-center gap-1.5 shrink-0">
        {onUndo && (
          <button
            onClick={onUndo}
            className={`p-2 rounded-full transition-colors ${
              isDarkMode ? 'hover:bg-white/[0.08] text-slate-300' : 'hover:bg-black/[0.05] text-slate-700'
            }`}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
        )}

        {onRedo && (
          <button
            onClick={onRedo}
            className={`p-2 rounded-full transition-colors ${
              isDarkMode ? 'hover:bg-white/[0.08] text-slate-300' : 'hover:bg-black/[0.05] text-slate-700'
            }`}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onCreateFolder}
          className={`p-2 rounded-full transition-colors ${
            isDarkMode ? 'hover:bg-white/[0.08] text-slate-300' : 'hover:bg-black/[0.05] text-slate-700'
          }`}
          title="New Folder"
        >
          <FolderPlus className="w-4 h-4 text-[#F59E0B]" />
        </button>

        {onCreateFile && (
          <button
            onClick={onCreateFile}
            className={`p-2 rounded-full transition-colors ${
              isDarkMode ? 'hover:bg-white/[0.08] text-slate-300' : 'hover:bg-black/[0.05] text-slate-700'
            }`}
            title="New Text Document"
          >
            <FilePlus className="w-4 h-4 text-[#0072DE]" />
          </button>
        )}

        <button
          onClick={onOpenTerminal}
          className={`p-2 rounded-full transition-colors ${
            isDarkMode ? 'hover:bg-white/[0.08] text-slate-300' : 'hover:bg-black/[0.05] text-slate-700'
          }`}
          title="Open in PowerShell"
        >
          <Terminal className="w-4 h-4 text-[#10B981]" />
        </button>

        <button
          onClick={onOpenVSCode}
          className={`p-2 rounded-full transition-colors ${
            isDarkMode ? 'hover:bg-white/[0.08] text-slate-300' : 'hover:bg-black/[0.05] text-slate-700'
          }`}
          title="Open in VS Code"
        >
          <Code2 className="w-4 h-4 text-[#0072DE]" />
        </button>

        {onToggleActivity && (
          <button
            onClick={onToggleActivity}
            className="p-2 rounded-full relative hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Activity Center"
          >
            <Activity className="w-4 h-4 text-[#0072DE]" />
            {activeTransferCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#0072DE] animate-ping" />
            )}
          </button>
        )}

        {onSelectAll && (
          <button
            onClick={onSelectAll}
            className={`p-2 rounded-full transition-colors ${
              isDarkMode ? 'hover:bg-white/[0.08] text-slate-300' : 'hover:bg-black/[0.05] text-slate-700'
            }`}
            title="Select All (Ctrl+A)"
          >
            <CheckSquare className="w-4 h-4 text-[#0072DE]" />
          </button>
        )}

        {onToggleInspector && (
          <button
            onClick={onToggleInspector}
            className={`p-2 rounded-full transition-colors ${
              isInspectorOpen
                ? 'bg-[#0072DE]/20 text-[#0072DE]'
                : isDarkMode
                ? 'hover:bg-white/[0.08] text-slate-300'
                : 'hover:bg-black/[0.05] text-slate-700'
            }`}
            title={isInspectorOpen ? 'Hide Inspector (Ctrl+I)' : 'Show Inspector (Ctrl+I)'}
          >
            <PanelRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
