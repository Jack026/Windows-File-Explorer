import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  FileText,
  Folder,
  Download,
  RotateCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  ExternalLink,
} from 'lucide-react';
import { PermissionReport } from '../../types';
import { ApiService } from '../../services/api';

interface PermissionsViewProps {
  initialPath: string;
  isDarkMode: boolean;
  onNavigate?: (path: string) => void;
}

export const PermissionsView: React.FC<PermissionsViewProps> = ({
  initialPath,
  isDarkMode,
  onNavigate,
}) => {
  const [targetPath, setTargetPath] = useState(initialPath || 'C:\\');
  const [inputPath, setInputPath] = useState(initialPath || 'C:\\');
  const [report, setReport] = useState<PermissionReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');

  useEffect(() => {
    inspectPath(targetPath);
  }, [targetPath]);

  const inspectPath = async (path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await ApiService.getPermissions(path);
      setReport(data);
      setTargetPath(path);
      setInputPath(path);
    } catch (err: any) {
      setError(err.message || 'Failed to inspect file permissions');
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    if (!report) return;
    try {
      const content = await ApiService.exportPermissions(report.path, format);
      const mime = format === 'json' ? 'application/json' : 'text/csv';
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `permissions-${report.name}-${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const filteredRules = (report?.accessRules || []).filter((rule) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      rule.identity.toLowerCase().includes(q) ||
      rule.fileSystemRights.toLowerCase().includes(q) ||
      rule.accessControlType.toLowerCase().includes(q)
    );
  });

  return (
    <div
      className={`flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar select-none transition-colors ${
        isDarkMode ? 'bg-[#121316] text-[#E3E2E6]' : 'bg-[#F4F5F8] text-[#191C1E]'
      }`}
    >
      <div className="max-w-6xl mx-auto space-y-6 animate-oneui-fade">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Permissions & Access Analyzer</h1>
            <p className="mt-1 text-sm opacity-70">
              Inspect Windows security principals, Access Control Lists (ACLs), ownership, and inheritance.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('csv')}
              disabled={!report}
              className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
                isDarkMode
                  ? 'bg-white/[0.06] hover:bg-white/[0.1] text-white border-white/[0.06]'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-black/[0.05] shadow-xs'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => handleExport('json')}
              disabled={!report}
              className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
                isDarkMode
                  ? 'bg-white/[0.06] hover:bg-white/[0.1] text-white border-white/[0.06]'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-black/[0.05] shadow-xs'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={() => inspectPath(targetPath)}
              className={`p-2 rounded-full transition-all border ${
                isDarkMode
                  ? 'bg-white/[0.06] hover:bg-white/[0.1] text-white border-white/[0.06]'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-black/[0.05] shadow-xs'
              }`}
              title="Refresh permissions"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Path Input Toolbar */}
        <div
          className={`p-4 rounded-3xl border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 ${
            isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
          }`}
        >
          <div className="flex-1 flex items-center gap-2">
            <Search className="w-4 h-4 opacity-50 shrink-0" />
            <input
              type="text"
              value={inputPath}
              onChange={(e) => setInputPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && inspectPath(inputPath)}
              placeholder="Enter file or folder path (e.g. C:\Windows, C:\Users)..."
              className="flex-1 bg-transparent text-xs font-mono outline-none"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => inspectPath(inputPath)}
              className="px-5 py-2 rounded-full bg-[#0072DE] text-white text-xs font-bold hover:bg-[#005bb5] transition-all flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Inspect</span>
            </button>
          </div>
        </div>

        {/* Quick Location Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs opacity-50 font-bold shrink-0">Quick inspect:</span>
          {['C:\\', 'C:\\Windows', 'C:\\Program Files', 'C:\\Users'].map((quick) => (
            <button
              key={quick}
              onClick={() => inspectPath(quick)}
              className={`px-3 py-1 rounded-full text-xs font-mono transition-all border ${
                targetPath === quick
                  ? 'bg-[#0072DE] text-white border-[#0072DE]'
                  : isDarkMode
                  ? 'bg-white/[0.04] text-slate-300 border-white/[0.06] hover:bg-white/[0.08]'
                  : 'bg-white text-slate-700 border-black/[0.05] hover:bg-slate-100 shadow-xs'
              }`}
            >
              {quick}
            </button>
          ))}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="text-xs font-semibold">{error}</span>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="py-20 text-center">
            <div className="w-8 h-8 rounded-full border-2 border-[#0072DE]/20 border-t-[#0072DE] animate-spin mx-auto mb-2" />
            <span className="text-xs opacity-60">Reading Windows Access Control Lists via Win32...</span>
          </div>
        )}

        {/* Content */}
        {!isLoading && report && (
          <div className="space-y-6">
            {/* Overview Security Card */}
            <div
              className={`p-6 rounded-3xl border space-y-4 ${
                isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-black/[0.05] dark:border-white/[0.06]">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#0072DE]/15 text-[#0072DE] flex items-center justify-center shrink-0">
                    {report.isDirectory ? <Folder className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold truncate">{report.name}</h2>
                    <span className="text-xs font-mono opacity-50 truncate block mt-0.5" title={report.path}>
                      {report.path}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                      report.canWrite
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : 'bg-amber-500/15 text-amber-500'
                    }`}
                  >
                    {report.canWrite ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    <span>{report.canWrite ? 'Read & Write' : 'Read Only'}</span>
                  </span>

                  {report.isSystem && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-500">
                      System Protected
                    </span>
                  )}

                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-black/5 dark:bg-white/10 opacity-70">
                    {report.areAccessRulesProtected ? 'Inheritance Disabled' : 'Inherited Rules'}
                  </span>
                </div>
              </div>

              {/* Security Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04]">
                  <span className="text-[10px] uppercase font-bold opacity-50 block mb-1">Owner</span>
                  <span className="font-bold font-mono text-sm block truncate" title={report.owner}>
                    {report.owner}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04]">
                  <span className="text-[10px] uppercase font-bold opacity-50 block mb-1">Primary Group</span>
                  <span className="font-bold font-mono text-sm block truncate" title={report.group}>
                    {report.group}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04]">
                  <span className="text-[10px] uppercase font-bold opacity-50 block mb-1">Accessibility</span>
                  <div className="flex items-center gap-2 font-mono text-xs font-bold">
                    <span className={report.canRead ? 'text-emerald-500' : 'text-red-500'}>
                      R: {report.canRead ? 'Yes' : 'No'}
                    </span>
                    <span>•</span>
                    <span className={report.canWrite ? 'text-emerald-500' : 'text-amber-500'}>
                      W: {report.canWrite ? 'Yes' : 'No'}
                    </span>
                    <span>•</span>
                    <span className={report.canExecute ? 'text-blue-500' : 'opacity-40'}>
                      X: {report.canExecute ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs opacity-70 pt-1 leading-relaxed">
                <strong>Analysis: </strong>{report.summary}
              </p>
            </div>

            {/* Access Control List (ACL) Section */}
            <div
              className={`p-6 rounded-3xl border space-y-4 ${
                isDarkMode ? 'bg-[#1C1D22] border-white/[0.06]' : 'bg-white border-black/[0.05] shadow-xs'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#0072DE]" />
                  <h3 className="font-bold text-base">Security Principals & Access Rules ({report.accessRules.length})</h3>
                </div>

                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filter rules by principal..."
                  className="px-3 py-1.5 rounded-full border border-black/10 dark:border-white/10 bg-transparent text-xs outline-none"
                />
              </div>

              {filteredRules.length === 0 ? (
                <div className="py-8 text-center text-xs opacity-50">
                  No access control rules matched your query.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredRules.map((rule, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                        isDarkMode ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50/50 border-black/[0.03]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs truncate">{rule.identity}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              rule.accessControlType === 'Allow'
                                ? 'bg-emerald-500/15 text-emerald-500'
                                : 'bg-rose-500/15 text-rose-500'
                            }`}
                          >
                            {rule.accessControlType}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 opacity-70">
                            {rule.isInherited ? 'Inherited' : 'Explicit'}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono opacity-60 block mt-1">
                          Rights: {rule.fileSystemRights}
                        </span>
                      </div>

                      <div className="text-left sm:text-right shrink-0 text-[10px] font-mono opacity-50">
                        <span>Inheritance: {rule.inheritanceFlags}</span>
                        <span className="block">Propagation: {rule.propagationFlags}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
