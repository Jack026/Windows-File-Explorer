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
