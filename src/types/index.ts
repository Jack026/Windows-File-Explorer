export type FileCategory =
  | 'media'
  | 'code'
  | 'archive'
  | 'document'
  | 'executable'
  | 'system'
  | 'other';

export interface DriveInfo {
  deviceId: string;       // e.g. "C:"
  volumeName: string;     // e.g. "OS"
  fileSystem: string;     // e.g. "NTFS"
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usagePercent: number;
  driveType: number;
  health: 'healthy' | 'warning' | 'danger';
}

export interface QuickDirectory {
  id: string;
  name: string;
  path: string;
  icon: string;
}

export interface FileItem {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  isSymbolicLink?: boolean;
  isLocked?: boolean;
  isDevCache?: boolean;
  size: number | null;
  formattedSize?: string;
  fileCount?: number;
  folderCount?: number;
  sharePercent?: number;  // % of parent total
  extension: string;
  category: FileCategory;
  createdAt: string;
  modifiedAt: string;
  relativeTime: string;
}

export interface DirectoryListing {
  currentPath: string;
  parentPath: string | null;
  exists: boolean;
  isLocked: boolean;
  items: FileItem[];
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
  isProject?: boolean;
  projectType?: string | null;
}

export interface CategorySummary {
  category: FileCategory;
  label: string;
  color: string;
  totalBytes: number;
  fileCount: number;
  percentage: number;
}

export interface BloatItem {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
  formattedSize: string;
  fileCount: number;
  lastModified: string;
  daysOld: number;
  selected?: boolean;
}

export interface TreemapNode {
  id: string;
  name: string;
  path: string;
  size: number;
  formattedSize: string;
  category: FileCategory;
  color: string;
  isDirectory: boolean;
  itemCount?: number;
  children?: TreemapNode[];
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
}

export interface StorageXRayReport {
  rootPath: string;
  totalBytes: number;
  formattedTotalSize: string;
  totalFiles: number;
  totalFolders: number;
  durationMs: number;
  categories: CategorySummary[];
  treemapRoot: TreemapNode;
  largestFiles: FileItem[];
  bloatItems: BloatItem[];
  potentialReclaimBytes: number;
  formattedPotentialReclaim: string;
}

export interface DuplicateGroup {
  hash: string;
  size: number;
  formattedSize: string;
  wasteBytes: number;
  formattedWaste: string;
  items: FileItem[];
}

export type ViewMode =
  | 'dashboard'
  | 'list'
  | 'compact'
  | 'grid'
  | 'large_icons'
  | 'xl_icons'
  | 'gallery'
  | 'dual'
  | 'drives'
  | 'xray'
  | 'duplicates'
  | 'bloat'
  | 'large_files'
  | 'scan_history'
  | 'apps'
  | 'app_details'
  | 'utilities'
  | 'permissions'
  | 'settings';
export type SortField = 'name' | 'size' | 'modified' | 'extension';
export type SortDirection = 'asc' | 'desc';

// ==========================================
// Phase 2: Storage History & Large Files Types
// ==========================================
export interface ScanHistoryRecord {
  id: string;
  timestamp: string;
  targetPath: string;
  mode: ScanMode;
  totalBytes: number;
  formattedTotalBytes: string;
  totalFiles: number;
  totalFolders: number;
  durationMs: number;
  categories: Record<
    FileCategory,
    {
      totalBytes: number;
      fileCount: number;
      percent: number;
    }
  >;
  topConsumers: {
    name: string;
    path: string;
    size: number;
    formattedSize: string;
    category: FileCategory;
  }[];
}

export interface ScanComparisonResult {
  scanA: ScanHistoryRecord;
  scanB: ScanHistoryRecord;
  deltaBytes: number;
  formattedDeltaBytes: string;
  isGrowth: boolean;
  deltaPercent: number;
  deltaFiles: number;
  deltaFolders: number;
  categoryDeltas: Record<
    string,
    {
      deltaBytes: number;
      formattedDeltaBytes: string;
      percentChange: number;
    }
  >;
}

