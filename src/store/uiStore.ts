import { create } from 'zustand';
import type { ActiveView, ZoomLevel } from '../types';

interface UIState {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;

  zoom: ZoomLevel;
  selectedItemId: string | null;
  selectedStreamId: string | null;
  selectedPhaseBarId: string | null;
  editPanelOpen: boolean;
  isPanning: boolean;
  dependencyMode: boolean;
  dependencySourceItemId: string | null;

  // Sidebar detail columns visibility
  showLeadColumn: boolean;
  showSupportColumn: boolean;
  showPhaseColumn: boolean;

  // Timeline display
  showMonthColors: boolean;

  // Slide-up dashboard panel (from BottomStatsStrip)
  dashboardPanelOpen: boolean;

  // Chat panel (mutually exclusive with dashboard)
  chatPanelOpen: boolean;

  setZoom: (z: ZoomLevel) => void;
  toggleZoom: () => void;
  selectItem: (itemId: string | null, streamId?: string | null) => void;
  selectPhaseBar: (phaseBarId: string | null) => void;
  openEditPanel: () => void;
  closeEditPanel: () => void;
  setPanning: (v: boolean) => void;
  enterDependencyMode: (sourceItemId: string) => void;
  exitDependencyMode: () => void;
  toggleLeadColumn: () => void;
  toggleSupportColumn: () => void;
  togglePhaseColumn: () => void;
  toggleMonthColors: () => void;

  toggleDashboardPanel: () => void;
  openDashboardPanel: () => void;
  closeDashboardPanel: () => void;

  toggleChatPanel: () => void;
  openChatPanel: () => void;
  closeChatPanel: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeView: 'roadmap',
  setActiveView: (view) => set({ activeView: view }),

  zoom: 'week',
  selectedItemId: null,
  selectedStreamId: null,
  selectedPhaseBarId: null,
  editPanelOpen: false,
  isPanning: false,
  dependencyMode: false,
  dependencySourceItemId: null,

  showLeadColumn: false,
  showSupportColumn: false,
  showPhaseColumn: false,
  showMonthColors: true,

  dashboardPanelOpen: false,
  chatPanelOpen: false,

  setZoom: (z) => set({ zoom: z }),
  toggleZoom: () =>
    set((s) => ({ zoom: s.zoom === 'week' ? 'month' : 'week' })),

  selectItem: (itemId, streamId = null) =>
    set({
      selectedItemId: itemId,
      selectedStreamId: streamId,
      selectedPhaseBarId: null,
      // Don't auto-open edit panel on select — only double-click opens it
    }),

  selectPhaseBar: (phaseBarId) => set({ selectedPhaseBarId: phaseBarId }),

  openEditPanel: () => set({ editPanelOpen: true }),
  closeEditPanel: () =>
    set({ editPanelOpen: false, selectedItemId: null, selectedStreamId: null, selectedPhaseBarId: null }),

  setPanning: (v) => set({ isPanning: v }),

  enterDependencyMode: (sourceItemId) =>
    set({ dependencyMode: true, dependencySourceItemId: sourceItemId }),

  exitDependencyMode: () =>
    set({ dependencyMode: false, dependencySourceItemId: null }),

  toggleLeadColumn: () => set((s) => ({ showLeadColumn: !s.showLeadColumn })),
  toggleSupportColumn: () => set((s) => ({ showSupportColumn: !s.showSupportColumn })),
  togglePhaseColumn: () => set((s) => ({ showPhaseColumn: !s.showPhaseColumn })),
  toggleMonthColors: () => set((s) => ({ showMonthColors: !s.showMonthColors })),

  toggleDashboardPanel: () => set((s) => ({ dashboardPanelOpen: !s.dashboardPanelOpen, chatPanelOpen: false })),
  openDashboardPanel: () => set({ dashboardPanelOpen: true, chatPanelOpen: false }),
  closeDashboardPanel: () => set({ dashboardPanelOpen: false }),

  toggleChatPanel: () => set((s) => ({ chatPanelOpen: !s.chatPanelOpen, dashboardPanelOpen: false })),
  openChatPanel: () => set({ chatPanelOpen: true, dashboardPanelOpen: false }),
  closeChatPanel: () => set({ chatPanelOpen: false }),
}));
