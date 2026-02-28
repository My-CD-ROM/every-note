import { create } from 'zustand';

type Theme = 'light' | 'dark';
type View = 'all' | 'folder' | 'tag' | 'trash' | 'favorites' | 'daily' | 'graph' | 'completed' | 'board';

interface UIState {
  theme: Theme;
  sidebarOpen: boolean;
  mobileSidebarOpen: boolean;
  searchOpen: boolean;
  view: View;

  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setView: (view: View) => void;
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('theme', theme);
}

export const useUIStore = create<UIState>((set) => {
  const initial = getInitialTheme();
  applyTheme(initial);

  return {
    theme: initial,
    sidebarOpen: true,
    mobileSidebarOpen: false,
    searchOpen: false,
    view: 'all',

    toggleTheme: () =>
      set((s) => {
        const next = s.theme === 'light' ? 'dark' : 'light';
        applyTheme(next);
        return { theme: next };
      }),

    setTheme: (theme) => {
      applyTheme(theme);
      set({ theme });
    },

    toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
    setSearchOpen: (open) => set({ searchOpen: open }),
    setView: (view) => set({ view }),
  };
});
