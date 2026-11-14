import React, { useState, useEffect } from 'react';
import {
  X,
  Package,
  HardDrive,
  Activity,
  Layers,
  Calendar,
  Building,
  CheckCircle2,
  Folder,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { InstalledApp, AppComparisonResult } from '../../types';
import { formatBytes, formatNumber } from '../../utils/formatters';
import { ApiService } from '../../services/api';

interface ApplicationCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  apps: InstalledApp[];
  initialAppA?: InstalledApp | null;
  onInspectApp: (app: InstalledApp) => void;
  isDarkMode: boolean;
}

export const ApplicationCompareModal: React.FC<ApplicationCompareModalProps> = ({
  isOpen,
  onClose,
  apps,
  initialAppA,
  onInspectApp,
  isDarkMode,
}) => {
  const [selectedAppAId, setSelectedAppAId] = useState<string>('');
  const [selectedAppBId, setSelectedAppBId] = useState<string>('');
  const [comparison, setComparison] = useState<AppComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialAppA) {
        setSelectedAppAId(initialAppA.id);
        const otherApp = apps.find((a) => a.id !== initialAppA.id);
        if (otherApp) setSelectedAppBId(otherApp.id);
      } else if (apps.length >= 2) {
        setSelectedAppAId(apps[0].id);
        setSelectedAppBId(apps[1].id);
      }
    }
  }, [isOpen, initialAppA, apps]);

  useEffect(() => {
    if (selectedAppAId && selectedAppBId && selectedAppAId !== selectedAppBId) {
      runComparison(selectedAppAId, selectedAppBId);
    }
  }, [selectedAppAId, selectedAppBId]);

  const runComparison = async (idA: string, idB: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await ApiService.compareApps(idA, idB);
      setComparison(res);
    } catch (err: any) {
      setError(err.message || 'Failed to compare applications');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const appA = apps.find((a) => a.id === selectedAppAId);
  const appB = apps.find((a) => a.id === selectedAppBId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-oneui-fade">
      <div
        className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-all ${
          isDarkMode
            ? 'bg-[#16181D] border-white/[0.08] text-[#E3E2E6]'
            : 'bg-white border-black/[0.08] text-[#191C1E]'
        }`}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#0072DE]/15 text-[#0072DE] flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Compare Applications</h2>
              <p className="text-xs opacity-60">
                Side-by-side analysis of real on-disk footprint, files, and installation metadata.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* App Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* App A Selector */}
            <div
              className={`p-4 rounded-2xl border ${
                isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-slate-50 border-black/[0.05]'
              }`}
            >
              <label className="block text-xs font-bold uppercase tracking-wider opacity-60 mb-2">
                Application A
              </label>
              <select
                value={selectedAppAId}
                onChange={(e) => setSelectedAppAId(e.target.value)}
                className={`w-full p-2.5 rounded-xl border text-sm font-semibold outline-none transition-colors ${
                  isDarkMode
                    ? 'bg-[#16181D] border-white/[0.1] text-white'
                    : 'bg-white border-black/[0.08] text-slate-800'
                }`}
              >
                {apps.map((a) => (
                  <option key={a.id} value={a.id} disabled={a.id === selectedAppBId}>
                    {a.displayName} ({a.publisher})
                  </option>
                ))}
              </select>
            </div>

            {/* App B Selector */}
            <div
              className={`p-4 rounded-2xl border ${
                isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-slate-50 border-black/[0.05]'
              }`}
            >
              <label className="block text-xs font-bold uppercase tracking-wider opacity-60 mb-2">
                Application B
              </label>
              <select
                value={selectedAppBId}
                onChange={(e) => setSelectedAppBId(e.target.value)}
                className={`w-full p-2.5 rounded-xl border text-sm font-semibold outline-none transition-colors ${
                  isDarkMode
                    ? 'bg-[#16181D] border-white/[0.1] text-white'
                    : 'bg-white border-black/[0.08] text-slate-800'
                }`}
              >
                {apps.map((a) => (
                  <option key={a.id} value={a.id} disabled={a.id === selectedAppAId}>
                    {a.displayName} ({a.publisher})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-full border-3 border-[#0072DE]/20 border-t-[#0072DE] animate-spin mb-3" />
              <span className="text-sm font-bold">Measuring and comparing on-disk footprints...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-semibold text-center">
              {error}
            </div>
          ) : comparison ? (
            <div className="space-y-6">
              {/* Summary Banner */}
              <div className="p-4 rounded-2xl bg-[#0072DE]/10 border border-[#0072DE]/20 flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-[#0072DE] shrink-0" />
                <span className="text-xs font-semibold leading-relaxed text-[#0072DE] dark:text-[#5B95FF]">
                  {comparison.summary}
                </span>
              </div>

              {/* Side-by-Side Comparison Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* App A Card */}
                <div
                  className={`p-5 rounded-3xl border transition-all ${
                    isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#0072DE]/15 text-[#0072DE] flex items-center justify-center shrink-0">
                      <Package className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-base truncate" title={comparison.appA.app.displayName}>
                        {comparison.appA.app.displayName}
                      </h3>
                      <p className="text-xs opacity-60 truncate">{comparison.appA.app.publisher}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                      <span className="text-xs opacity-60">Measured Footprint</span>
                      <span className="text-sm font-extrabold font-mono text-[#0072DE] dark:text-[#5B95FF]">
                        {comparison.appA.footprint.formattedTotalMeasuredFootprint}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                      <span className="text-xs opacity-60">Version</span>
                      <span className="text-xs font-mono font-bold">{comparison.appA.app.version}</span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                      <span className="text-xs opacity-60">Installed Date</span>
                      <span className="text-xs font-mono">{comparison.appA.app.installDate || 'Unknown'}</span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                      <span className="text-xs opacity-60">Main Program Size</span>
                      <span className="text-xs font-mono font-bold">
                        {comparison.appA.footprint.formattedMainInstallSize}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                      <span className="text-xs opacity-60">AppData (Local + Roaming)</span>
                      <span className="text-xs font-mono font-bold">
                        {formatBytes(
                          comparison.appA.footprint.appDataLocalSize +
                            comparison.appA.footprint.appDataRoamingSize
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                      <span className="text-xs opacity-60">ProgramData Size</span>
                      <span className="text-xs font-mono font-bold">
                        {comparison.appA.footprint.formattedProgramDataSize}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                      <span className="text-xs opacity-60">Total Files</span>
                      <span className="text-xs font-mono font-bold">
                        {formatNumber(comparison.appA.footprint.totalFiles)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-xs opacity-60">Running Status</span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          comparison.appA.app.isRunning
                            ? 'bg-[#10B981]/15 text-[#10B981]'
                            : 'opacity-50'
                        }`}
                      >
                        {comparison.appA.app.isRunning ? 'Running' : 'Stopped'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      onInspectApp(comparison.appA.app);
                    }}
                    className="mt-4 w-full py-2 rounded-2xl bg-[#0072DE]/10 hover:bg-[#0072DE]/20 text-[#0072DE] text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>Inspect {comparison.appA.app.displayName}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* App B Card */}
                <div
                  className={`p-5 rounded-3xl border transition-all ${
                    isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#8B5CF6]/15 text-[#8B5CF6] flex items-center justify-center shrink-0">
                      <Package className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-base truncate" title={comparison.appB.app.displayName}>
                        {comparison.appB.app.displayName}
                      </h3>
                      <p className="text-xs opacity-60 truncate">{comparison.appB.app.publisher}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                      <span className="text-xs opacity-60">Measured Footprint</span>
                      <span className="text-sm font-extrabold font-mono text-[#8B5CF6] dark:text-[#A78BFA]">
                        {comparison.appB.footprint.formattedTotalMeasuredFootprint}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                      <span className="text-xs opacity-60">Version</span>
                      <span className="text-xs font-mono font-bold">{comparison.appB.app.version}</span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                      <span className="text-xs opacity-60">Installed Date</span>
                      <span className="text-xs font-mono">{comparison.appB.app.installDate || 'Unknown'}</span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                      <span className="text-xs opacity-60">Main Program Size</span>
                      <span className="text-xs font-mono font-bold">
                        {comparison.appB.footprint.formattedMainInstallSize}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                      <span className="text-xs opacity-60">AppData (Local + Roaming)</span>
                      <span className="text-xs font-mono font-bold">
                        {formatBytes(
                          comparison.appB.footprint.appDataLocalSize +
                            comparison.appB.footprint.appDataRoamingSize
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                      <span className="text-xs opacity-60">ProgramData Size</span>
                      <span className="text-xs font-mono font-bold">
                        {comparison.appB.footprint.formattedProgramDataSize}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                      <span className="text-xs opacity-60">Total Files</span>
                      <span className="text-xs font-mono font-bold">
                        {formatNumber(comparison.appB.footprint.totalFiles)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-xs opacity-60">Running Status</span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          comparison.appB.app.isRunning
                            ? 'bg-[#10B981]/15 text-[#10B981]'
                            : 'opacity-50'
                        }`}
                      >
                        {comparison.appB.app.isRunning ? 'Running' : 'Stopped'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      onInspectApp(comparison.appB.app);
                    }}
                    className="mt-4 w-full py-2 rounded-2xl bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 text-[#8B5CF6] text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>Inspect {comparison.appB.app.displayName}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-black/[0.05] dark:border-white/[0.06] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className={`px-5 py-2.5 rounded-full text-xs font-bold border transition-colors ${
              isDarkMode
                ? 'bg-[#1C1D22] border-white/[0.08] hover:bg-white/[0.06] text-slate-300'
                : 'bg-white border-black/[0.08] hover:bg-slate-50 text-slate-700'
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
