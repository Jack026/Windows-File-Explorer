/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#070A0F',
          900: '#0B0F17',
          800: '#111827',
          700: '#1E293B',
          600: '#334155',
        },
        category: {
          media: '#8B5CF6',     // Violet
          code: '#F59E0B',      // Amber
          archive: '#EC4899',   // Rose
          document: '#3B82F6',  // Blue
          executable: '#10B981',// Emerald
          system: '#64748B',    // Slate
          danger: '#EF4444',    // Red
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'Courier New', 'monospace'],
      }
    },
  },
  plugins: [],
}
