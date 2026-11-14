import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  FolderOpen,
  PieChart,
  Search,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Layers,
  ArrowUpRight,
  Gauge,
  RotateCw,
  Activity,
  Zap,
} from 'lucide-react';
import { DriveInfo, DiskHardwareInfo, DiskBenchmarkResult } from '../../types';
import { formatBytes } from '../../utils/formatters';
import { ApiService } from '../../services/api';

interface DrivesViewProps {
  drives: DriveInfo[];
  onOpenDrive: (drivePath: string) => void;
  onScanDrive: (drivePath: string) => void;
  onSearchDrive: (drivePath: string) => void;
  isDarkMode: boolean;
}

export const DrivesView: React.FC<DrivesViewProps> = ({
  drives,
  onOpenDrive,
  onScanDrive,
  onSearchDrive,
  isDarkMode,
}) => {
  const [hardwareDisks, setHardwareDisks] = useState<DiskHardwareInfo[]>([]);
  const [benchmarkResults, setBenchmarkResults] = useState<Record<string, DiskBenchmarkResult>>({});
  const [benchmarkingDrive, setBenchmarkingDrive] = useState<string | null>(null);

  useEffect(() => {
    loadHardwareInfo();
  }, []);

  const loadHardwareInfo = async () => {
    try {
      const data = await ApiService.getDisksHardwareInfo();
      setHardwareDisks(data.disks || []);
    } catch {}
  };

  const handleRunBenchmark = async (driveId: string) => {
    setBenchmarkingDrive(driveId);
    try {
      const result = await ApiService.benchmarkDrive(driveId.endsWith('\\') ? driveId : driveId + '\\');
      setBenchmarkResults((prev) => ({ ...prev, [driveId]: result }));
    } catch (err: any) {
      alert(`Benchmark failed: ${err.message}`);
    } finally {
      setBenchmarkingDrive(null);
    }
  };

  const totalSystemBytes = drives.reduce((acc, d) => acc + d.totalBytes, 0);
  const totalUsedBytes = drives.reduce((acc, d) => acc + d.usedBytes, 0);
  const totalFreeBytes = drives.reduce((acc, d) => acc + d.freeBytes, 0);
  const overallPercent = totalSystemBytes > 0 ? Math.round((totalUsedBytes / totalSystemBytes) * 100) : 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full select-none custom-scrollbar">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-1">Drive & Storage Manager</h1>
          <p className="text-sm opacity-70">
            Manage physical and logical volumes, inspect hardware health, and execute safe non-destructive read benchmarks.
          </p>
        </div>

        <button
          onClick={loadHardwareInfo}
          className={`p-2.5 rounded-full transition-all border ${
            isDarkMode
              ? 'bg-white/[0.06] hover:bg-white/[0.1] text-white border-white/[0.06]'
              : 'bg-white hover:bg-slate-50 text-slate-700 border-black/[0.05] shadow-xs'
          }`}
          title="Refresh hardware status"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Aggregate Storage Hero Card */}
      <div
        className={`p-6 rounded-3xl border transition-all ${
          isDarkMode
            ? 'bg-[#1C1D22] border-white/[0.06] shadow-sm'
            : 'bg-white border-black/[0.05] shadow-xs'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wider font-bold text-[#0072DE]">Total Storage Pool</span>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-extrabold">{formatBytes(totalUsedBytes)}</span>
              <span className="opacity-60 text-sm">used of {formatBytes(totalSystemBytes)}</span>
            </div>
            <p className="text-xs opacity-70">
              {drives.length} active volume{drives.length !== 1 ? 's' : ''} mounted • {formatBytes(totalFreeBytes)} available
            </p>
          </div>

          {/* Usage Progress Gauge */}
          <div className="w-full md:w-80 space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="opacity-70">Overall Disk Allocation</span>
              <span className={overallPercent >= 90 ? 'text-red-500 font-bold' : overallPercent >= 75 ? 'text-amber-500' : 'text-[#0072DE]'}>
                {overallPercent}%
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-black/10 dark:bg-white/[0.06] overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  overallPercent >= 90 ? 'bg-red-500' : overallPercent >= 75 ? 'bg-amber-500' : 'bg-[#0072DE]'
                }`}
                style={{ width: `${overallPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Individual Volume Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {drives.map((drive) => {
          const isFull = drive.usagePercent >= 90;
          const isWarning = drive.usagePercent >= 75 && !isFull;
          const bench = benchmarkResults[drive.deviceId];
          const isBenchmarking = benchmarkingDrive === drive.deviceId;

          // Match hardware info if available
          const hw = hardwareDisks.find((h) => h.deviceId.toLowerCase().includes(drive.deviceId.toLowerCase())) || hardwareDisks[0];

          return (
            <div
              key={drive.deviceId}
              className={`p-6 rounded-3xl border flex flex-col justify-between transition-all hover:shadow-md ${
                isDarkMode
                  ? 'bg-[#1C1D22] border-white/[0.06] hover:border-white/[0.12]'
                  : 'bg-white border-black/[0.06] hover:border-black/[0.12] shadow-xs'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                        isFull
                          ? 'bg-red-500/10 text-red-500'
                          : isWarning
                          ? 'bg-amber-500/10 text-amber-500'
                          : 'bg-[#0072DE]/10 text-[#0072DE]'
                      }`}
                    >
                      <HardDrive className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold">
                          {drive.volumeName || 'Local Disk'} ({drive.deviceId})
                        </h3>
                        {drive.health === 'healthy' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Healthy
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Warning
                          </span>
                        )}
                      </div>
                      <p className="text-xs opacity-60 mt-0.5 font-mono">
                        {drive.fileSystem} • {drive.driveType === 3 ? 'Fixed Internal' : drive.driveType === 2 ? 'Removable' : 'Storage Volume'}
                        {hw && ` • ${hw.mediaType}`}
                      </p>
                    </div>
                  </div>

                  <span className="text-2xl font-extrabold font-mono text-[#0072DE]">
                    {drive.usagePercent}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="w-full h-2.5 rounded-full bg-black/10 dark:bg-white/[0.06] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isFull ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-[#0072DE]'
                      }`}
                      style={{ width: `${drive.usagePercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs opacity-70 font-mono">
                    <span>{formatBytes(drive.usedBytes)} used</span>
                    <span>{formatBytes(drive.freeBytes)} free of {formatBytes(drive.totalBytes)}</span>
                  </div>
                </div>

                {/* Physical Hardware Specs */}
                {hw && (
                  <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] grid grid-cols-2 gap-2 text-xs font-mono">
                    <div>
                      <span className="text-[10px] uppercase font-bold opacity-40 block">Drive Model</span>
                      <span className="font-semibold truncate block" title={hw.model}>{hw.model}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold opacity-40 block">Interface</span>
                      <span className="font-semibold">{hw.interfaceType}</span>
                    </div>
                  </div>
                )}

                {/* Benchmark Output Card */}
                {bench && (
                  <div className="p-3.5 rounded-2xl bg-[#0072DE]/10 border border-[#0072DE]/20 flex items-center justify-between text-xs animate-oneui-fade">
                    <div className="flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-[#0072DE]" />
                      <div>
                        <span className="font-bold block text-[#0072DE]">Read Throughput: {bench.formattedSpeed}</span>
                        <span className="text-[10px] opacity-60 block font-mono">Latency: {bench.latencyMs}ms • Duration: {bench.testDurationMs}ms</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono opacity-50">{bench.formattedBytesRead} tested</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-4 gap-2 pt-4 mt-4 border-t border-black/[0.05] dark:border-white/[0.06]">
                <button
                  onClick={() => onOpenDrive(drive.deviceId.endsWith('\\') ? drive.deviceId : drive.deviceId + '\\')}
                  className="py-2 px-2.5 rounded-full text-xs font-bold bg-[#0072DE] hover:bg-[#005bb5] text-white flex items-center justify-center gap-1.5 transition-all shadow-xs"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Browse</span>
                </button>

                <button
                  onClick={() => onScanDrive(drive.deviceId.endsWith('\\') ? drive.deviceId : drive.deviceId + '\\')}
                  className="py-2 px-2.5 rounded-full text-xs font-bold bg-black/5 dark:bg-white/[0.06] hover:bg-black/10 dark:hover:bg-white/[0.1] text-inherit flex items-center justify-center gap-1.5 transition-all"
                >
                  <PieChart className="w-3.5 h-3.5 text-[#0072DE]" />
                  <span>X-Ray</span>
                </button>

                <button
                  onClick={() => onSearchDrive(drive.deviceId.endsWith('\\') ? drive.deviceId : drive.deviceId + '\\')}
                  className="py-2 px-2.5 rounded-full text-xs font-bold bg-black/5 dark:bg-white/[0.06] hover:bg-black/10 dark:hover:bg-white/[0.1] text-inherit flex items-center justify-center gap-1.5 transition-all"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Search</span>
                </button>

                <button
                  onClick={() => handleRunBenchmark(drive.deviceId)}
                  disabled={isBenchmarking}
                  className="py-2 px-2.5 rounded-full text-xs font-bold bg-black/5 dark:bg-white/[0.06] hover:bg-black/10 dark:hover:bg-white/[0.1] text-inherit flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                  title="Run safe non-destructive read benchmark"
                >
                  {isBenchmarking ? (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  ) : (
                    <Gauge className="w-3.5 h-3.5 text-emerald-500" />
                  )}
                  <span>{isBenchmarking ? 'Testing...' : 'Benchmark'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
