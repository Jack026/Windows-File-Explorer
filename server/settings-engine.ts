import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';

export interface AppSettings {
  appearance: {
    theme: 'light' | 'dark' | 'system';
    accentColor: string; // e.g. '#0072DE'
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

export const DEFAULT_SETTINGS: AppSettings = {
  appearance: {
    theme: 'dark',
    accentColor: '#0072DE',
    compactSpacing: false,
    animationsEnabled: true,
    sidebarExpanded: true,
  },
  explorer: {
    defaultFolder: 'C:\\',
    showHiddenFiles: false,
    showFileExtensions: true,
    defaultSortField: 'name',
    defaultSortDirection: 'asc',
    defaultViewMode: 'dashboard',
  },
  storage: {
    defaultScanMode: 'standard',
    maxConcurrentWorkers: 4,
    excludedFolders: ['C:\\Windows', 'C:\\$Recycle.Bin', 'System Volume Information'],
    cacheRetentionDays: 30,
  },
  safety: {
    useRecycleBinByDefault: true,
    confirmDestructiveActions: true,
    reviewBeforeUninstall: true,
  },
  privacy: {
    telemetryEnabled: false,
    activityLogging: true,
  },
};

export class SettingsEngine {
  private static CACHE_DIR = path.resolve(process.cwd(), '.cache');
  private static SETTINGS_FILE = path.join(SettingsEngine.CACHE_DIR, 'settings.json');
  private static activeSettings: AppSettings = { ...DEFAULT_SETTINGS };
  private static isInitialized = false;

  static init(): void {
    if (this.isInitialized) return;
    try {
      if (!fsSync.existsSync(this.CACHE_DIR)) {
        fsSync.mkdirSync(this.CACHE_DIR, { recursive: true });
      }
      if (fsSync.existsSync(this.SETTINGS_FILE)) {
        const raw = fsSync.readFileSync(this.SETTINGS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.activeSettings = this.mergeWithDefaults(parsed);
      } else {
        this.saveSync(this.activeSettings);
      }
    } catch {
      this.activeSettings = { ...DEFAULT_SETTINGS };
    }
    this.isInitialized = true;
  }

  static getSettings(): AppSettings {
    this.init();
    return { ...this.activeSettings };
  }

  static async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    this.init();
    this.activeSettings = this.mergeWithDefaults({ ...this.activeSettings, ...updates });
    await this.save(this.activeSettings);
    return { ...this.activeSettings };
  }

  static async resetSettings(): Promise<AppSettings> {
    this.activeSettings = { ...DEFAULT_SETTINGS };
    await this.save(this.activeSettings);
    return { ...this.activeSettings };
  }

  private static mergeWithDefaults(saved: any): AppSettings {
    return {
      appearance: { ...DEFAULT_SETTINGS.appearance, ...(saved.appearance || {}) },
      explorer: { ...DEFAULT_SETTINGS.explorer, ...(saved.explorer || {}) },
      storage: { ...DEFAULT_SETTINGS.storage, ...(saved.storage || {}) },
      safety: { ...DEFAULT_SETTINGS.safety, ...(saved.safety || {}) },
      privacy: { ...DEFAULT_SETTINGS.privacy, ...(saved.privacy || {}) },
    };
  }

  private static async save(settings: AppSettings): Promise<void> {
    try {
      await fs.writeFile(this.SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    } catch (err) {
      console.error('[SettingsEngine] Failed to save settings to disk:', err);
    }
  }

  private static saveSync(settings: AppSettings): void {
    try {
      fsSync.writeFileSync(this.SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    } catch {}
  }
}
