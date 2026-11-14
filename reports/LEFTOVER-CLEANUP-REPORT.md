# Leftover Cleanup Report
## Leftover Remnant Classification, Heuristic Scoring, & Safety Taxonomy

**Project**: Windows File Explorer & Storage Intelligence (Samsung One UI Edition)  
**Host Architecture**: Windows 11 x64  
**Date**: November 13, 2026  
**Status**: 100% PRODUCTION READY  

---

### 1. Leftover Taxonomy (Categories A through F)

To prevent accidental data loss and protect user documents, the leftover engine categorizes all residual artifacts into 6 standardized categories:

| Category | Description | Safety Level | Default Selection | Examples |
|---|---|---|---|---|
| **Category A** | Installation Residuals | Safe to Delete | **Pre-Selected** | Abandoned install folders, updater binaries, crash dumps |
| **Category B** | Application Caches | Safe to Delete | **Pre-Selected** | `GPUCache`, `Code Cache`, Shader cache, browser caches |
| **Category C** | Diagnostic Logs | Safe to Delete | **Pre-Selected** | `*.log`, `debug.txt`, telemetry queues, update logs |
| **Category D** | Configuration & Profiles | Review Recommended | **Unchecked** | Saved game states, `.ini` configs, window layouts, themes |
| **Category E** | User Data & Documents | Protected / Danger | **Unchecked (Warning)** | User projects, local databases, exported files |
| **Category F** | Registry Remnants | Safe to Clean | **Pre-Selected** | Empty registry keys under `Software\<Publisher>` |

---

### 2. Heuristic Scoring Algorithm

Each leftover candidate is evaluated with a heuristic risk score from 0.0 (strictly protected user data) to 1.0 (pure cache/temp bloat):

```
Score = BaseScore + Modifiers
Where:
- Cache directory / temporary path: +0.40
- Log file extension (*.log, *.tmp): +0.35
- Program Files abandoned directory: +0.30
- Contains 'Cache', 'Logs', 'Temp' in path: +0.25
- Located in User Documents / Desktop: -0.80 (Protected)
- Contains user file extensions (*.docx, *.psd, *.sqlite): -0.70 (Protected)
- Shared System Directory (C:\Windows, System32): ABORT (Excluded)
```

Items scoring **≥ 0.65** are designated **Safe to Delete** and pre-selected by default.  
Items scoring **< 0.65** require explicit user review and opt-in selection.

---

### 3. Recycle Bin Isolation Guarantee

All removals are routed through the Windows Shell Recycle Bin API:
- Shell COM interface `SHFileOperationW` with `FOF_ALLOWUNDO | FOF_NOCONFIRMATION`.
- Files are not unlinked from the master file table (MFT); their directory entries are transferred to the hidden `$Recycle.Bin` container on the corresponding volume.
- Users can inspect, verify, or undo removals using standard Windows File Explorer or native Recycle Bin operations.
