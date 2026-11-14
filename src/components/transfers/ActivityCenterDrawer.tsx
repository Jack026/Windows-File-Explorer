import React, { useState, useEffect } from 'react';
import {
  Activity,
  X,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  FileCode,
  FolderSync,
  AlertCircle,
} from 'lucide-react';
import { TransferTask } from '../../types';
import { ApiService } from '../../services/api';
import { formatBytes } from '../../utils/formatters';

interface ActivityCenterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

export const ActivityCenterDrawer: React.FC<ActivityCenterDrawerProps> = ({
  isOpen,
  onClose,
  isDarkMode,
}) => {
  const [tasks, setTasks] = useState<TransferTask[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchTasks = () => {
      ApiService.getTransfers().then((t) => setTasks(t));
    };

    fetchTasks();
    const interval = setInterval(fetchTasks, 1500);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCancel = async (id: string) => {
    await ApiService.cancelTransfer(id);
    const updated = await ApiService.getTransfers();
    setTasks(updated);
  };

  const handleClear = async () => {
    await ApiService.clearTransfers();
    setTasks([]);
  };

  const activeCount = tasks.filter((t) => t.status === 'running').length;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 max-w-full shadow-2xl flex flex-col border-l transition-all animate-in slide-in-from-right duration-200">
      <div
        className={`flex-1 flex flex-col h-full ${
          isDarkMode
            ? 'bg-[#14161C] border-white/[0.08] text-[#E3E2E6]'
            : 'bg-white border-black/[0.08] text-slate-800'
        }`}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-inherit">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#0072DE]/10 text-[#0072DE] flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Activity Center</h2>
              <p className="text-[11px] text-slate-400">
                {activeCount > 0 ? `${activeCount} operation${activeCount > 1 ? 's' : ''} in progress` : 'All operations complete'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {tasks.length > 0 && (
              <button
                onClick={handleClear}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-inherit transition-colors"
                title="Clear Finished"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-inherit transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tasks.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <FolderSync className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No active file transfers or operations</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className={`p-3.5 rounded-2xl border transition-all text-xs space-y-2 ${
                  isDarkMode ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-black/[0.02] border-black/[0.06]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold capitalize flex items-center gap-1.5">
                    {task.status === 'running' && (
                      <span className="w-2 h-2 rounded-full bg-[#0072DE] animate-ping" />
                    )}
                    {task.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    {task.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                    {task.status === 'cancelled' && <AlertCircle className="w-3.5 h-3.5 text-amber-400" />}
                    {task.title}
                  </span>

                  {task.status === 'running' && (
                    <button
                      onClick={() => handleCancel(task.id)}
                      className="text-[11px] text-red-400 hover:underline"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {task.sourcePath && (
                  <p className="text-[10px] text-slate-400 font-mono truncate" title={task.sourcePath}>
                    {task.sourcePath}
                  </p>
                )}

                {task.status === 'running' && (
                  <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-[#0072DE] animate-pulse w-3/4" />
                  </div>
                )}

                <div className="flex justify-between text-[10px] text-slate-400">
                  <span className="capitalize">{task.status}</span>
                  <span>{Math.round((task.elapsedMs || 0) / 1000)}s elapsed</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
