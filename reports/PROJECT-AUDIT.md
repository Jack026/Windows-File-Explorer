# Phase 1: Project Architecture & Codebase Audit Report

## 1. Executive Summary
- **Application Name**: Smart Explorer & Visual Storage Analyzer (Samsung One UI Edition)
- **Target OS**: Windows 10 & Windows 11 (64-bit native executable)
- **Design System**: Samsung One UI 7 / 8 desktop adaptation (Pebble/Squircle geometry, generous viewing/interaction hierarchy, dual Light/Dark theme, Samsung One UI Signature Blue `#0072DE`).
- **Framework & Technology Stack**:
  - **Desktop Runtime**: Electron v45.3.1 (Frameless window, custom titlebar, system tray integration, native window IPC)
  - **Native Local Bridge**: Node.js v26.13.0 + Express server (`server/index.ts` compiled via `esbuild` to `dist-server/index.cjs`), executing native Windows PowerShell COM / Win32 Shell API commands.
  - **Frontend UI**: React 19 + TypeScript 5.8 / 7.0 + Vite 8 + Tailwind CSS v4 + Lucide React icons.
  - **Build & Packaging**: `electron-builder` targeting Windows x64 unpacked & portable executable.
- **Architectural Decision**:
  - Rust / Cargo is not installed on this host environment (`cargo: CommandNotFoundException`). Per the **Architecture Preservation Rules**, the existing working technology stack (Electron + native Windows Win32 Shell bridge + React 19) is retained, enhanced, and packaged into the final Windows desktop `.exe`.

---

## 2. Source Code & Component Inventory

### Backend Components (`server/`)
1. `server/index.ts`: Express API server listening on `http://127.0.0.1:3579`. Handles drives detection, directory listing, SSE folder size streaming, Storage X-Ray scanning, duplicate file detection, media streaming (HTTP 206 Partial Content), text previews, and file operations.
2. `server/windows-bridge.ts`: Direct OS-level Windows bridge executing PowerShell commands:
   - `Get-CimInstance Win32_LogicalDisk` for drive capacities and volumes.
   - Microsoft VisualBasic FileIO COM assembly (`[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile / DeleteDirectory` with `RecycleOption.SendToRecycleBin`) for safe Recycle Bin deletions.
   - `explorer.exe /select` for native file revealing.
   - `powershell.exe -NoExit` and `code.cmd` for launching Terminal and VS Code.
   - Project type detection (`package.json`, `Cargo.toml`, `requirements.txt`, `.git`).
3. `server/scanner.ts`: Parallel directory traversal engine with bounded concurrency, calculating folder weights, categorizing MIME types, filtering dev bloat (`node_modules`, `.venv`, `target`, `dist`, `__pycache__`, `Temp`), and computing SHA-256 hashes for duplicate file clustering.
4. `server/types.ts`: TypeScript data models shared across backend and frontend.

### Frontend Components (`src/components/`)
1. `Titlebar.tsx`: Frameless One UI window titlebar (`-webkit-app-region: drag`, Minimize, Maximize/Restore, Close controls, and Light/Dark mode toggle).
2. `Sidebar.tsx`: Samsung One UI collapsible navigation sidebar with drive cards (usage health colored bars), quick access folders, and storage tool shortcuts.
3. `Header.tsx`: Navigation history (Back, Forward, Up, Refresh), interactive breadcrumbs with clickable pill segments and raw path editor, One UI search bar, segmented view switcher, and quick action buttons.
4. `DashboardView.tsx`: Samsung One UI 7/8 "Your Storage" hero dashboard with large viewing typography, segmented storage capsule bar, local drive cards, quick access squircles, space reclaim banner, and largest files list.
5. `EnrichedListView.tsx`: Virtualized list view with 52px row height, soft squircle category icons, capsule storage share bars, and monospace tabular sizes.
6. `GridView.tsx`: Visual thumbnail grid view for media and design assets with One UI rounded cards.
7. `StorageXRayView.tsx`: Interactive Squarified Treemap with rounded blocks, hover tooltip, drilldown breadcrumbs, category distribution chips, and space reclaim banner.
8. `LiveInspector.tsx`: Right-hand contextual information panel with live media previews (zoomable images, video/audio player, syntax-highlighted code, PDF preview) and file action buttons.
9. `DualPaneView.tsx`: F3 Dual-Pane Commander mode with side-by-side directory trees and transfer actions.
10. `DuplicateFinder.tsx`: SHA-256 duplicate file detection and bulk cleanup view.
11. `Modals.tsx`: One UI Rename modal (F2 with extension preservation), Recycle Bin confirmation dialog, and Transfer toast notification.

---

## 3. Findings & Required Enhancements for Phase 2–10
1. **Scanning Lifecycle Controls (Pause, Resume, Cancel)**:
   - Need real backend scan lifecycle control for long-running Storage X-Ray scans: pausing scan execution, resuming without restart, and instant safe cancellation with thread cleanup.
2. **Scan Modes (Quick, Standard, Deep)**:
   - Add explicit scanning modes so users can choose between instant capacity checks (Quick), recursive folder weights (Standard), or comprehensive bloat & duplicate detection (Deep).
3. **Live Scan Progress Streaming**:
   - Provide real-time metrics during scan: files/sec speed, elapsed time, current scanned path, and scanned data volume.
4. **Intelligent Storage Caching**:
   - Cache folder sizes and scan results in memory and on disk (`.cache/storage-cache.json`) so navigating back to previously visited folders is instantaneous (<5ms) with cache freshness indicators.
5. **Inspector Toggle Button**:
   - Add a visible One UI toolbar toggle button in `Header.tsx` to expand or collapse the right-hand Live Inspector pane on demand.
6. **Select All & Keyboard Actions**:
   - Add toolbar "Select All" button and ensure full keyboard shortcut coverage (`Ctrl+A`, `Ctrl+C`, `Ctrl+X`, `Ctrl+V`, `Del`, `F2`, `F3`, `F5`).
7. **Transfer Conflict Handling**:
   - Handle filename collisions during Copy/Move operations with Replace, Skip, or Auto-Rename options.
