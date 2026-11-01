import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTripBirrStore } from '../store/useTripBirrStore';

export const ThemeToggleButton: React.FC = () => {
  const { settings, updateSettings } = useTripBirrStore();
  const isDark = settings.theme === 'dark';

  return (
    <button
      type="button"
      onClick={() =>
        updateSettings({
          theme: isDark ? 'light' : 'dark',
        })
      }
      className="w-10 h-10 rounded-full bg-white dark:bg-[#141B2D] border border-[#E2E8F0] dark:border-white/10 text-[#0F172A] dark:text-[#F8FAFC] flex items-center justify-center hover:border-[#2CD48D] transition-colors cursor-pointer shrink-0 shadow-xs"
      aria-label="Toggle color theme"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-[#2CD48D]" />
      ) : (
        <Moon className="w-4 h-4 text-[#0F172A]" />
      )}
    </button>
  );
};
