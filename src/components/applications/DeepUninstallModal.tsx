import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Layers,
  ArrowRight,
  HardDrive,
  FileCheck,
  RotateCw,
  Folder,
  File,
} from 'lucide-react';
import {
  InstalledApp,
  UninstallPlan,
  LeftoverCandidate,
  UninstallVerificationReport,
} from '../../types';
import { formatBytes } from '../../utils/formatters';
import { ApiService } from '../../services/api';

interface DeepUninstallModalProps {
  app: InstalledApp | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isDarkMode: boolean;
}

type UninstallStep = 'review' | 'uninstalling' | 'leftovers' | 'cleaning' | 'report';

export const DeepUninstallModal: React.FC<DeepUninstallModalProps> = ({
  app,
  isOpen,
  onClose,
  onSuccess,
  isDarkMode,
}) => {
  const [step, setStep] = useState<UninstallStep>('review');
  const [plan, setPlan] = useState<UninstallPlan | null>(null);
  const [leftovers, setLeftovers] = useState<LeftoverCandidate[]>([]);
  const [report, setReport] = useState<UninstallVerificationReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (isOpen && app) {
      setStep('review');
      setIsLoading(true);
      setStatusMessage('Analyzing application storage footprint...');
      ApiService.prepareUninstall(app.id)
        .then((p) => {
          setPlan(p);
        })
        .catch((err) => {
          console.error('Failed to prepare uninstall plan:', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, app]);

  if (!isOpen || !app) return null;

  const handleStartOfficialUninstall = async () => {
    setStep('uninstalling');
    setIsLoading(true);
    setStatusMessage('Executing official uninstaller. Please complete any uninstaller dialogs...');

    try {
      const res = await ApiService.executeUninstall(app.id, false);
      // Wait slightly then scan for leftovers
      setStatusMessage('Scanning filesystem and registry for remaining leftovers...');
      const prePaths = plan?.leftoverCandidates.map((c) => c.path) || [];
      const leftData = await ApiService.scanLeftovers(app.id, prePaths);
      setLeftovers(leftData.leftovers || []);
      setStep('leftovers');
    } catch (err: any) {
      console.error('Error during uninstall:', err);
      // Even if official uninstaller exits, proceed to scan leftovers
      const prePaths = plan?.leftoverCandidates.map((c) => c.path) || [];
      const leftData = await ApiService.scanLeftovers(app.id, prePaths).catch(() => ({ leftovers: [] }));
      setLeftovers(leftData.leftovers || []);
      setStep('leftovers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleLeftover = (id: string) => {
    setLeftovers((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleCleanLeftovers = async () => {
    setStep('cleaning');
    setIsLoading(true);
    setStatusMessage('Moving approved leftovers to Windows Recycle Bin...');

    try {
      const rep = await ApiService.cleanLeftovers(leftovers);
      setReport(rep);
      setStep('report');
      onSuccess();
    } catch (err: any) {
      console.error('Cleanup error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedLeftoverBytes = leftovers
    .filter((l) => l.selected)
    .reduce((acc, curr) => acc + curr.size, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-oneui-fade">
      <div
        className={`w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-colors ${
          isDarkMode ? 'bg-[#1C1D22] border-white/[0.08] text-[#E3E2E6]' : 'bg-white border-black/[0.08] text-[#191C1E]'
        }`}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/15 text-red-500 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">
                {step === 'review'
                  ? 'Deep Uninstall'
                  : step === 'uninstalling'
                  ? 'Running Official Uninstaller'
                  : step === 'leftovers'
                  ? 'Review Remaining Leftovers'
                  : step === 'cleaning'
                  ? 'Cleaning Leftovers'
                  : 'Uninstall Complete'}
              </h2>
              <p className="text-xs opacity-60 truncate max-w-sm">{app.displayName}</p>
            </div>
          </div>

          {step !== 'uninstalling' && step !== 'cleaning' && (
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full border-3 border-[#0072DE]/20 border-t-[#0072DE] animate-spin mb-4" />
              <span className="text-base font-bold">{statusMessage}</span>
            </div>
          ) : step === 'review' && plan ? (
            <div className="space-y-4">
              {/* Footprint Summary Card */}
              <div className="p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold opacity-60 block">Measured Total Footprint</span>
                  <span className="text-xl font-extrabold font-mono text-[#0072DE] dark:text-[#5B95FF]">
                    {plan.preUninstallBreakdown.formattedTotalMeasuredFootprint}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold opacity-60 block">Discovered Items</span>
                  <span className="text-sm font-bold font-mono">
                    {plan.leftoverCandidates.length} locations
                  </span>
                </div>
              </div>

              {/* Proposed Removal Inventory */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider opacity-60 block mb-2">
                  Proposed Removal Inventory
                </span>
                <div className="max-h-48 overflow-y-auto custom-scrollbar rounded-2xl border divide-y border-black/[0.06] dark:border-white/[0.06]">
                  {plan.leftoverCandidates.map((cand) => (
                    <div key={cand.id} className="p-3 flex items-center justify-between text-xs">
                      <div className="truncate min-w-0 flex-1 pr-3">
                        <span className="font-bold block truncate">{cand.name}</span>
                        <span className="text-[10px] opacity-50 font-mono truncate block">{cand.path}</span>
                      </div>
                      <span className="font-mono font-bold shrink-0">{cand.formattedSize}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Associated Services & Scheduled Tasks if any */}
              {((plan.associatedServices && plan.associatedServices.length > 0) ||
                (plan.associatedTasks && plan.associatedTasks.length > 0)) && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500 space-y-1">
                  <span className="font-bold block">Associated Windows Services & Scheduled Tasks</span>
                  {plan.associatedServices.map((s) => (
                    <span key={s} className="block font-mono text-[11px]">
                      • Service: {s}
                    </span>
                  ))}
                  {plan.associatedTasks.map((t) => (
                    <span key={t} className="block font-mono text-[11px]">
                      • Scheduled Task: {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Notice */}
              <div className="p-3.5 rounded-2xl bg-[#0072DE]/10 border border-[#0072DE]/20 text-xs text-[#0072DE] dark:text-[#5B95FF] flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Safety Protected & Non-Destructive</span>
                  <span>
                    The official registered uninstaller runs first. Remaining approved leftovers move safely to the Windows Recycle Bin, and registry keys are backed up to .reg files before modification.
                  </span>
                </div>
              </div>
            </div>
          ) : step === 'leftovers' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider opacity-60 block">
                    Remaining Leftover Files
                  </span>
                  <span className="text-xs opacity-70">
                    Select items to move to Windows Recycle Bin. Shared items and user data are protected by default.
                  </span>
                </div>
                <span className="text-xs font-bold font-mono text-[#0072DE]">
                  Selected: {formatBytes(selectedLeftoverBytes)}
                </span>
              </div>

              {leftovers.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle2 className="w-10 h-10 text-[#10B981] mx-auto mb-2" />
                  <span className="text-sm font-bold block">No leftovers detected!</span>
                  <span className="text-xs opacity-60">The official uninstaller removed all associated files.</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {leftovers.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleToggleLeftover(item.id)}
                      className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                        item.selected
                          ? 'border-[#0072DE] bg-[#0072DE]/5'
                          : isDarkMode
                          ? 'border-white/[0.06] bg-white/[0.02]'
                          : 'border-black/[0.05] bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => handleToggleLeftover(item.id)}
                          className="w-4 h-4 accent-[#0072DE] rounded"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="truncate">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold truncate block">{item.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 font-medium">
                              {item.categoryLabel}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono opacity-50 truncate block" title={item.path}>
                            {item.path}
                          </span>
                        </div>
                      </div>

                      <span className="text-xs font-mono font-bold shrink-0">{item.formattedSize}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : step === 'report' && report ? (
            <div className="space-y-4 py-4 text-center">
              <div className="w-16 h-16 rounded-full bg-[#10B981]/15 text-[#10B981] flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-extrabold tracking-tight">Uninstallation Complete</h3>
              <p className="text-sm opacity-70 max-w-md mx-auto">{report.summary}</p>

              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto text-left pt-3">
                <div className="p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04]">
                  <span className="text-[10px] uppercase font-bold opacity-60 block">Space Reclaimed</span>
                  <span className="text-base font-extrabold font-mono text-[#10B981]">
                    {report.formattedReclaimedBytes}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04]">
                  <span className="text-[10px] uppercase font-bold opacity-60 block">Protected Items</span>
                  <span className="text-base font-extrabold font-mono">
                    {report.retainedSharedCount} retained
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-end gap-3">
          {step === 'review' ? (
            <>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-full text-xs font-bold opacity-70 hover:opacity-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartOfficialUninstall}
                className="px-6 py-2.5 rounded-full bg-[#0072DE] hover:bg-[#005fb8] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
              >
                <span>Proceed to Uninstall</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          ) : step === 'leftovers' ? (
            <>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-full text-xs font-bold opacity-70 hover:opacity-100 transition-colors"
              >
                Skip Leftovers
              </button>
              <button
                onClick={handleCleanLeftovers}
                disabled={leftovers.filter((l) => l.selected).length === 0}
                className="px-6 py-2.5 rounded-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clean Selected Leftovers ({formatBytes(selectedLeftoverBytes)})</span>
              </button>
            </>
          ) : step === 'report' ? (
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-full bg-[#0072DE] text-white text-xs font-bold transition-all shadow-xs"
            >
              Done
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