export interface LargeFileItem {
  id: string;
  name: string;
  path: string;
  size: number;
  formattedSize: string;
  extension: string;
  category: FileCategory;
  createdAt: string;
  modifiedAt: string;
  accessedAt?: string;
  relativeTime: string;
  isStale: boolean;
}

// ==========================================
// Application Management & Footprint Types
// ==========================================
export type AppInstallType =
  | 'registry_x64'
  | 'registry_x86'
  | 'registry_user'
  | 'msi'
  | 'msix_appx'
  | 'winget'
  | 'portable';

export type AppCategory =
  | 'development'
  | 'games'
  | 'productivity'
  | 'graphics'
  | 'multimedia'
  | 'browsers'
  | 'utilities'
  | 'store'
  | 'system'
  | 'other';

export type OwnershipConfidence =
  | 'verified'
  | 'high_confidence'
  | 'possible'
  | 'shared'
  | 'unknown';

export type LeftoverCategory =
  | 'verified_files'
  | 'cache'
  | 'settings'
  | 'user_data'
  | 'shared_components'
  | 'uncertain';

export interface InstalledApp {
  id: string;
  name: string;
  displayName: string;
  publisher: string;
  version: string;
  installDate: string | null;
  installLocation: string | null;
  installType: AppInstallType;
  category: AppCategory;
  uninstallString: string | null;
  quietUninstallString: string | null;
  iconPath: string | null;
  estimatedSize: number | null;
  measuredSize: number | null;
  formattedMeasuredSize: string | null;
  isRunning: boolean;
  processIds: number[];
  hasLeftovers: boolean;
  hasUninstall: boolean;
  packageFamilyName?: string;
}

export interface AppLocationDetail {
  label: string;
  path: string;
  size: number;
  formattedSize: string;
  confidence: OwnershipConfidence;
  category: string;
  fileCount: number;
  folderCount: number;
  isAccessible: boolean;
}

export interface AppStorageBreakdown {
  appId: string;
  appName: string;
  mainInstallSize: number;
  formattedMainInstallSize: string;
  mainInstallPath: string | null;
  appDataLocalSize: number;
  formattedAppDataLocalSize: string;
  appDataLocalPath: string | null;
  appDataRoamingSize: number;
  formattedAppDataRoamingSize: string;
  appDataRoamingPath: string | null;
  programDataSize: number;
  formattedProgramDataSize: string;
  programDataPath: string | null;
  cacheSize: number;
  formattedCacheSize: string;
  logsAndTempSize: number;
  formattedLogsAndTempSize: string;
  otherDataSize: number;
  formattedOtherDataSize: string;
  totalMeasuredFootprint: number;
  formattedTotalMeasuredFootprint: string;
  totalFiles: number;
  totalFolders: number;
  locations: AppLocationDetail[];
}

export interface AppFileTreeNode {
  id: string;
  name: string;
  path: string;
  size: number;
  formattedSize: string;
  isDirectory: boolean;
  fileCount?: number;
  folderCount?: number;
  lastModified: string;
  confidence: OwnershipConfidence;
  isSafeToClean: boolean;
  isAccessible: boolean;
  children?: AppFileTreeNode[];
}

export interface AppLargestFile {
  path: string;
  name: string;
  size: number;
  formattedSize: string;
  type: string;
  category: string;
  lastModified: string;
}

export interface LeftoverCandidate {
  id: string;
  path: string;
  name: string;
  size: number;
  formattedSize: string;
  type: 'file' | 'folder' | 'registry_key';
  category: LeftoverCategory;
  categoryLabel: string;
  confidence: OwnershipConfidence;
  selected: boolean;
  reason: string;
  isProtected: boolean;
}

