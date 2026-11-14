import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Folder,
  HardDrive,
  Calendar,
  Lock,
  Hash,
  Copy,
  Check,
  Shield,
  Layers,
} from 'lucide-react';
import { FileItem, DetailedFileProperties } from '../../types';
import { ApiService } from '../../services/api';

interface FilePropertiesModalProps {
  item: FileItem | null;
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

export const FilePropertiesModal: React.FC<FilePropertiesModalProps> = ({
  item,
  isOpen,
  onClose,
  isDarkMode,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'attributes' | 'checksum'>('general');
  const [propsData, setPropsData] = useState<DetailedFileProperties | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [isSavingAttributes, setIsSavingAttributes] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !item) {
      setPropsData(null);
      return;
    }

    setIsLoading(true);
    ApiService.getFileProperties(item.path, true)
      .then((data) => {
        setPropsData(data);
        setReadOnly(data.attributes.readOnly);
        setHidden(data.attributes.hidden);
      })
      .catch((err) => {
        console.error('Failed to fetch file properties:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const handleApplyAttributes = async () => {
    setIsSavingAttributes(true);
    try {
      await ApiService.setAttributes(item.path, { readOnly, hidden });
      const refreshed = await ApiService.getFileProperties(item.path, false);
      setPropsData(refreshed);
    } catch (err) {
      console.error('Failed to set attributes:', err);
    } finally {
      setIsSavingAttributes(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(label);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`w-full max-w-lg rounded-3xl shadow-2xl border flex flex-col overflow-hidden transition-all ${
          isDarkMode
            ? 'bg-[#16181D] border-white/[0.08] text-[#E3E2E6]'
            : 'bg-white border-black/[0.08] text-slate-800'
        }`}
      >
        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b border-inherit">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#0072DE]/10 text-[#0072DE] flex items-center justify-center shrink-0">
              {item.isDirectory ? <Folder className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold truncate">{item.name}</h2>
              <p className="text-xs text-slate-400 truncate">{propsData?.directory || item.path}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab navigation in One UI Pill Style */}
        <div className="flex items-center gap-2 px-5 pt-3 pb-2">
          {(['general', 'attributes', 'checksum'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${
                activeTab === tab
                  ? 'bg-[#0072DE] text-white shadow-xs'
                  : isDarkMode
                  ? 'bg-white/[0.05] text-slate-400 hover:text-white hover:bg-white/[0.08]'
                  : 'bg-black/[0.04] text-slate-600 hover:text-black hover:bg-black/[0.08]'
              }`}
            >
              {tab === 'checksum' ? 'Checksums' : tab}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto max-h-[60vh] text-xs space-y-4">
          {isLoading && !propsData ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <div className="w-6 h-6 border-2 border-[#0072DE] border-t-transparent rounded-full animate-spin mb-2" />
              <p>Reading Win32 file metadata...</p>
            </div>
          ) : activeTab === 'general' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 py-2 border-b border-inherit">
                <span className="text-slate-400">Type</span>
                <span className="col-span-2 font-medium">
                  {item.isDirectory ? 'File Folder' : `${item.extension.toUpperCase() || 'File'} Document`}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-2 border-b border-inherit">
                <span className="text-slate-400">Location</span>
                <span className="col-span-2 font-mono break-all">{propsData?.directory || item.path}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-2 border-b border-inherit">
                <span className="text-slate-400">Size</span>
                <span className="col-span-2 font-medium">
                  {propsData?.formattedSize || item.formattedSize || '0 B'}{' '}
                  <span className="text-slate-400 text-[10px]">
                    ({(propsData?.sizeBytes || item.size || 0).toLocaleString()} bytes)
                  </span>
                </span>
              </div>
              {!item.isDirectory && (
                <div className="grid grid-cols-3 gap-2 py-2 border-b border-inherit">
                  <span className="text-slate-400">Size on disk</span>
                  <span className="col-span-2 font-medium">
                    {propsData?.formattedSizeOnDisk || '0 B'}{' '}
                    <span className="text-slate-400 text-[10px]">
                      ({(propsData?.sizeOnDiskBytes || 0).toLocaleString()} bytes)
                    </span>
                  </span>
                </div>
              )}
              {item.isDirectory && (
                <div className="grid grid-cols-3 gap-2 py-2 border-b border-inherit">
                  <span className="text-slate-400">Contains</span>
                  <span className="col-span-2 font-medium">
                    {propsData?.fileCount || 0} Files, {propsData?.folderCount || 0} Folders
                  </span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 py-2 border-b border-inherit">
                <span className="text-slate-400">Created</span>
                <span className="col-span-2">
                  {propsData?.createdAt ? new Date(propsData.createdAt).toLocaleString() : 'N/A'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-2 border-b border-inherit">
                <span className="text-slate-400">Modified</span>
                <span className="col-span-2">
                  {propsData?.modifiedAt ? new Date(propsData.modifiedAt).toLocaleString() : 'N/A'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-2">
                <span className="text-slate-400">Accessed</span>
                <span className="col-span-2">
                  {propsData?.accessedAt ? new Date(propsData.accessedAt).toLocaleString() : 'N/A'}
                </span>
              </div>
            </div>
          ) : activeTab === 'attributes' ? (
            <div className="space-y-4">
              <p className="text-slate-400 leading-relaxed">
                Win32 File System attributes flags stored in the file table:
              </p>

              <div className="space-y-3 p-4 rounded-2xl bg-black/5 dark:bg-white/[0.03]">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={readOnly}
                    onChange={(e) => setReadOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0072DE] focus:ring-0"
                  />
                  <div>
                    <p className="font-medium">Read-only</p>
                    <p className="text-[11px] text-slate-400">Prevents modifying or overwriting file contents</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hidden}
                    onChange={(e) => setHidden(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0072DE] focus:ring-0"
                  />
                  <div>
                    <p className="font-medium">Hidden</p>
                    <p className="text-[11px] text-slate-400">Hides item from default Windows directory views</p>
                  </div>
                </label>
              </div>

              <div className="p-3 rounded-2xl border border-inherit text-[11px] space-y-1.5 text-slate-400">
                <p>System attribute: <span className="font-semibold text-slate-300">{propsData?.attributes.system ? 'True' : 'False'}</span></p>
                <p>Archive attribute: <span className="font-semibold text-slate-300">{propsData?.attributes.archive ? 'True' : 'False'}</span></p>
              </div>

              <button
                onClick={handleApplyAttributes}
                disabled={isSavingAttributes}
                className="w-full py-2.5 rounded-full bg-[#0072DE] hover:bg-[#0060BA] text-white font-medium transition-colors disabled:opacity-50"
              >
                {isSavingAttributes ? 'Applying Attributes...' : 'Apply Attribute Changes'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-slate-400 leading-relaxed">
                Cryptographic checksums generated on actual file contents:
              </p>

              {propsData?.checksums ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/[0.03]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-400">SHA-256 (Secure)</span>
                      <button
                        onClick={() => copyToClipboard(propsData.checksums?.sha256 || '', 'sha256')}
                        className="text-[#0072DE] hover:underline flex items-center gap-1"
                      >
                        {copiedHash === 'sha256' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedHash === 'sha256' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="font-mono text-[10px] break-all select-all text-slate-300">
                      {propsData.checksums.sha256}
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/[0.03]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-400">MD5 (Legacy)</span>
                      <button
                        onClick={() => copyToClipboard(propsData.checksums?.md5 || '', 'md5')}
                        className="text-[#0072DE] hover:underline flex items-center gap-1"
                      >
                        {copiedHash === 'md5' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedHash === 'md5' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="font-mono text-[10px] break-all select-all text-slate-300">
                      {propsData.checksums.md5}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400">
                  <p>Checksums are only calculated for individual files under 50 MB.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-inherit flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full text-xs font-medium bg-[#0072DE] text-white hover:bg-[#0060BA] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
