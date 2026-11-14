import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Titlebar } from './components/Titlebar';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { EnrichedListView } from './components/EnrichedListView';
import { GridView } from './components/GridView';
import { StorageXRayView } from './components/StorageXRayView';
import { LiveInspector } from './components/LiveInspector';
import { DualPaneView } from './components/DualPaneView';
import { DuplicateFinder } from './components/DuplicateFinder';
import { RenameModal, DeleteConfirmModal, TransferToast, ContextMenu } from './components/Modals';
import { ApplicationsDashboard } from './components/applications/ApplicationsDashboard';
import { ApplicationDetailsView } from './components/applications/ApplicationDetailsView';
import { DeepUninstallModal } from './components/applications/DeepUninstallModal';
import { SystemUtilitiesView } from './components/utilities/SystemUtilitiesView';
import { TabBar } from './components/explorer/TabBar';
import { FilePropertiesModal } from './components/explorer/FilePropertiesModal';
import { AdvancedPreviewModal } from './components/preview/AdvancedPreviewModal';
import { ActivityCenterDrawer } from './components/transfers/ActivityCenterDrawer';
import { DrivesView } from './components/drives/DrivesView';
import { LargeFilesView } from './components/storage/LargeFilesView';
import { ScanHistoryView } from './components/storage/ScanHistoryView';
import { PermissionsView } from './components/permissions/PermissionsView';
import { SettingsView } from './components/settings/SettingsView';
import { ApiService } from './services/api';
import {
  FileItem,
  DriveInfo,
  QuickDirectory,
  StorageXRayReport,
  DuplicateGroup,
  ViewMode,
  SortField,
  SortDirection,
  BloatItem,
  ClipboardState,
  InstalledApp,
  ExplorerTab,
} from './types';

