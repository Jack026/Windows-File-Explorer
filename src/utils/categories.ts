import { FileCategory } from '../types';

export const ONE_UI_BLUE = '#0072DE';
export const ONE_UI_BLUE_DARK = '#2C75FF';

export const CATEGORY_COLORS: Record<FileCategory, string> = {
  media: '#8B5CF6',     // Violet / Media
  code: '#F59E0B',      // Amber / Dev Bloat
  archive: '#EC4899',   // Rose / Archives
  document: '#0072DE',  // Samsung Blue / Documents
  executable: '#10B981',// Emerald / Apps
  system: '#64748B',    // Slate / System
  other: '#94A3B8',     // Muted Slate
};

export const CATEGORY_BG_LIGHT: Record<FileCategory, string> = {
  media: 'rgba(139, 92, 246, 0.1)',
  code: 'rgba(245, 158, 11, 0.1)',
  archive: 'rgba(236, 72, 153, 0.1)',
  document: 'rgba(0, 114, 222, 0.1)',
  executable: 'rgba(16, 185, 129, 0.1)',
  system: 'rgba(100, 116, 139, 0.1)',
  other: 'rgba(148, 163, 184, 0.1)',
};

export const CATEGORY_BG_DARK: Record<FileCategory, string> = {
  media: 'rgba(139, 92, 246, 0.18)',
  code: 'rgba(245, 158, 11, 0.18)',
  archive: 'rgba(236, 72, 153, 0.18)',
  document: 'rgba(44, 117, 255, 0.18)',
  executable: 'rgba(16, 185, 129, 0.18)',
  system: 'rgba(100, 116, 139, 0.18)',
  other: 'rgba(148, 163, 184, 0.18)',
};

export const CATEGORY_LABELS: Record<FileCategory, string> = {
  media: 'Images & Videos',
  code: 'Development & Build',
  archive: 'Compressed Archives',
  document: 'Documents & Spreadsheets',
  executable: 'Applications & Executables',
  system: 'System & Reserved',
  other: 'Other Files',
};

export function getCategoryBadge(
  category: FileCategory,
  extension: string,
  isDirectory: boolean,
  isDevCache?: boolean,
  isDarkMode = true
) {
  if (isDevCache) {
    return {
      text: 'Build Cache',
      color: '#F59E0B',
      bgColor: isDarkMode ? 'rgba(245, 158, 11, 0.18)' : 'rgba(245, 158, 11, 0.12)',
    };
  }

  if (isDirectory) {
    return {
      text: 'Folder',
      color: isDarkMode ? '#94A3B8' : '#64748B',
      bgColor: isDarkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(100, 116, 139, 0.08)',
    };
  }

  const rawExt = extension.replace('.', '').toUpperCase();
  const color = CATEGORY_COLORS[category] || '#94A3B8';
  const bgColor = isDarkMode ? CATEGORY_BG_DARK[category] : CATEGORY_BG_LIGHT[category];

  return {
    text: rawExt || 'FILE',
    color,
    bgColor,
  };
}