export interface UninstallPlan {
  app: InstalledApp;
  preUninstallBreakdown: AppStorageBreakdown;
  officialUninstallCmd: string | null;
  leftoverCandidates: LeftoverCandidate[];
  associatedServices: string[];
  associatedTasks: string[];
}

export interface UninstallVerificationReport {
  appName: string;
  originalFootprint: number;
  formattedOriginalFootprint: string;
  reclaimedBytes: number;
  formattedReclaimedBytes: string;
  removedFilesCount: number;
  retainedSharedCount: number;
  inaccessibleLocations: string[];
  registryKeysCleaned: number;
  completedAt: string;
  summary: string;
}

export interface AppComparisonResult {
  appA: {
    app: InstalledApp;
    footprint: AppStorageBreakdown;
  };
  appB: {
    app: InstalledApp;
    footprint: AppStorageBreakdown;
  };
  deltaBytes: number;
  formattedDeltaBytes: string;
  percentageDiff: number;
  filesDelta: number;
  foldersDelta: number;
  summary: string;
}

// ==========================================
// System Utilities Types
// ==========================================
export interface LargeFileItem {
  id: string;
  name: string;
  path: string;
  size: number;
  formattedSize: string;
  extension: string;
  category?: FileCategory;
  createdAt?: string;
  modifiedAt: string;
  accessedAt?: string;
  relativeTime?: string;
  isStale?: boolean;
}

export interface RecycleBinItem {
  id: string;
  name: string;
  originalLocation: string;
  dateDeleted: string;
  sizeBytes: number;
  formattedSize: string;
  type: string;
}

export interface DevCleanerItem {
  id: string;
  name: string;
  path: string;
  projectName: string;
  projectPath: string;
  ecosystem: 'Node.js' | 'Python' | 'Rust' | 'Flutter' | 'Java' | '.NET' | 'Build Output';
  sizeBytes: number;
  formattedSize: string;
  fileCount: number;
  lastModified: string;
  cleanupRisk: 'Low' | 'Medium';
  regenerationHint: string;
}

export interface EmptyFolderItem {
  path: string;
  name: string;
  parentPath: string;
  lastModified: string;
}

export interface TempCategoryItem {
  id: string;
  label: string;
  path: string;
  size: number;
  formattedSize: string;
  fileCount: number;
  safeToClean: boolean;
}

export interface FolderComparisonResult {
  pathA: string;
  pathB: string;
  onlyInA: { name: string; path: string; size: number; formattedSize: string }[];
  onlyInB: { name: string; path: string; size: number; formattedSize: string }[];
  different: { name: string; pathA: string; pathB: string; sizeA: number; sizeB: number; formattedDiff: string }[];
  identicalCount: number;
}

export interface RenameRule {
  type: 'replace' | 'prefix' | 'suffix' | 'numbering' | 'extension';
  findText?: string;
  replaceText?: string;
  prefix?: string;
  suffix?: string;
  startNumber?: number;
  digits?: number;
  newExtension?: string;
}

export interface RenameItemPreview {
  originalPath: string;
  originalName: string;
  newName: string;
  newPath: string;
  hasConflict: boolean;
}

export interface StartupItem {
  id: string;
  name: string;
  publisher?: string;
  command: string;
  resolvedExePath?: string;
  source: 'registry_hklm' | 'registry_hkcu' | 'registry_wow64' | 'startup_folder';
  location: string;
  isEnabled: boolean;
  category?: 'Security' | 'Cloud & Sync' | 'Audio/Hardware' | 'Productivity' | 'Utility' | 'Other';
  fileSize?: number;
  formattedSize?: string;
}

export interface DiskBenchmarkResult {
  drivePath: string;
  readSpeedMBs: number;
  formattedSpeed: string;
  latencyMs: number;
  testDurationMs: number;
  bytesRead: number;
  formattedBytesRead: string;
  testTimestamp: string;
}

