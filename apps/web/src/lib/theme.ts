import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'nova_theme';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme;
}

function applyTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

export const useTheme = create<ThemeState>((set, get) => {
  const initial = getStoredTheme();
  const resolved = resolveTheme(initial);

  // Apply immediately on store creation
  applyTheme(resolved);

  // Listen for system preference changes
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      const state = get();
      if (state.theme === 'system') {
        const newResolved = getSystemTheme();
        applyTheme(newResolved);
        set({ resolvedTheme: newResolved });
      }
    });
  }

  return {
    theme: initial,
    resolvedTheme: resolved,

    setTheme: (theme: Theme) => {
      const resolved = resolveTheme(theme);
      localStorage.setItem(STORAGE_KEY, theme);
      applyTheme(resolved);
      set({ theme, resolvedTheme: resolved });
    },
  };
});

/**
 * Apply theme from localStorage before React renders.
 * Call this in main.tsx before createRoot to prevent flash.
 */
export function initTheme() {
  const stored = getStoredTheme();
  const resolved = resolveTheme(stored);
  applyTheme(resolved);
}
