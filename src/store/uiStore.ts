import { create } from 'zustand';
import type { ZoomLevel } from '../types';

interface UIState {
  zoom: ZoomLevel;
  selectedItemId: string | null;
  selectedStreamId: string | null;
  editPanelOpen: boolean;
  isPanning: boolean;
  dependencyMode: boolean;
  dependencySourceItemId: string | null;

  // Sidebar detail columns visibility
  showLeadColumn: boolean;
  showSupportColumn: boolean;
  showPhaseColumn: boolean;

  setZoom: (z: ZoomLevel) => void;
  toggleZoom: () => void;
  selectItem: (itemId: string | null, streamId?: string | null) => void;
  openEditPanel: () => void;
  closeEditPanel: () => void;
  setPanning: (v: boolean) => void;
  enterDependencyMode: (sourceItemId: string) => void;
  exitDependencyMode: () => void;
  toggleLeadColumn: () => void;
  toggleSupportColumn: () => void;
  togglePhaseColumn: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  zoom: 'week',
  selectedItemId: null,
  selectedStreamId: null,
  editPanelOpen: false,
  isPanning: false,
  dependencyMode: false,
  dependencySourceItemId: null,

  showLeadColumn: false,
  showSupportColumn: false,
  showPhaseColumn: false,

  setZoom: (z) => set({ zoom: z }),
  toggleZoom: () =>
    set((s) => ({ zoom: s.zoom === 'week' ? 'month' : 'week' })),

  selectItem: (itemId, streamId = null) =>
    set({
      selectedItemId: itemId,
      selectedStreamId: streamId,
      // Don't auto-open edit panel on select — only double-click opens it
    }),

  openEditPanel: () => set({ editPanelOpen: true }),
  closeEditPanel: () =>
    set({ editPanelOpen: false, selectedItemId: null, selectedStreamId: null }),

  setPanning: (v) => set({ isPanning: v }),

  enterDependencyMode: (sourceItemId) =>
    set({ dependencyMode: true, dependencySourceItemId: sourceItemId }),

  exitDependencyMode: () =>
    set({ dependencyMode: false, dependencySourceItemId: null }),

  toggleLeadColumn: () => set((s) => ({ showLeadColumn: !s.showLeadColumn })),
  toggleSupportColumn: () => set((s) => ({ showSupportColumn: !s.showSupportColumn })),
  togglePhaseColumn: () => set((s) => ({ showPhaseColumn: !s.showPhaseColumn })),
}));
