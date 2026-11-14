# Windows File Explorer & Storage Intelligence — Known Limitations & Scope

**Version**: 1.0.0  
**Target Platform**: Windows 10 & 11 (64-bit)  

---

## 1. Operating System & Filesystem Constraints

1. **Elevation & Administrator Privileges**:
   - Standard user mode: The application runs cleanly under standard user permissions. Scanning protected folders (such as `C:\System Volume Information` or other users' profiles) will gracefully return access denied and continue scanning accessible contents.
   - Deleting services or modifying system startup entries in `HKLM` requires launching the application with "Run as Administrator".

2. **Network Drives & Symbolic Links**:
   - Network shares (`\\server\share`) are supported for standard directory browsing and file copy/move operations. Some extended Win32 attributes or WMI hardware health checks are only supported on local physical disks.
   - Symbolic links and directory junctions are detected and navigated safely; circular links are automatically prevented from causing infinite recursion during storage scans.

3. **Application Uninstaller Execution**:
   - Standard uninstallers run their respective vendor setup wizards. Silent uninstallation (`/quiet`, `/qn`, `/silent`) depends on individual vendor support for silent CLI arguments.

4. **S.M.A.R.T. Health Information**:
   - Drive health reporting reflects information surfaced by standard Windows WMI / CIM disk controllers. Certain proprietary NVMe RAID controllers or virtual machines may report `healthy` as a generic fallback.

---

## 2. Future Roadmap

- Cloud Storage Provider Badging (OneDrive, Google Drive, Dropbox synchronization status).
- Native Virtual Drive Mount (.iso, .vhd).
- Multi-Tabbed Explorer Windows.
