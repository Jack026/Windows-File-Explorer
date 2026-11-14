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
  driveType: number;      // 3 = Fixed, 2 = Removable, etc.
  health: 'healthy' | 'warning' | 'danger'; // <75%, 75-89%, >=90%
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
  size: number | null;     // null for folders until calculated
  formattedSize?: string;
  fileCount?: number;     // for folders
  folderCount?: number;   // for folders
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
  type: string;           // 'node_modules' | '.venv' | '__pycache__' | '.next' | 'target' | 'Temp' etc.
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