export interface AccessRule {
  identity: string;
  accessControlType: 'Allow' | 'Deny';
  fileSystemRights: string;
  isInherited: boolean;
  inheritanceFlags: string;
  propagationFlags: string;
}

export interface PermissionReport {
  path: string;
  name: string;
  isDirectory: boolean;
  owner: string;
  group: string;
  areAccessRulesProtected: boolean;
  accessRules: AccessRule[];
  canRead: boolean;
  canWrite: boolean;
  canExecute: boolean;
  isReadOnly: boolean;
  isSystem: boolean;
  summary: string;
}

export interface AppSettings {
  appearance: {
    theme: 'light' | 'dark' | 'system';
    accentColor: string;
    compactSpacing: boolean;
    animationsEnabled: boolean;
    sidebarExpanded: boolean;
  };
  explorer: {
    defaultFolder: string;
    showHiddenFiles: boolean;
    showFileExtensions: boolean;
    defaultSortField: 'name' | 'size' | 'modified' | 'extension';
    defaultSortDirection: 'asc' | 'desc';
    defaultViewMode: string;
  };
  storage: {
    defaultScanMode: 'quick' | 'standard' | 'deep';
    maxConcurrentWorkers: number;
    excludedFolders: string[];
    cacheRetentionDays: number;
  };
  safety: {
    useRecycleBinByDefault: boolean;
    confirmDestructiveActions: boolean;
    reviewBeforeUninstall: boolean;
  };
  privacy: {
    telemetryEnabled: boolean;
    activityLogging: boolean;
  };
}

export interface DiskHardwareInfo {
  deviceId: string;
  model: string;
  interfaceType: string;
  mediaType: string;
  sizeBytes: number;
  formattedSize: string;
  status: string;
  health: 'healthy' | 'warning' | 'unknown';
  partitions: number;
  serialNumber: string;
}

export type ScanMode = 'quick' | 'standard' | 'deep';
export type ScanStatus = 'idle' | 'running' | 'paused' | 'completed' | 'cancelled' | 'error';

export interface ScanProgress {
  scanId: string;
  status: ScanStatus;
  mode: ScanMode;
  currentPath: string;
  scannedFiles: number;
  scannedFolders: number;
  totalBytes: number;
  formattedTotalBytes: string;
  speedFilesPerSec: number;
  elapsedMs: number;
  report?: StorageXRayReport;
  message?: string;
}

export interface FilterState {
  query: string;
  extension: string;
  minSizeMB: number;
  category: string;
}

export interface ClipboardState {
  items: FileItem[];
  action: 'copy' | 'cut' | null;
}

// ==========================================
// Phase 1: Explorer Tabs, Properties & Transfers
// ==========================================
export interface ExplorerTab {
  id: string;
  title: string;
  path: string;
  history: string[];
  historyIndex: number;
  viewMode: ViewMode;
  selectedItems: string[];
}

export interface DetailedFileProperties {
  path: string;
  name: string;
  directory: string;
  extension: string;
  sizeBytes: number;
  formattedSize: string;
  sizeOnDiskBytes: number;
  formattedSizeOnDisk: string;
  createdAt: string;
  modifiedAt: string;
  accessedAt: string;
  isDirectory: boolean;
  isFile: boolean;
  attributes: {
    readOnly: boolean;
    hidden: boolean;
    system: boolean;
    archive: boolean;
  };
  fileCount?: number;
  folderCount?: number;
  checksums?: {
    md5?: string;
    sha256?: string;
  };
}

export interface TransferTask {
  id: string;
  type: 'copy' | 'move' | 'delete' | 'scan' | 'create';
  title: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  sourcePath?: string;
  destinationPath?: string;
  totalItems: number;
  completedItems: number;
  totalBytes: number;
  transferredBytes: number;
  speedBytesPerSec: number;
  startTime: number;
  elapsedMs: number;
  error?: string;
}

export interface UndoResult {
  success: boolean;
  message: string;
  affectedPath?: string;
}
