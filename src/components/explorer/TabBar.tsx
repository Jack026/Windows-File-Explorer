import React from 'react';
import { Folder, X, Plus } from 'lucide-react';
import { ExplorerTab } from '../../types';

interface TabBarProps {
  tabs: ExplorerTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: (initialPath?: string) => void;
  isDarkMode: boolean;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  isDarkMode,
}) => {
  return (
    <div
      className={`h-10 px-2 flex items-center gap-1 select-none border-b overflow-x-auto no-scrollbar transition-colors ${
        isDarkMode
          ? 'bg-[#0E1015] border-white/[0.04]'
          : 'bg-[#ECEEF2] border-black/[0.05]'
      }`}
    >
      <div className="flex items-center gap-1 flex-1 min-w-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`group relative flex items-center gap-2 h-8 px-3 rounded-full text-xs font-medium cursor-pointer transition-all max-w-[200px] shrink-0 border ${
                isActive
                  ? isDarkMode
                    ? 'bg-[#1C1F26] text-white border-white/[0.08] shadow-sm'
                    : 'bg-white text-slate-900 border-black/[0.08] shadow-xs'
                  : isDarkMode
                  ? 'bg-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 border-transparent'
                  : 'bg-transparent text-slate-600 hover:bg-black/[0.04] hover:text-slate-900 border-transparent'
              }`}
            >
              <Folder className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#0072DE]' : 'text-slate-400'}`} />
              <span className="truncate flex-1" title={tab.path}>
                {tab.title || 'Local Disk'}
              </span>

              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className={`p-0.5 rounded-full hover:bg-red-500/20 hover:text-red-400 transition-colors ${
                    isActive ? 'opacity-80' : 'opacity-0 group-hover:opacity-80'
                  }`}
                  title="Close Tab (Ctrl + W)"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        <button
          onClick={() => onNewTab()}
          className={`p-1.5 rounded-full transition-colors shrink-0 ${
            isDarkMode
              ? 'hover:bg-white/[0.08] text-slate-400 hover:text-white'
              : 'hover:bg-black/[0.06] text-slate-600 hover:text-black'
          }`}
          title="New Tab (Ctrl + T)"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
