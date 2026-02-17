import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { RoadmapData, RoadmapItem, Stream, PhaseType } from '../types';
import { DEFAULT_SETTINGS } from '../lib/constants';
import { hasOverlap } from '../utils/overlapDetection';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/dates';

function uuid(): string {
  return crypto.randomUUID();
}

function emptyRoadmap(): RoadmapData {
  return {
    streams: [],
    dependencies: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

interface RoadmapListItem {
  id: string;
  name: string;
}

interface RoadmapStore {
  currentRoadmapId: string | null;
  roadmapName: string;
  roadmap: RoadmapData;
  roadmapList: RoadmapListItem[];
  isDirty: boolean;
  isLoading: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';

  // Stream actions
  addStream: (name: string, color: string) => void;
  updateStream: (streamId: string, patch: Partial<Pick<Stream, 'name' | 'color'>>) => void;
  removeStream: (streamId: string) => void;
  reorderStreams: (activeId: string, overId: string) => void;
  toggleStreamCollapse: (streamId: string) => void;

  // Item actions
  addItem: (streamId: string) => void;
  updateItem: (streamId: string, itemId: string, patch: Partial<RoadmapItem>) => void;
  removeItem: (streamId: string, itemId: string) => void;
  moveItem: (streamId: string, itemId: string, newStart: string, newEnd: string) => void;
  resizeItem: (streamId: string, itemId: string, newStart: string, newEnd: string) => void;

  // Dependency actions
  addDependency: (fromItemId: string, toItemId: string) => void;
  removeDependency: (depId: string) => void;

  // Persistence
  fetchRoadmapList: () => Promise<void>;
  loadRoadmap: (id: string) => Promise<void>;
  createRoadmap: (name: string) => Promise<string | null>;
  saveRoadmap: () => Promise<void>;
  renameRoadmap: (name: string) => void;
  setDirty: () => void;
}

export const useRoadmapStore = create<RoadmapStore>()(
  immer((set, get) => ({
    currentRoadmapId: null,
    roadmapName: 'New Roadmap',
    roadmap: emptyRoadmap(),
    roadmapList: [],
    isDirty: false,
    isLoading: false,
    saveStatus: 'idle' as const,

    setDirty: () => set({ isDirty: true }),

    // ── Stream Actions ──

    addStream: (name, color) => {
      set((s) => {
        const order = s.roadmap.streams.length;
        s.roadmap.streams.push({
          id: uuid(),
          name,
          color,
          collapsed: false,
          order,
          items: [],
        });
        s.isDirty = true;
      });
    },

    updateStream: (streamId, patch) => {
      set((s) => {
        const stream = s.roadmap.streams.find((st: Stream) => st.id === streamId);
        if (stream) {
          Object.assign(stream, patch);
          s.isDirty = true;
        }
      });
    },

    removeStream: (streamId) => {
      set((s) => {
        s.roadmap.streams = s.roadmap.streams.filter((st: Stream) => st.id !== streamId);
        // Remove dependencies referencing items in this stream
        const removedItemIds = new Set(
          s.roadmap.streams
            .filter((st: Stream) => st.id === streamId)
            .flatMap((st: Stream) => st.items.map((it: RoadmapItem) => it.id))
        );
        s.roadmap.dependencies = s.roadmap.dependencies.filter(
          (d) => !removedItemIds.has(d.fromItemId) && !removedItemIds.has(d.toItemId)
        );
        // Reorder remaining
        s.roadmap.streams.forEach((st: Stream, i: number) => {
          st.order = i;
        });
        s.isDirty = true;
      });
    },

    reorderStreams: (activeId, overId) => {
      set((s) => {
        const streams = s.roadmap.streams;
        const oldIdx = streams.findIndex((st: Stream) => st.id === activeId);
        const newIdx = streams.findIndex((st: Stream) => st.id === overId);
        if (oldIdx === -1 || newIdx === -1) return;
        const [moved] = streams.splice(oldIdx, 1);
        streams.splice(newIdx, 0, moved);
        streams.forEach((st: Stream, i: number) => {
          st.order = i;
        });
        s.isDirty = true;
      });
    },

    toggleStreamCollapse: (streamId) => {
      set((s) => {
        const stream = s.roadmap.streams.find((st: Stream) => st.id === streamId);
        if (stream) {
          stream.collapsed = !stream.collapsed;
          s.isDirty = true;
        }
      });
    },

    // ── Item Actions ──

    addItem: (streamId) => {
      set((s) => {
        const stream = s.roadmap.streams.find((st: Stream) => st.id === streamId);
        if (!stream) return;
        const today = new Date();
        const nextMonday = new Date(today);
        const day = nextMonday.getDay();
        nextMonday.setDate(nextMonday.getDate() + (day === 0 ? 1 : 8 - day));
        const endDate = new Date(nextMonday);
        endDate.setDate(endDate.getDate() + 28); // 4 weeks

        const newItem: RoadmapItem = {
          id: uuid(),
          name: 'New Item',
          lead: '',
          support: '',
          startDate: formatDate(nextMonday),
          endDate: formatDate(endDate),
          phase: 'implementation-build' as PhaseType,
          notes: '',
          order: stream.items.length,
        };
        stream.items.push(newItem);
        s.isDirty = true;
      });
    },

    updateItem: (streamId, itemId, patch) => {
      set((s) => {
        const stream = s.roadmap.streams.find((st: Stream) => st.id === streamId);
        if (!stream) return;
        const item = stream.items.find((it: RoadmapItem) => it.id === itemId);
        if (!item) return;
        Object.assign(item, patch);
        s.isDirty = true;
      });
    },

    removeItem: (streamId, itemId) => {
      set((s) => {
        const stream = s.roadmap.streams.find((st: Stream) => st.id === streamId);
        if (!stream) return;
        stream.items = stream.items.filter((it: RoadmapItem) => it.id !== itemId);
        stream.items.forEach((it: RoadmapItem, i: number) => {
          it.order = i;
        });
        // Remove associated dependencies
        s.roadmap.dependencies = s.roadmap.dependencies.filter(
          (d) => d.fromItemId !== itemId && d.toItemId !== itemId
        );
        s.isDirty = true;
      });
    },

    moveItem: (streamId, itemId, newStart, newEnd) => {
      set((s) => {
        const stream = s.roadmap.streams.find((st: Stream) => st.id === streamId);
        if (!stream) return;
        if (hasOverlap(stream.items, itemId, newStart, newEnd)) return;
        const item = stream.items.find((it: RoadmapItem) => it.id === itemId);
        if (!item) return;
        item.startDate = newStart;
        item.endDate = newEnd;
        s.isDirty = true;
      });
    },

    resizeItem: (streamId, itemId, newStart, newEnd) => {
      set((s) => {
        const stream = s.roadmap.streams.find((st: Stream) => st.id === streamId);
        if (!stream) return;
        if (hasOverlap(stream.items, itemId, newStart, newEnd)) return;
        const item = stream.items.find((it: RoadmapItem) => it.id === itemId);
        if (!item) return;
        item.startDate = newStart;
        item.endDate = newEnd;
        s.isDirty = true;
      });
    },

    // ── Dependency Actions ──

    addDependency: (fromItemId, toItemId) => {
      set((s) => {
        // Don't add duplicate
        const exists = s.roadmap.dependencies.some(
          (d) => d.fromItemId === fromItemId && d.toItemId === toItemId
        );
        if (exists) return;
        s.roadmap.dependencies.push({ id: uuid(), fromItemId, toItemId });
        s.isDirty = true;
      });
    },

    removeDependency: (depId) => {
      set((s) => {
        s.roadmap.dependencies = s.roadmap.dependencies.filter((d) => d.id !== depId);
        s.isDirty = true;
      });
    },

    // ── Persistence ──

    fetchRoadmapList: async () => {
      const { data, error } = await supabase
        .from('roadmaps')
        .select('id, name')
        .order('updated_at', { ascending: false });
      if (error) {
        console.error('Failed to fetch roadmap list:', error);
        return;
      }
      set({ roadmapList: data || [] });
    },

    loadRoadmap: async (id) => {
      set({ isLoading: true });
      const { data, error } = await supabase
        .from('roadmaps')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        console.error('Failed to load roadmap:', error);
        set({ isLoading: false });
        return;
      }
      if (data) {
        const roadmapData = data.data as RoadmapData;
        set({
          currentRoadmapId: data.id,
          roadmapName: data.name,
          roadmap: {
            streams: roadmapData.streams || [],
            dependencies: roadmapData.dependencies || [],
            settings: roadmapData.settings || { ...DEFAULT_SETTINGS },
          },
          isDirty: false,
          isLoading: false,
        });
      }
    },

    createRoadmap: async (name) => {
      const newData = emptyRoadmap();
      const { data, error } = await supabase
        .from('roadmaps')
        .insert({ name, data: newData })
        .select()
        .single();
      if (error) {
        console.error('Failed to create roadmap:', error);
        return null;
      }
      set({
        currentRoadmapId: data.id,
        roadmapName: data.name,
        roadmap: newData,
        isDirty: false,
      });
      // Refresh list
      get().fetchRoadmapList();
      return data.id;
    },

    saveRoadmap: async () => {
      const { currentRoadmapId, roadmap, roadmapName } = get();
      if (!currentRoadmapId) return;
      set({ saveStatus: 'saving' });
      const { error } = await supabase
        .from('roadmaps')
        .update({
          data: roadmap,
          name: roadmapName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentRoadmapId);
      if (error) {
        console.error('Failed to save:', error);
        set({ saveStatus: 'error', isDirty: true });
      } else {
        set({ isDirty: false, saveStatus: 'saved' });
        // Reset saved indicator after 2s
        setTimeout(() => {
          set((s) => {
            if (s.saveStatus === 'saved') s.saveStatus = 'idle';
          });
        }, 2000);
      }
    },

    renameRoadmap: (name) => {
      set({ roadmapName: name, isDirty: true });
    },
  }))
);