export const App: React.FC = () => {
  // Drives and directories
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [quickDirs, setQuickDirs] = useState<QuickDirectory[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('C:\\');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>(['C:\\']);
  const [historyIndex, setHistoryIndex] = useState(0);

  // File Items & Loading
  const [items, setItems] = useState<FileItem[]>([]);
  const [totalDirectoryBytes, setTotalDirectoryBytes] = useState(0);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [isFolderSizingActive, setIsFolderSizingActive] = useState(false);

  // View & UI State - Default to One UI Dashboard
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Selection
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [activeItem, setActiveItem] = useState<FileItem | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  // Storage X-Ray & Duplicates
  const [xrayReport, setXrayReport] = useState<StorageXRayReport | null>(null);
  const [isXrayLoading, setIsXrayLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [isDuplicatesLoading, setIsDuplicatesLoading] = useState(false);

  // Clipboard & Modals
  const [clipboard, setClipboard] = useState<ClipboardState>({ items: [], action: null });
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; subMessage?: string }>({
    isVisible: false,
    message: '',
  });

  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [deleteTargets, setDeleteTargets] = useState<FileItem[]>([]);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Applications & Utilities State
  const [selectedApp, setSelectedApp] = useState<InstalledApp | null>(null);
  const [uninstallApp, setUninstallApp] = useState<InstalledApp | null>(null);
  const [isUninstallModalOpen, setIsUninstallModalOpen] = useState(false);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    item: FileItem | null;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    item: null,
  });

  // Phase 1: Explorer Tabs State
  const [tabs, setTabs] = useState<ExplorerTab[]>([
    {
      id: 'tab_default',
      title: 'Local Disk (C:)',
      path: 'C:\\',
      history: ['C:\\'],
      historyIndex: 0,
      viewMode: 'dashboard',
      selectedItems: [],
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab_default');

  // Phase 1: File Properties & Advanced Preview Modals
  const [propertiesItem, setPropertiesItem] = useState<FileItem | null>(null);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<FileItem | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Phase 1: Activity Center Drawer & Live Transfer Polling
  const [isActivityDrawerOpen, setIsActivityDrawerOpen] = useState(false);
  const [activeTransferCount, setActiveTransferCount] = useState(0);

  // Poll active transfers count for Header indicator
  useEffect(() => {
    const checkTransfers = async () => {
      try {
        const transfers = await ApiService.getTransfers();
        const activeCount = transfers.filter((t) => t.status === 'running').length;
        setActiveTransferCount(activeCount);
      } catch {}
    };
    checkTransfers();
    const interval = setInterval(checkTransfers, 3000);
    return () => clearInterval(interval);
  }, []);

  // 1. Initial Load: Fetch Windows drives & user locations
  useEffect(() => {
    ApiService.getDrives().then(({ drives, quickDirs, userHome }) => {
      setDrives(drives);
      setQuickDirs(quickDirs);
      const initial = userHome || (drives[0] ? drives[0].deviceId + '\\' : 'C:\\');
      setCurrentPath(initial);
      setHistory([initial]);
      setHistoryIndex(0);
      const tabTitle = initial.split('\\').filter(Boolean).pop() || initial;
      setTabs([
        {
          id: 'tab_default',
          title: tabTitle,
          path: initial,
          history: [initial],
          historyIndex: 0,
          viewMode: 'dashboard',
          selectedItems: [],
        },
      ]);
      setActiveTabId('tab_default');
      loadDirectory(initial);

      // Pre-load Storage X-Ray summary in background for dashboard
      ApiService.getStorageXRay(initial, 3)
        .then((report) => setXrayReport(report))
        .catch(() => {});
    });
  }, []);

  // 2. Load directory contents
  const loadDirectory = async (targetPath: string) => {
    setIsLoadingDirectory(true);
    setSelectedItems(new Set());
    setActiveItem(null);

    try {
      const listing = await ApiService.listDirectory(targetPath);
      setCurrentPath(listing.currentPath);
      setParentPath(listing.parentPath);
      setItems(listing.items);
      setTotalDirectoryBytes(listing.totalSize);

      setIsFolderSizingActive(true);
      ApiService.streamFolderSizes(
        listing.currentPath,
        (info) => {
          setItems((prev) =>
            prev.map((item) =>
              item.path.toLowerCase() === info.folderPath.toLowerCase()
                ? {
                    ...item,
                    size: info.size,
                    formattedSize: info.formattedSize,
                    fileCount: info.fileCount,
                    folderCount: info.folderCount,
                  }
                : item
            )
          );
        },
        (totalComputed) => {
          setIsFolderSizingActive(false);
          setTotalDirectoryBytes((prev) => prev + totalComputed);
        }
      );
    } catch (err: any) {
      showToast('Error reading folder', err.message);
    } finally {
      setIsLoadingDirectory(false);
    }
  };

  // 3. Navigate with history & Tab Sync
  const navigateTo = (newPath: string) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    updatedHistory.push(newPath);
    setHistory(updatedHistory);
    const newHistoryIndex = updatedHistory.length - 1;
    setHistoryIndex(newHistoryIndex);
    const folderTitle = newPath.split('\\').filter(Boolean).pop() || newPath;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              title: folderTitle,
              path: newPath,
              history: updatedHistory,
              historyIndex: newHistoryIndex,
            }
          : t
      )
    );
    loadDirectory(newPath);
  };

  const handleGoBack = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      const newIdx = historyIndex - 1;
      setHistoryIndex(newIdx);
      const folderTitle = prev.split('\\').filter(Boolean).pop() || prev;
      setTabs((prevTabs) =>
        prevTabs.map((t) =>
          t.id === activeTabId
            ? { ...t, title: folderTitle, path: prev, historyIndex: newIdx }
            : t
        )
      );
      loadDirectory(prev);
    }
  };

  const handleGoForward = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      const newIdx = historyIndex + 1;
      setHistoryIndex(newIdx);
      const folderTitle = next.split('\\').filter(Boolean).pop() || next;
      setTabs((prevTabs) =>
        prevTabs.map((t) =>
          t.id === activeTabId
            ? { ...t, title: folderTitle, path: next, historyIndex: newIdx }
            : t
        )
      );
      loadDirectory(next);
    }
  };

  const handleGoUp = () => {
    if (parentPath) {
      navigateTo(parentPath);
    }
  };

  // Phase 1: Explorer Tab Operations
  const handleSelectTab = (tabId: string) => {
    const target = tabs.find((t) => t.id === tabId);
    if (!target) return;
    setActiveTabId(tabId);
    setCurrentPath(target.path);
    setHistory(target.history);
    setHistoryIndex(target.historyIndex);
    setViewMode(target.viewMode);
    loadDirectory(target.path);
  };

  const handleCloseTab = (tabId: string) => {
    if (tabs.length <= 1) return;
    const tabIndex = tabs.findIndex((t) => t.id === tabId);
    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);

    if (activeTabId === tabId) {
      const nextIndex = Math.max(0, tabIndex - 1);
      const nextTab = newTabs[nextIndex];
      if (nextTab) {
        setActiveTabId(nextTab.id);
        setCurrentPath(nextTab.path);
        setHistory(nextTab.history);
        setHistoryIndex(nextTab.historyIndex);
        setViewMode(nextTab.viewMode);
        loadDirectory(nextTab.path);
      }
    }
  };

  const handleNewTab = (initialPath?: string) => {
    const newPath = initialPath || currentPath || 'C:\\';
    const folderTitle = newPath.split('\\').filter(Boolean).pop() || newPath;
    const newTabId = 'tab_' + Date.now();
    const newTab: ExplorerTab = {
      id: newTabId,
      title: folderTitle,
      path: newPath,
      history: [newPath],
      historyIndex: 0,
      viewMode: 'list',
      selectedItems: [],
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTabId);
    setCurrentPath(newPath);
    setHistory([newPath]);
    setHistoryIndex(0);
    setViewMode('list');
    loadDirectory(newPath);
  };

  const showToast = (message: string, subMessage?: string) => {
    setToast({ isVisible: true, message, subMessage });
    setTimeout(() => {
      setToast((t) => ({ ...t, isVisible: false }));
    }, 3500);
  };

  // 4. Storage Analysis & Duplicates triggers
  const runStorageXRay = async (path = currentPath) => {
    setIsXrayLoading(true);
    setViewMode('xray');
    try {
      const report = await ApiService.getStorageXRay(path, 5);
      setXrayReport(report);
    } catch (err: any) {
      showToast('Storage scan error', err.message);
    } finally {
      setIsXrayLoading(false);
    }
  };

  const runDuplicateFinder = async (path = currentPath) => {
    setIsDuplicatesLoading(true);
    setViewMode('duplicates');
    try {
      const dups = await ApiService.getDuplicates(path);
      setDuplicates(dups);
    } catch (err: any) {
      showToast('Duplicate finder error', err.message);
    } finally {
      setIsDuplicatesLoading(false);
    }
  };

  const handleSelectView = (view: ViewMode) => {
    setViewMode(view);
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, viewMode: view } : t))
    );
    if (view === 'xray') {
      runStorageXRay();
    } else if (view === 'duplicates') {
      runDuplicateFinder();
    } else if (view === 'bloat') {
      runStorageXRay();
    } else if (view === 'apps') {
      setSelectedApp(null);
    }
  };

  // 5. Selection Handlers
  const handleToggleSelect = (item: FileItem, multiSelect: boolean, rangeSelect: boolean) => {
    setActiveItem(item);
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (multiSelect) {
        if (next.has(item.path)) next.delete(item.path);
        else next.add(item.path);
      } else {
        next.clear();
        next.add(item.path);
      }
      return next;
    });
  };

  // 6. Native File Actions
  const handleOpenItem = (item: FileItem) => {
    if (item.isDirectory) {
      setViewMode('list');
      navigateTo(item.path);
    } else {
      ApiService.fileAction({ action: 'open', source: item.path });
    }
  };

  const handleReveal = (item: FileItem | string) => {
    const p = typeof item === 'string' ? item : item.path;
    ApiService.fileAction({ action: 'reveal', source: p });
  };

  const handleOpenTerminal = (path = currentPath) => {
    ApiService.fileAction({ action: 'openTerminal', source: path });
  };

  const handleOpenVSCode = (path = currentPath) => {
    ApiService.fileAction({ action: 'openVSCode', source: path });
  };

  const handleCreateFolder = async () => {
    try {
      const res = await ApiService.fileAction({
        action: 'createFolder',
        source: currentPath,
        newName: 'New Folder',
      });
      loadDirectory(currentPath);
      showToast('Folder created', res.createdPath);
    } catch (err: any) {
      showToast('Failed to create folder', err.message);
    }
  };

  const handleCreateFile = async () => {
    try {
      const res = await ApiService.fileAction({
        action: 'createFile',
        source: currentPath,
        newName: 'New Text Document.txt',
      });
      loadDirectory(currentPath);
      showToast('File created', 'New Text Document.txt');
    } catch (err: any) {
      showToast('Failed to create file', err.message);
    }
  };

  const handleDuplicate = async (item: FileItem) => {
    try {
      const res = await ApiService.fileAction({
        action: 'duplicate',
        source: item.path,
      });
      loadDirectory(currentPath);
      showToast('Item duplicated', res.createdPath?.split('\\').pop() || item.name);
    } catch (err: any) {
      showToast('Failed to duplicate', err.message);
    }
  };

  const handleUndo = async () => {
    try {
      const res = await ApiService.undo();
      if (res.success) {
        showToast('Undo succeeded', res.description);
        loadDirectory(currentPath);
      } else {
        showToast('Nothing to undo', res.message);
      }
    } catch (err: any) {
      showToast('Undo failed', err.message);
    }
  };

  const handleRedo = async () => {
    try {
      const res = await ApiService.redo();
      if (res.success) {
        showToast('Redo succeeded', res.description);
        loadDirectory(currentPath);
      } else {
        showToast('Nothing to redo', res.message);
      }
    } catch (err: any) {
      showToast('Redo failed', err.message);
    }
  };

  const handleRename = async (source: string, newName: string) => {
    try {
      await ApiService.fileAction({ action: 'rename', source, newName });
      loadDirectory(currentPath);
      showToast('Renamed item', newName);
    } catch (err: any) {
      showToast('Rename failed', err.message);
    }
  };

  const handleConfirmTrash = async () => {
    setIsDeleteOpen(false);
    for (const item of deleteTargets) {
      try {
        await ApiService.fileAction({ action: 'trash', source: item.path });
      } catch (err: any) {
        showToast('Failed to recycle item', err.message);
      }
    }
    showToast('Moved to Windows Recycle Bin', `${deleteTargets.length} items`);
    loadDirectory(currentPath);
    if (viewMode === 'xray') runStorageXRay();
  };

  const handleCleanBloat = (bloatItems: BloatItem[]) => {
    const targets: FileItem[] = bloatItems.map((b) => ({
      id: b.id,
      name: b.name,
      path: b.path,
      isDirectory: true,
      isFile: false,
      size: b.size,
      extension: '',
      category: 'code',
      createdAt: '',
      modifiedAt: b.lastModified,
      relativeTime: `${b.daysOld}d old`,
    }));
    setDeleteTargets(targets);
    setIsDeleteOpen(true);
  };

  // Clipboard operations
  const handleCopy = () => {
    const selected = items.filter((i) => selectedItems.has(i.path));
    if (selected.length > 0) {
      setClipboard({ items: selected, action: 'copy' });
      showToast('Copied to clipboard', `${selected.length} items`);
    }
  };

  const handleCut = () => {
    const selected = items.filter((i) => selectedItems.has(i.path));
    if (selected.length > 0) {
      setClipboard({ items: selected, action: 'cut' });
      showToast('Cut to clipboard', `${selected.length} items`);
    }
  };

  const handlePaste = async () => {
    if (clipboard.items.length === 0 || !clipboard.action) return;

    for (const item of clipboard.items) {
      try {
        await ApiService.fileAction({
          action: clipboard.action,
          source: item.path,
          destination: currentPath,
        });
      } catch (err: any) {
        showToast('Paste operation failed', err.message);
      }
    }

    showToast('Transferred successfully', `${clipboard.items.length} items`);
    setClipboard({ items: [], action: null });
    loadDirectory(currentPath);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.key === 'F2' && activeItem) {
        e.preventDefault();
        setRenameTarget(activeItem);
        setIsRenameOpen(true);
      } else if (e.key === 'Delete') {
        const toDelete = items.filter((i) => selectedItems.has(i.path));
        if (toDelete.length > 0) {
          e.preventDefault();
          setDeleteTargets(toDelete);
          setIsDeleteOpen(true);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        handleCopy();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault();
        handleCut();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        handlePaste();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        handleCreateFolder();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedItems(new Set(items.map((i) => i.path)));
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleNewTab();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        handleCloseTab(activeTabId);
      } else if (e.key === ' ' && activeItem) {
        e.preventDefault();
        setPreviewItem(activeItem);
        setIsPreviewOpen(true);
      } else if (e.altKey && e.key === 'Enter' && activeItem) {
        e.preventDefault();
        setPropertiesItem(activeItem);
        setIsPropertiesOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeItem, selectedItems, items, clipboard, currentPath, tabs, activeTabId]);

  // Context Menu
  const handleContextMenu = (e: React.MouseEvent, item: FileItem) => {
    e.preventDefault();
    setActiveItem(item);
    if (!selectedItems.has(item.path)) {
      setSelectedItems(new Set([item.path]));
    }
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      item,
    });
  };

  // Filter & Sort Items
  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((item) => {
        if (item.name.toLowerCase().includes(q)) return true;
        if (q.startsWith('.') && item.extension.toLowerCase() === q) return true;
        if (q.startsWith('>')) {
          const mb = parseFloat(q.replace('>', '').replace('mb', ''));
          if (!isNaN(mb) && (item.size || 0) > mb * 1024 * 1024) return true;
        }
        return false;
      });
    }

    result.sort((a, b) => {
      if (sortField === 'size') {
        const sizeA = a.size || 0;
        const sizeB = b.size || 0;
        return sortDirection === 'desc' ? sizeB - sizeA : sizeA - sizeB;
      }

      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
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

      if (sortField === 'extension') {
        const extA = a.extension.toLowerCase();
        const extB = b.extension.toLowerCase();
        return sortDirection === 'asc' ? extA.localeCompare(extB) : extB.localeCompare(extA);
      }

      return 0;
    });

    return result;
  }, [items, searchQuery, sortField, sortDirection]);

  return (
    <div
      className={`flex flex-col h-screen w-screen overflow-hidden ${
        isDarkMode ? 'dark bg-[#121316] text-[#E3E2E6]' : 'bg-[#F4F5F8] text-[#191C1E]'
      }`}
    >
      {/* 1. Custom Frameless Titlebar with Window Controls */}
      <Titlebar
        currentPath={viewMode === 'dashboard' ? 'Your Storage' : currentPath}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
      />

      {/* 2. Top Navigation & Command Toolbar (when in file browsing modes) */}
      {viewMode !== 'dashboard' &&
        viewMode !== 'apps' &&
        viewMode !== 'app_details' &&
        viewMode !== 'utilities' &&
        viewMode !== 'large_files' &&
        viewMode !== 'scan_history' && (
        <Header
          currentPath={currentPath}
          parentPath={parentPath}
          canGoBack={historyIndex > 0}
          canGoForward={historyIndex < history.length - 1}
          onGoBack={handleGoBack}
          onGoForward={handleGoForward}
          onGoUp={handleGoUp}
          onRefresh={() => loadDirectory(currentPath)}
          onNavigate={navigateTo}
          viewMode={viewMode}
          onViewModeChange={handleSelectView}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={(field) => {
            if (sortField === field) {
              setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
            } else {
              setSortField(field);
              setSortDirection(field === 'size' ? 'desc' : 'asc');
            }
          }}
          onOpenTerminal={() => handleOpenTerminal()}
          onOpenVSCode={() => handleOpenVSCode()}
          onCreateFolder={handleCreateFolder}
          onCreateFile={handleCreateFile}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onToggleActivity={() => setIsActivityDrawerOpen((prev) => !prev)}
          activeTransferCount={activeTransferCount}
          isInspectorOpen={isInspectorOpen}
          onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
          onSelectAll={() => setSelectedItems(new Set(items.map((i) => i.path)))}
          isDarkMode={isDarkMode}
        />
      )}

      {/* 3. Main Workspace Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar
          drives={drives}
          quickDirs={quickDirs}
          currentPath={currentPath}
          activeView={viewMode}
          onNavigate={(p) => {
            setViewMode('list');
            navigateTo(p);
          }}
          onSelectView={handleSelectView}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          isDarkMode={isDarkMode}
        />

        {/* Center Viewport */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* One UI Multi-Tab Bar for file exploration */}
          {viewMode !== 'dashboard' &&
            viewMode !== 'apps' &&
            viewMode !== 'app_details' &&
            viewMode !== 'utilities' &&
            viewMode !== 'large_files' &&
            viewMode !== 'scan_history' && (
            <TabBar
              tabs={tabs}
              activeTabId={activeTabId}
              onSelectTab={handleSelectTab}
              onCloseTab={handleCloseTab}
              onNewTab={() => handleNewTab()}
              isDarkMode={isDarkMode}
            />
          )}

          {viewMode === 'dashboard' && (
            <DashboardView
              drives={drives}
              quickDirs={quickDirs}
              xrayReport={xrayReport}
              onNavigateTo={(p) => {
                setViewMode('list');
                navigateTo(p);
              }}
              onOpenXRay={() => runStorageXRay()}
              onOpenLargeFiles={() => setViewMode('large_files')}
              onOpenScanHistory={() => setViewMode('scan_history')}
              onOpenBloatCleaner={() => runStorageXRay()}
              onOpenFile={handleOpenItem}
              onRevealFile={handleReveal}
              isDarkMode={isDarkMode}
            />
          )}

          {viewMode === 'drives' && (
            <DrivesView
              drives={drives}
              onOpenDrive={(p) => {
                setViewMode('list');
                navigateTo(p);
              }}
              onScanDrive={(p) => runStorageXRay(p)}
              onSearchDrive={(p) => {
                setViewMode('list');
                navigateTo(p);
              }}
              isDarkMode={isDarkMode}
            />
          )}

          {viewMode === 'list' && (
            <EnrichedListView
              items={filteredAndSortedItems}
              totalDirectoryBytes={totalDirectoryBytes}
              selectedItems={selectedItems}
              onToggleSelect={handleToggleSelect}
              onOpenItem={handleOpenItem}
              onContextMenu={handleContextMenu}
              sortField={sortField}
              sortDirection={sortDirection}
              onSortChange={(f) => {
                if (sortField === f) setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
                else {
                  setSortField(f);
                  setSortDirection(f === 'size' ? 'desc' : 'asc');
                }
              }}
              isFolderSizingActive={isFolderSizingActive}
              isDarkMode={isDarkMode}
            />
          )}

          {(viewMode === 'grid' ||
            viewMode === 'compact' ||
            viewMode === 'large_icons' ||
            viewMode === 'xl_icons' ||
            viewMode === 'gallery') && (
            <GridView
              items={filteredAndSortedItems}
              variant={viewMode}
              selectedItems={selectedItems}
              onToggleSelect={handleToggleSelect}
              onOpenItem={handleOpenItem}
              onContextMenu={handleContextMenu}
              isDarkMode={isDarkMode}
            />
          )}

          {(viewMode === 'xray' || viewMode === 'bloat') && (
            <StorageXRayView
              currentPath={currentPath}
              report={xrayReport}
              isLoading={isXrayLoading}
              onRefresh={() => runStorageXRay()}
              onNavigateToFolder={(p) => {
                setViewMode('list');
                navigateTo(p);
              }}
              onCleanBloat={handleCleanBloat}
              onRevealItem={(p) => handleReveal(p)}
              onTrashItem={(p) => {
                setDeleteTargets([
                  {
                    id: p,
                    name: p.split('\\').pop() || p,
                    path: p,
                    isDirectory: false,
                    isFile: true,
                    size: 0,
                    extension: '',
                    category: 'other',
                    createdAt: '',
                    modifiedAt: '',
                    relativeTime: '',
                  },
                ]);
                setIsDeleteOpen(true);
              }}
              isDarkMode={isDarkMode}
            />
          )}

          {viewMode === 'dual' && (
            <DualPaneView
              initialLeftPath={currentPath}
              initialRightPath={parentPath || 'C:\\'}
              onFileAction={async (action, source, destination) => {
                await ApiService.fileAction({ action: action as any, source, destination });
              }}
              onOpenItem={handleOpenItem}
              isDarkMode={isDarkMode}
            />
          )}

          {viewMode === 'duplicates' && (
            <DuplicateFinder
              duplicates={duplicates}
              isLoading={isDuplicatesLoading}
              onRefresh={() => runDuplicateFinder()}
              onReveal={(p) => handleReveal(p)}
              onTrashItems={(paths) => {
                const targets: FileItem[] = paths.map((p) => ({
                  id: p,
                  name: p.split('\\').pop() || p,
                  path: p,
                  isDirectory: false,
                  isFile: true,
                  size: 0,
                  extension: '',
                  category: 'other',
                  createdAt: '',
                  modifiedAt: '',
                  relativeTime: '',
                }));
                setDeleteTargets(targets);
                setIsDeleteOpen(true);
              }}
              isDarkMode={isDarkMode}
            />
          )}

          {viewMode === 'apps' && (
            <ApplicationsDashboard
              onSelectApp={(app) => {
                setSelectedApp(app);
                setViewMode('app_details');
              }}
              onOpenUninstallModal={(app) => {
                setUninstallApp(app);
                setIsUninstallModalOpen(true);
              }}
              isDarkMode={isDarkMode}
            />
          )}

          {viewMode === 'app_details' && selectedApp && (
            <ApplicationDetailsView
              app={selectedApp}
              onBack={() => setViewMode('apps')}
              onOpenUninstallModal={(app) => {
                setUninstallApp(app);
                setIsUninstallModalOpen(true);
              }}
              onRevealPath={(p) => handleReveal(p)}
              isDarkMode={isDarkMode}
            />
          )}

          {viewMode === 'utilities' && (
            <SystemUtilitiesView
              currentPath={currentPath}
              onRevealItem={(p) => handleReveal(p)}
              onTrashItem={(p) => {
                setDeleteTargets([
                  {
                    id: p,
                    name: p.split('\\').pop() || p,
                    path: p,
                    isDirectory: false,
                    isFile: true,
                    size: 0,
                    extension: '',
                    category: 'other',
                    createdAt: '',
                    modifiedAt: '',
                    relativeTime: '',
                  },
                ]);
                setIsDeleteOpen(true);
              }}
              isDarkMode={isDarkMode}
            />
          )}

          {viewMode === 'large_files' && (
            <LargeFilesView
              currentPath={currentPath}
              onPreviewItem={(item) => {
                setPreviewItem(item);
                setIsPreviewOpen(true);
              }}
              onRevealPath={(p) => handleReveal(p)}
              onTrashItems={(paths) => {
                const targets: FileItem[] = paths.map((p) => ({
                  id: p,
                  name: p.split('\\').pop() || p,
                  path: p,
                  isDirectory: false,
                  isFile: true,
                  size: 0,
                  extension: '',
                  category: 'other',
                  createdAt: '',
                  modifiedAt: '',
                  relativeTime: '',
                }));
                setDeleteTargets(targets);
                setIsDeleteOpen(true);
              }}
              isDarkMode={isDarkMode}
            />
          )}

          {viewMode === 'scan_history' && (
            <ScanHistoryView
              onNavigateToScan={(path) => {
                setCurrentPath(path);
                runStorageXRay(path);
              }}
              isDarkMode={isDarkMode}
            />
          )}

          {viewMode === 'permissions' && (
            <PermissionsView
              initialPath={currentPath}
              isDarkMode={isDarkMode}
              onNavigate={(p) => handleNavigate(p)}
            />
          )}

          {viewMode === 'settings' && (
            <SettingsView
              isDarkMode={isDarkMode}
              onThemeChange={(th) => {
                if (th === 'dark') setIsDarkMode(true);
                else if (th === 'light') setIsDarkMode(false);
              }}
            />
          )}
        </main>

        {/* Right Live Inspector & Preview Pane */}
        {viewMode !== 'dual' &&
          viewMode !== 'dashboard' &&
          viewMode !== 'drives' &&
          viewMode !== 'apps' &&
          viewMode !== 'app_details' &&
          viewMode !== 'utilities' &&
          viewMode !== 'large_files' &&
          viewMode !== 'scan_history' &&
          viewMode !== 'permissions' &&
          viewMode !== 'settings' &&
          isInspectorOpen && (
          <LiveInspector
            selectedItem={activeItem}
            onOpen={handleOpenItem}
            onReveal={handleReveal}
            onRename={(i) => {
              setRenameTarget(i);
              setIsRenameOpen(true);
            }}
            onTrash={(i) => {
              setDeleteTargets([i]);
              setIsDeleteOpen(true);
            }}
            onOpenProperties={(i) => {
              setPropertiesItem(i);
              setIsPropertiesOpen(true);
            }}
            onQuickPreview={(i) => {
              setPreviewItem(i);
              setIsPreviewOpen(true);
            }}
            onOpenTerminal={handleOpenTerminal}
            onOpenVSCode={handleOpenVSCode}
            onClose={() => setIsInspectorOpen(false)}
            isDarkMode={isDarkMode}
          />
        )}
      </div>

      {/* Modals & Overlays */}
      <RenameModal
        item={renameTarget}
        isOpen={isRenameOpen}
        onClose={() => setIsRenameOpen(false)}
        onRename={handleRename}
        isDarkMode={isDarkMode}
      />

      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        items={deleteTargets}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmTrash}
        isDarkMode={isDarkMode}
      />

      <DeepUninstallModal
        app={uninstallApp}
        isOpen={isUninstallModalOpen}
        onClose={() => setIsUninstallModalOpen(false)}
        onSuccess={() => {
          showToast('Uninstall successful', 'Leftover cleanup completed.');
          if (viewMode === 'app_details') {
            setViewMode('apps');
          }
        }}
        isDarkMode={isDarkMode}
      />

      {/* Phase 1: Win32 Detailed File Properties Modal */}
      <FilePropertiesModal
        item={propertiesItem}
        isOpen={isPropertiesOpen}
        onClose={() => setIsPropertiesOpen(false)}
        isDarkMode={isDarkMode}
      />

      {/* Phase 1: Advanced In-App Preview Modal */}
      <AdvancedPreviewModal
        item={previewItem}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        onReveal={(item) => handleReveal(item)}
        onOpenExternal={(item) => handleOpenItem(item)}
        isDarkMode={isDarkMode}
      />

      {/* Phase 1: Background Activity Center Drawer */}
      <ActivityCenterDrawer
        isOpen={isActivityDrawerOpen}
        onClose={() => setIsActivityDrawerOpen(false)}
        isDarkMode={isDarkMode}
      />

      <TransferToast
        isVisible={toast.isVisible}
        message={toast.message}
        subMessage={toast.subMessage}
        isDarkMode={isDarkMode}
      />

      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        isOpen={contextMenu.isOpen}
        item={contextMenu.item}
        onClose={() => setContextMenu((c) => ({ ...c, isOpen: false }))}
        onOpen={() => contextMenu.item && handleOpenItem(contextMenu.item)}
        onPreview={() => {
          if (contextMenu.item) {
            setPreviewItem(contextMenu.item);
            setIsPreviewOpen(true);
          }
        }}
        onProperties={() => {
          if (contextMenu.item) {
            setPropertiesItem(contextMenu.item);
            setIsPropertiesOpen(true);
          }
        }}
        onDuplicate={() => {
          if (contextMenu.item) {
            handleDuplicate(contextMenu.item);
          }
        }}
        onAnalyzeStorage={() => contextMenu.item && runStorageXRay(contextMenu.item.path)}
        onOpenTerminal={() => contextMenu.item && handleOpenTerminal(contextMenu.item.path)}
        onOpenVSCode={() => contextMenu.item && handleOpenVSCode(contextMenu.item.path)}
        onCopyPath={() => {
          if (contextMenu.item) {
            navigator.clipboard.writeText(contextMenu.item.path);
            showToast('Path copied', contextMenu.item.path);
          }
        }}
        onCopyFileName={() => {
          if (contextMenu.item) {
            navigator.clipboard.writeText(contextMenu.item.name);
            showToast('Filename copied', contextMenu.item.name);
          }
        }}
        onRename={() => {
          if (contextMenu.item) {
            setRenameTarget(contextMenu.item);
            setIsRenameOpen(true);
          }
        }}
        onTrash={() => {
          if (contextMenu.item) {
            setDeleteTargets([contextMenu.item]);
            setIsDeleteOpen(true);
          }
        }}
        onCopy={handleCopy}
        onCut={handleCut}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};
