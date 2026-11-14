# Windows File Explorer & Storage Intelligence Platform

[![Windows 10/11](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011%20x64-0078D4?logo=windows&logoColor=white)](https://microsoft.com)
[![Samsung One UI 7/8 Inspired](https://img.shields.io/badge/Design%20System-Samsung%20One%20UI%207%2F8-0072DE)](https://samsung.com)
[![Automated QA Pass Rate](https://img.shields.io/badge/QA%20Verification-100%25%20Passed%20(59%2F59)-success)](./release/FEATURE-COMPLETION-MATRIX.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A standalone **Windows Desktop File Explorer & Deep Storage Intelligence Platform** engineered with the **Samsung One UI 7/8** design philosophy. Combines the fluid convenience of a modern desktop file manager with the analytical power of WizTree, the visual clarity of WinDirStat, the cleanup intelligence of Revo Uninstaller, and native Win32 security and permissions analysis.

---

## 🌟 Key Highlights & Capabilities

### 1. 🗂️ Core File Explorer (Samsung One UI Edition)
- **One UI 7/8 Visual Architecture**: Squircle geometric surfaces, comfortable visual hierarchy, and dual Light / Dark mode themes with customizable Samsung accent colors.
- **Dual-Pane Commander (`F3`)**: Side-by-side split explorer for high-speed file transfers between disks.
- **Instant Path Autocomplete & Search**: Sub-millisecond path suggestions, deep recursive pattern searching, and file type / size filters.
- **Live Media & Code Inspector**: Embedded partial-content streaming player for video (`.mp4`, `.webm`) and audio (`.mp3`, `.wav`), image zoom viewer, and Prism.js syntax highlighting for code (`.ts`, `.py`, `.rs`, `.json`, `.md`, etc.).
- **Win32 File Properties**: Exact on-disk cluster-aligned size calculations, cryptographic SHA-256 signatures, and Win32 attribute toggling (`ReadOnly`, `Hidden`).
- **Undo / Redo History Stack (`Ctrl+Z` / `Ctrl+Y`)**: Reversible transaction stack for file creation, rename, duplicate, copy, and move operations.
- **Non-Blocking Background Transfers**: Floating transfer drawer with real-time transfer speeds, progress bars, pause/cancel, and automatic conflict policies.

### 2. 📊 Storage X-Ray & Interactive Treemap
- **Interactive Squarified Treemap**: Visualizes disk consumption with nested proportional colored blocks and instant drilldown navigation.
- **SSE Real-Time Scanning**: Server-Sent Events stream live progress with instant **Pause**, **Resume**, and **Cancel** controls.
- **Persistent Storage Caching**: In-memory and on-disk LRU cache delivering instant folder size calculations on subsequent visits.
- **Large File Finder Engine**: Identifies disk hogs exceeding custom size thresholds (>50MB, >100MB, >1GB) with stale file detection (>180 days).
- **Storage Growth Tracker**: Records scan snapshots over time and generates comparative growth delta reports.

### 3. 📦 Advanced Installed Application Manager & Deep Uninstaller
- **Multi-Source Application Discovery**: Detects installed applications across 64-bit Registry, 32-bit `WOW6432Node`, Current User hive, MSI installer database, and Microsoft Store / AppX packages.
- **Comprehensive Footprint Analysis**: Calculates real disk footprint across `Program Files`, `ProgramData`, `AppData\Local`, and `AppData\Roaming`.
- **Side-by-Side App Comparison**: Compares two installed applications, detailing file counts, cache sizes, and storage differentials.
- **Deep Uninstaller & Leftover Removal**: Automatically launches vendor uninstallation, then scans for leftover files, directories, registry entries, and scheduled services before offering safe one-click cleaning.
- **Inventory Export**: Exports complete installed application inventories to **CSV** and **JSON**.

### 4. 🧹 System Utilities & Storage Cleaners
- **Windows Recycle Bin Manager**: Native Shell COM integration (`Shell.Application.Namespace(10)`) showing original file paths, deletion timestamps, one-click item restoration, and safe bin emptying.
- **Dev & Build Cache Cleaner**: Detects and safely cleans abandoned build artifacts across Node.js (`node_modules`, `.next`), Python (`__pycache__`, `.venv`), Rust (`target`), Dart/Flutter (`.dart_tool`), Java (`.gradle`), and .NET (`bin`, `obj`) with strict `.git` repository preservation.
- **Duplicate File Finder**: Two-tier size pre-filtering and SHA-256 cryptographic verification with **Keep Newest** and **Keep Oldest** smart auto-selection.
- **Empty Folder Cleaner**: Safely discovers and removes recursive empty directories.
- **Temporary Files Analyzer**: Scans and cleans Windows Temp, User Temp, Prefetch, and browser caches.
- **Side-by-Side Folder Tree Comparator**: Visually compares directory hierarchies to identify missing, different, and identical files.
- **Multi-Algorithm Checksums**: Simultaneously calculates MD5, SHA-1, SHA-256, and SHA-512 cryptographic hashes.

### 5. 🛡️ System Security, Permissions & Global Settings
- **Win32 Permissions & ACL Analyzer**: Inspects Owner, Group, inheritance protection, and full Access Control Lists using depth-4 JSON Win32 `Get-Acl`. Probes live read, write, and execute permissions.
- **Windows Startup Manager**: Manages autostart entries across `HKLM`, `HKCU`, `WOW6432Node`, and Startup folders with semantic category badges and an interactive "Open in Explorer" shortcut.
- **Hardware Drive Info & Non-Destructive Benchmark**: Inspects physical controller model, media type (SSD/NVMe/HDD), and WMI health status. Includes a safe sequential read throughput benchmark (MB/s & latency).
- **Global Settings & Preferences Center**: 6 tabbed preference sections (Appearance, Explorer, Storage, Safety, Privacy, About) persisting in `.cache/settings.json`.

---

## 🔒 Security & Safety Guarantees

1. **Recycle Bin Routing**: All user file deletions route exclusively to the Windows Recycle Bin via Microsoft VisualBasic FileIO COM assembly (`RecycleOption.SendToRecycleBin`). No files are permanently destroyed without explicit confirmation.
2. **Protected Windows System Paths**: Critical system directories (`C:\Windows`, `C:\Windows\System32`, `C:\Program Files`, root volume `C:\`) are guarded by `isProtectedSystemPath` and cannot be deleted via the application.
3. **Command Injection Immunity**: All PowerShell scripts are executed via UTF-16LE Base64 `-EncodedCommand`, preventing shell interpolation or argument injection from file names with quotes, backticks, or special characters.
4. **Loopback-Only Binding**: The background filesystem bridge server binds exclusively to `127.0.0.1:3579`, preventing network exposure.

---

## ⚡ Performance Highlights

- **Instant Directory First Paint**: **9.18 ms** (for 50+ items)
- **Cryptographic Hashing Throughput**: **206.5 MB/s** (SHA-256 streaming)
- **Drive Enumeration & WMI Status**: **416 ms**
- **Startup Inventory Query**: **464 ms** (across 5 hives)
- **Memory Footprint**: **14.2 MB** heap used / **75 MB** RSS

---

## ⌨️ Global Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + F` | Focus Search bar |
| `Ctrl + H` | Toggle Hidden files |
| `Ctrl + Shift + N` | Create new folder |
| `F3` | Toggle Dual-Pane Commander mode |
| `F5` | Refresh current directory |
| `Delete` | Move selected item(s) to Recycle Bin |
| `Alt + Enter` | Open File Properties & Win32 Attributes |
| `Ctrl + Z` | Undo last file operation |
| `Ctrl + Y` | Redo last undone operation |
| `Ctrl + C` / `Ctrl + V` | Copy / Paste files |
| `Ctrl + D` | Duplicate file with automatic copy naming |
| `Ctrl + ,` | Open Settings & Preferences Center |

---

## 📦 Production Release Artifacts

Windows x64 installers and portable binaries are published on the
[GitHub Releases page](https://github.com/Jack026/Windows-File-Explorer/releases).
Release reports and verification documents remain in the `release/` directory:

| Artifact | Location | Description |
| :--- | :--- | :--- |
| **Windows Setup Installer** | GitHub Release asset | Complete NSIS setup installer with desktop and start menu shortcuts |
| **Standalone Portable Executable** | GitHub Release asset | Portable executable that runs without installation |
| **Unpacked Directory** | CI build output | Unpacked x64 application directory used for validation |

---

## 🛠️ Development & Building

### Prerequisites
- Windows 10 or 11 (64-bit)
- Node.js v20+ / npm v10+

### Run in Development Mode
```bash
# Launch both backend bridge and Vite frontend:
npm run dev

# Launch desktop Electron window connected to dev server:
npm run desktop
```

### Run Automated QA & Test Suites
```bash
# Run all 59 tests across all 6 phases:
npx tsx scripts/test_phase1_core.ts
npx tsx scripts/test_phase2_storage.ts
npx tsx scripts/test_phase3_apps.ts
npx tsx scripts/test_phase4_utilities.ts
npx tsx scripts/test_phase5_system.ts
npx tsx scripts/test_phase6_performance_security.ts
```

### Build Production Release
```bash
# Build frontend and server bundles:
npm run build:all

# Package Windows NSIS installer and portable executable:
npm run build:release
```

---

## 📄 Release Documentation

- [Feature Completion Matrix](./release/FEATURE-COMPLETION-MATRIX.md)
- [Security Audit Report](./release/SECURITY-AUDIT-REPORT.md)
- [Performance Benchmarking Report](./release/PERFORMANCE-REPORT.md)
- [Project Architecture Report](./release/PROJECT-ARCHITECTURE-REPORT.md)
- [Known Limitations & Scope](./release/KNOWN-LIMITATIONS.md)
- [Phase 6 Release Summary](./release/PHASE6-RELEASE-REPORT.md)

---

## ⚖️ License
Released under the [MIT License](LICENSE).
