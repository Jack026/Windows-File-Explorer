import React, { useState, useEffect } from 'react';
import {
  Settings,
  Palette,
  FolderTree,
  HardDrive,
  ShieldCheck,
  RotateCcw,
  Save,
  CheckCircle2,
  Trash2,
  Info,
  Sliders,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { AppSettings } from '../../types';
import { ApiService } from '../../services/api';

interface SettingsViewProps {
  isDarkMode: boolean;
  onThemeChange?: (theme: 'light' | 'dark' | 'system') => void;
  onAccentChange?: (accent: string) => void;
}

type SettingsSection = 'appearance' | 'explorer' | 'storage' | 'safety' | 'privacy' | 'about';

export const SettingsView: React.FC<SettingsViewProps> = ({
  isDarkMode,
  onThemeChange,
  onAccentChange,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const data = await ApiService.getSettings();
      setSettings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (updates: Partial<AppSettings>) => {
    if (!settings) return;
    const merged = { ...settings, ...updates };
    setSettings(merged);
    setIsSaving(true);
    try {
      const saved = await ApiService.updateSettings(updates);
      setSettings(saved);
      showToast('Settings saved successfully');
    } catch (err: any) {
      showToast(`Error saving settings: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all preferences to default values?')) return;
    setIsSaving(true);
    try {
      const reset = await ApiService.resetSettings();
      setSettings(reset);
      showToast('Settings reset to defaults');
    } catch (err: any) {
      showToast(`Error resetting: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearCache = async () => {
    try {
      const res = await ApiService.clearSettingsCache();
      showToast(res.message || 'Cache and history cleared');
    } catch (err: any) {
      showToast(`Failed: ${err.message}`);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  if (isLoading || !settings) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-10 h-10 rounded-full border-3 border-[#0072DE]/20 border-t-[#0072DE] animate-spin mb-4" />
        <span className="text-sm opacity-60">Loading preferences...</span>
      </div>
    );
  }

  const ACCENT_COLORS = [
    { label: 'One UI Blue', hex: '#0072DE' },
    { label: 'Emerald Green', hex: '#10B981' },
    { label: 'Violet', hex: '#8B5CF6' },
    { label: 'Rose Pink', hex: '#EC4899' },
    { label: 'Amber Gold', hex: '#F59E0B' },
  ];

  return (
    <div
      className={`flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar select-none transition-colors ${
        isDarkMode ? 'bg-[#121316] text-[#E3E2E6]' : 'bg-[#F4F5F8] text-[#191C1E]'
      }`}
    >
      <div className="max-w-5xl mx-auto space-y-6 animate-oneui-fade">
        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Preferences & Settings</h1>
            <p className="mt-1 text-sm opacity-70">
              Customize appearance, explorer behavior, storage thresholds, and safety safeguards.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
                isDarkMode
                  ? 'bg-white/[0.06] hover:bg-white/[0.1] text-white border-white/[0.06]'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-black/[0.05] shadow-xs'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>
          </div>
        </div>

        {/* Section Navigation Tabs (Samsung One UI style) */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
          {[
            { id: 'appearance', label: 'Appearance', icon: Palette },
            { id: 'explorer', label: 'File Explorer', icon: FolderTree },
            { id: 'storage', label: 'Storage & Scanning', icon: HardDrive },
            { id: 'safety', label: 'Safety & Protection', icon: ShieldCheck },
            { id: 'privacy', label: 'Privacy & History', icon: Sliders },
            { id: 'about', label: 'About', icon: Info },
          ].map((sec) => {
            const Icon = sec.icon;
            const isSel = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id as SettingsSection)}
                className={`px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all border ${
                  isSel
                    ? 'bg-[#0072DE] text-white border-[#0072DE] shadow-xs'
                    : isDarkMode
                    ? 'bg-[#1C1D22] text-slate-300 border-white/[0.06] hover:bg-white/[0.06]'
                    : 'bg-white text-slate-700 border-black/[0.05] hover:bg-slate-50 shadow-xs'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center gap-3 animate-oneui-fade">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-xs font-bold">{toastMessage}</span>
          </div>
        )}

        {/* Section 1: Appearance */}
        {activeSection === 'appearance' && (
          <div className="space-y-4">
            <div
              className={`p-6 rounded-3xl border space-y-6 ${
                isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
              }`}
            >
              <div>
                <h3 className="font-bold text-base mb-1">Color Theme</h3>
                <p className="text-xs opacity-60">Choose between dark mode, light mode, or match system settings.</p>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  {[
                    { id: 'dark', label: 'Dark Mode' },
                    { id: 'light', label: 'Light Mode' },
                    { id: 'system', label: 'System Default' },
                  ].map((th) => (
                    <button
                      key={th.id}
                      onClick={() => {
                        handleUpdate({ appearance: { ...settings.appearance, theme: th.id as any } });
                        if (onThemeChange) onThemeChange(th.id as any);
                      }}
                      className={`p-4 rounded-2xl border text-center transition-all ${
                        settings.appearance.theme === th.id
                          ? 'bg-[#0072DE]/15 border-[#0072DE] text-[#0072DE] font-bold'
                          : isDarkMode
                          ? 'bg-white/[0.02] border-white/[0.06] opacity-70 hover:opacity-100'
                          : 'bg-slate-50 border-black/[0.05] opacity-70 hover:opacity-100'
                      }`}
                    >
                      <span className="text-xs">{th.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-base mb-1">Accent Color</h3>
                <p className="text-xs opacity-60">Customize interface highlights and active badges.</p>
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  {ACCENT_COLORS.map((col) => (
                    <button
                      key={col.hex}
                      onClick={() => {
                        handleUpdate({ appearance: { ...settings.appearance, accentColor: col.hex } });
                        if (onAccentChange) onAccentChange(col.hex);
                      }}
                      className={`px-4 py-2 rounded-full border text-xs font-bold flex items-center gap-2 transition-all ${
                        settings.appearance.accentColor === col.hex
                          ? 'border-white text-white font-bold'
                          : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: col.hex }}
                    >
                      <span className="w-2 h-2 rounded-full bg-white" />
                      <span>{col.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <span className="font-bold text-sm block">Interface Animations</span>
                  <span className="text-xs opacity-60">Enable subtle Samsung One UI transition effects</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.appearance.animationsEnabled}
                  onChange={(e) =>
                    handleUpdate({ appearance: { ...settings.appearance, animationsEnabled: e.target.checked } })
                  }
                  className="rounded-full w-5 h-5 text-[#0072DE]"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <span className="font-bold text-sm block">Compact Spacing</span>
                  <span className="text-xs opacity-60">Reduce row padding for dense list browsing</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.appearance.compactSpacing}
                  onChange={(e) =>
                    handleUpdate({ appearance: { ...settings.appearance, compactSpacing: e.target.checked } })
                  }
                  className="rounded-full w-5 h-5 text-[#0072DE]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Explorer */}
        {activeSection === 'explorer' && (
          <div className="space-y-4">
            <div
              className={`p-6 rounded-3xl border space-y-6 ${
                isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
              }`}
            >
              <div>
                <label className="font-bold text-sm block mb-1">Default Startup Folder</label>
                <input
                  type="text"
                  value={settings.explorer.defaultFolder}
                  onChange={(e) =>
                    handleUpdate({ explorer: { ...settings.explorer, defaultFolder: e.target.value } })
                  }
                  className="w-full h-10 px-3.5 rounded-2xl border border-black/10 dark:border-white/10 bg-transparent text-xs font-mono outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <span className="font-bold text-sm block">Show Hidden Files</span>
                  <span className="text-xs opacity-60">Display Windows hidden filesystem items and dotfiles</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.explorer.showHiddenFiles}
                  onChange={(e) =>
                    handleUpdate({ explorer: { ...settings.explorer, showHiddenFiles: e.target.checked } })
                  }
                  className="rounded-full w-5 h-5 text-[#0072DE]"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <span className="font-bold text-sm block">Show File Extensions</span>
                  <span className="text-xs opacity-60">Display extensions (.txt, .exe, .png) explicitly</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.explorer.showFileExtensions}
                  onChange={(e) =>
                    handleUpdate({ explorer: { ...settings.explorer, showFileExtensions: e.target.checked } })
                  }
                  className="rounded-full w-5 h-5 text-[#0072DE]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Storage & Scanning */}
        {activeSection === 'storage' && (
          <div className="space-y-4">
            <div
              className={`p-6 rounded-3xl border space-y-6 ${
                isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
              }`}
            >
              <div>
                <label className="font-bold text-sm block mb-1">Default Storage Scan Mode</label>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {['quick', 'standard', 'deep'].map((m) => (
                    <button
                      key={m}
                      onClick={() => handleUpdate({ storage: { ...settings.storage, defaultScanMode: m as any } })}
                      className={`p-3.5 rounded-2xl border text-center capitalize text-xs font-bold transition-all ${
                        settings.storage.defaultScanMode === m
                          ? 'bg-[#0072DE]/15 border-[#0072DE] text-[#0072DE]'
                          : isDarkMode
                          ? 'bg-white/[0.02] border-white/[0.06] opacity-70'
                          : 'bg-slate-50 border-black/[0.05] opacity-70'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-sm block mb-1">
                  Concurrent Worker Limit: {settings.storage.maxConcurrentWorkers} Threads
                </label>
                <input
                  type="range"
                  min="1"
                  max="16"
                  value={settings.storage.maxConcurrentWorkers}
                  onChange={(e) =>
                    handleUpdate({
                      storage: { ...settings.storage, maxConcurrentWorkers: parseInt(e.target.value, 10) },
                    })
                  }
                  className="w-full accent-[#0072DE]"
                />
              </div>

              <div>
                <label className="font-bold text-sm block mb-1">Cache Retention (Days)</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.storage.cacheRetentionDays}
                  onChange={(e) =>
                    handleUpdate({
                      storage: { ...settings.storage, cacheRetentionDays: parseInt(e.target.value, 10) },
                    })
                  }
                  className="w-32 h-10 px-3.5 rounded-2xl border border-black/10 dark:border-white/10 bg-transparent text-xs font-mono outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Section 4: Safety & Protection */}
        {activeSection === 'safety' && (
          <div className="space-y-4">
            <div
              className={`p-6 rounded-3xl border space-y-6 ${
                isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm block">Route Deletions to Windows Recycle Bin</span>
                  <span className="text-xs opacity-60">Prevents permanent accidental file loss</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.safety.useRecycleBinByDefault}
                  onChange={(e) =>
                    handleUpdate({ safety: { ...settings.safety, useRecycleBinByDefault: e.target.checked } })
                  }
                  className="rounded-full w-5 h-5 text-[#0072DE]"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm block">Confirm Destructive Operations</span>
                  <span className="text-xs opacity-60">Display confirmation dialogs before deletions and cleanups</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.safety.confirmDestructiveActions}
                  onChange={(e) =>
                    handleUpdate({ safety: { ...settings.safety, confirmDestructiveActions: e.target.checked } })
                  }
                  className="rounded-full w-5 h-5 text-[#0072DE]"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm block">Review Deep Uninstall Plans</span>
                  <span className="text-xs opacity-60">Require explicit confirmation before removing leftover files and registry keys</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.safety.reviewBeforeUninstall}
                  onChange={(e) =>
                    handleUpdate({ safety: { ...settings.safety, reviewBeforeUninstall: e.target.checked } })
                  }
                  className="rounded-full w-5 h-5 text-[#0072DE]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Section 5: Privacy & Maintenance */}
        {activeSection === 'privacy' && (
          <div className="space-y-4">
            <div
              className={`p-6 rounded-3xl border space-y-6 ${
                isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm block">Clear Cache & Scan History</span>
                  <span className="text-xs opacity-60">Delete all cached folder sizes, scan records, and historical snapshots</span>
                </div>
                <button
                  onClick={handleClearCache}
                  className="px-4 py-2 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Cache</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <span className="font-bold text-sm block">Activity Logging</span>
                  <span className="text-xs opacity-60">Keep record of transfers and operations in Activity Center</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.privacy.activityLogging}
                  onChange={(e) =>
                    handleUpdate({ privacy: { ...settings.privacy, activityLogging: e.target.checked } })
                  }
                  className="rounded-full w-5 h-5 text-[#0072DE]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Section 6: About */}
        {activeSection === 'about' && (
          <div className="space-y-4">
            <div
              className={`p-6 rounded-3xl border space-y-4 ${
                isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
              }`}
            >
              <div className="flex items-center gap-3.5 pb-4 border-b border-black/[0.05] dark:border-white/[0.06]">
                <div className="w-12 h-12 rounded-2xl bg-[#0072DE]/15 text-[#0072DE] flex items-center justify-center font-bold text-xl">
                  SE
                </div>
                <div>
                  <h3 className="font-bold text-base">Windows File Explorer & Storage Intelligence</h3>
                  <span className="text-xs opacity-60">Version 1.0.0 (Phase 5: System & Settings Edition)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04]">
                  <span className="text-[10px] uppercase font-bold opacity-50 block">Architecture</span>
                  <span className="font-bold">Windows x64 Native Win32</span>
                </div>
                <div className="p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04]">
                  <span className="text-[10px] uppercase font-bold opacity-50 block">Design System</span>
                  <span className="font-bold">Samsung One UI 7 / 8</span>
                </div>
                <div className="p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04]">
                  <span className="text-[10px] uppercase font-bold opacity-50 block">Runtime</span>
                  <span className="font-bold">Electron 45.3 + Node 26</span>
                </div>
                <div className="p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04]">
                  <span className="text-[10px] uppercase font-bold opacity-50 block">Kernel Bridge</span>
                  <span className="font-bold text-[#10B981]">Active (Port 3579)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
