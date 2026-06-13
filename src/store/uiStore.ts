import { create } from 'zustand';
import type { ActiveView } from '../types';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'orbit-theme';

function loadTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

interface UIState {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;

  theme: Theme;
  toggleTheme: () => void;

  // Capture overlay (dock "+ Capture")
  captureOpen: boolean;
  openCapture: () => void;
  closeCapture: () => void;
}

const initialTheme = loadTheme();
applyTheme(initialTheme);

export const useUIStore = create<UIState>((set) => ({
  activeView: 'tasks',
  setActiveView: (view) => set({ activeView: view }),

  theme: initialTheme,
  toggleTheme: () =>
    set((s) => {
      const next: Theme = s.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
      return { theme: next };
    }),

  captureOpen: false,
  openCapture: () => set({ captureOpen: true }),
  closeCapture: () => set({ captureOpen: false }),
}));
