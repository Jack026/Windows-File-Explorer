# Windows File Explorer & Storage Intelligence — Project Architecture Report

**Platform**: Windows 10 & 11 (64-bit Desktop)  
**Version**: 1.0.0 (Phase 1–6 Full Release)  
**Design System**: Samsung One UI 7/8 Desktop Adaptation  

---

## 1. System Architecture Overview

The platform uses a decoupled dual-tier architecture engineered for native Windows performance, deep operating system integration, and a modern desktop user experience.

```
+---------------------------------------------------------------------------------+
|                         SAMSUNG ONE UI 7/8 DESKTOP CLIENT                       |
|                                                                                 |
|  [Frameless Titlebar & System Tray]  [Collapsible Sidebar Navigation]          |
|  - Storage Dashboard       - Applications (Discovery & Deep Uninstaller)       |
|  - File Explorer (List/Grid) - System Utilities (Duplicates, Dev Clean, Bin)  |
|  - Storage X-Ray & Treemap   - Security Permissions & Global Settings Center   |
|                                                                                 |
|             React 19 + TypeScript + Vite 8 + Tailwind CSS v4 + Lucide           |
+---------------------------------------+-----------------------------------------+
                                        | HTTP / SSE Stream / IPC
                                        v
+---------------------------------------------------------------------------------+
|                    WINDOWS FILESYSTEM & OS BRIDGE SERVICE                       |
|                                                                                 |
|  [Express 5 / Node.js 20 - 127.0.0.1 Loopback Only]                             |
|  - Scanner & Folder Sizing Engine       - Background Transfer Manager           |
|  - Persistent LRU Storage Cache         - Win32 Permissions ACL Analyzer        |
|  - Application Discovery & Footprint    - Windows Startup Manager               |
|  - Deep Uninstaller Engine              - Hardware Disk & Benchmark Analyzer    |
|  - Dev Cache & Temp Cleaners            - Reversible Undo/Redo Action Stack     |
+---------------------------------------+-----------------------------------------+
                                        |
      +---------------------------------+---------------------------------+
      | Native Win32 / Shell COM        | Base64 Encoded PowerShell / WMI |
      v                                 v                                 v
[Win32 FileSystem]             [Shell COM Namespace(10)]        [WMI / Registry]
(Cluster Sizes, Attributes)    (Recycle Bin Restore/Empty)      (HKLM/HKCU/WOW64 Apps)
```

---

## 2. Core Subsystems

### 2.1 Native Windows Filesystem Bridge
- **PowerShell Base64 Execution**: Implemented in `server/powershell-runner.ts` using `powershell.exe -NoProfile -NonInteractive -EncodedCommand <base64>`. Eliminates all shell quote-escaping bugs and code injection vulnerabilities.
- **Shell COM Integration**: Uses Windows Shell COM automation for Recycle Bin operations, allowing accurate original deletion location tracking and one-click restoration.
- **Physical Drive & WMI Engine**: Communicates with `Win32_LogicalDisk` and `Win32_DiskDrive` to monitor physical controller interfaces, SSD/HDD media types, and volume health.

### 2.2 Storage Engine & X-Ray Treemap
- **Multi-Level Scanning**: Implements recursive filesystem traversal with category classification (Media, Documents, Code, Archives, etc.).
- **Interactive Treemap**: Custom squarified layout algorithm visualizing storage consumption hierarchically with zoom-into-folder support.
- **SSE Stream Pipeline**: Real-time progress updates, pause, resume, and cancellation via Server-Sent Events.

### 2.3 Application Intelligence & Deep Uninstaller
- **Multi-Hive Discovery**: Aggregates installed applications across 64-bit Registry, 32-bit WOW6432Node, Current User hive, MSI database, and Windows Store / AppX packages.
- **Footprint Analyzer**: Measures actual on-disk space occupied across Program Files, ProgramData, AppData Local, and AppData Roaming.
- **Deep Clean Engine**: Identifies leftover directories, orphaned registry keys, and background services after standard uninstallers run.

### 2.4 User Interface & Samsung One UI Design Language
- **Squircle Geometry & Comfort Spacing**: Employs rounded container cards (`rounded-2xl`, `rounded-3xl`), soft borders, and generous padding inspired by Samsung One UI 7/8.
- **Signature Accent Palette**: Default Samsung One UI Signature Blue (`#0072DE`) with 5 customizable accent themes.
- **Responsive Layout**: Collapsible sidebar, floating action bars, breadcrumb navigation, and responsive dual-pane inspector.
