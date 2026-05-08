import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { MemoryPalace, PalaceObject, PalaceRoom, PalaceTheme } from '../types';
import { supabase } from '../lib/supabase';

interface MemoryPalaceStore {
  palaces: MemoryPalace[];
  currentPalaceId: string | null;
  isLoading: boolean;
  loaded: boolean;
  tableMissing: boolean;

  fetchPalaces: () => Promise<void>;
  selectPalace: (id: string | null) => void;
  createPalace: (name: string, theme?: PalaceTheme) => Promise<string | null>;
  renamePalace: (id: string, name: string) => Promise<void>;
  updateDescription: (id: string, description: string) => Promise<void>;
  setTheme: (id: string, theme: PalaceTheme) => Promise<void>;
  resizePalace: (id: string, width: number, height: number) => Promise<void>;
  deletePalace: (id: string) => Promise<void>;

  addRoom: (palaceId: string, room: PalaceRoom) => Promise<void>;
  updateRoom: (palaceId: string, roomId: string, patch: Partial<PalaceRoom>) => Promise<void>;
  deleteRoom: (palaceId: string, roomId: string) => Promise<void>;

  addObject: (palaceId: string, obj: PalaceObject) => Promise<void>;
  updateObject: (palaceId: string, objId: string, patch: Partial<PalaceObject>) => Promise<void>;
  deleteObject: (palaceId: string, objId: string) => Promise<void>;
}

function nowISO(): string {
  return new Date().toISOString();
}

async function persist(id: string, patch: Partial<MemoryPalace>): Promise<void> {
  const { error } = await supabase
    .from('memory_palaces')
    .update({ ...patch, updated_at: nowISO() })
    .eq('id', id);
  if (error) console.error('Failed to update palace:', error);
}

export const useMemoryPalaceStore = create<MemoryPalaceStore>()(
  immer((set) => ({
    palaces: [],
    currentPalaceId: null,
    isLoading: false,
    loaded: false,
    tableMissing: false,

    fetchPalaces: async () => {
      set({ isLoading: true });
      const { data, error } = await supabase
        .from('memory_palaces')
        .select('*')
        .eq('archived', false)
        .order('updated_at', { ascending: false });
      if (error) {
        const missing = error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message);
        set({ isLoading: false, loaded: true, tableMissing: missing });
        if (!missing) console.error('Failed to fetch palaces:', error);
        return;
      }
      const palaces = (data ?? []) as MemoryPalace[];
      set((s) => {
        s.palaces = palaces;
        s.isLoading = false;
        s.loaded = true;
        s.tableMissing = false;
        if (!s.currentPalaceId && palaces.length > 0) s.currentPalaceId = palaces[0].id;
      });
    },

    selectPalace: (id) => set({ currentPalaceId: id }),

    createPalace: async (name, theme = 'forest') => {
      const payload = {
        name: name || 'Untitled palace',
        description: '',
        theme,
        grid_width: 16,
        grid_height: 12,
        rooms: [],
        objects: [],
      };
      const { data, error } = await supabase
        .from('memory_palaces')
        .insert(payload)
        .select()
        .single();
      if (error || !data) {
        console.error('Failed to create palace:', error);
        return null;
      }
      set((s) => {
        s.palaces.unshift(data as MemoryPalace);
        s.currentPalaceId = data.id;
      });
      return data.id;
    },

    renamePalace: async (id, name) => {
      set((s) => {
        const p = s.palaces.find((p) => p.id === id);
        if (p) {
          p.name = name;
          p.updated_at = nowISO();
        }
      });
      await persist(id, { name });
    },

    updateDescription: async (id, description) => {
      set((s) => {
        const p = s.palaces.find((p) => p.id === id);
        if (p) {
          p.description = description;
          p.updated_at = nowISO();
        }
      });
      await persist(id, { description });
    },

    setTheme: async (id, theme) => {
      set((s) => {
        const p = s.palaces.find((p) => p.id === id);
        if (p) {
          p.theme = theme;
          p.updated_at = nowISO();
        }
      });
      await persist(id, { theme });
    },

    resizePalace: async (id, width, height) => {
      set((s) => {
        const p = s.palaces.find((p) => p.id === id);
        if (p) {
          p.grid_width = width;
          p.grid_height = height;
          p.updated_at = nowISO();
        }
      });
      await persist(id, { grid_width: width, grid_height: height });
    },

    deletePalace: async (id) => {
      set((s) => {
        s.palaces = s.palaces.filter((p) => p.id !== id);
        if (s.currentPalaceId === id) {
          s.currentPalaceId = s.palaces[0]?.id ?? null;
        }
      });
      const { error } = await supabase.from('memory_palaces').delete().eq('id', id);
      if (error) console.error('Failed to delete palace:', error);
    },

    addRoom: async (palaceId, room) => {
      let next: PalaceRoom[] = [];
      set((s) => {
        const p = s.palaces.find((p) => p.id === palaceId);
        if (!p) return;
        p.rooms.push(room);
        p.updated_at = nowISO();
        next = JSON.parse(JSON.stringify(p.rooms));
      });
      await persist(palaceId, { rooms: next });
    },

    updateRoom: async (palaceId, roomId, patch) => {
      let next: PalaceRoom[] = [];
      set((s) => {
        const p = s.palaces.find((p) => p.id === palaceId);
        if (!p) return;
        const r = p.rooms.find((r) => r.id === roomId);
        if (!r) return;
        Object.assign(r, patch);
        p.updated_at = nowISO();
        next = JSON.parse(JSON.stringify(p.rooms));
      });
      await persist(palaceId, { rooms: next });
    },

    deleteRoom: async (palaceId, roomId) => {
      let nextRooms: PalaceRoom[] = [];
      let nextObjects: PalaceObject[] = [];
      set((s) => {
        const p = s.palaces.find((p) => p.id === palaceId);
        if (!p) return;
        p.rooms = p.rooms.filter((r) => r.id !== roomId);
        p.objects = p.objects.map((o) => (o.roomId === roomId ? { ...o, roomId: undefined } : o));
        p.updated_at = nowISO();
        nextRooms = JSON.parse(JSON.stringify(p.rooms));
        nextObjects = JSON.parse(JSON.stringify(p.objects));
      });
      await persist(palaceId, { rooms: nextRooms, objects: nextObjects });
    },

    addObject: async (palaceId, obj) => {
      let next: PalaceObject[] = [];
      set((s) => {
        const p = s.palaces.find((p) => p.id === palaceId);
        if (!p) return;
        p.objects.push(obj);
        p.updated_at = nowISO();
        next = JSON.parse(JSON.stringify(p.objects));
      });
      await persist(palaceId, { objects: next });
    },

    updateObject: async (palaceId, objId, patch) => {
      let next: PalaceObject[] = [];
      set((s) => {
        const p = s.palaces.find((p) => p.id === palaceId);
        if (!p) return;
        const o = p.objects.find((o) => o.id === objId);
        if (!o) return;
        Object.assign(o, patch);
        p.updated_at = nowISO();
        next = JSON.parse(JSON.stringify(p.objects));
      });
      await persist(palaceId, { objects: next });
    },

    deleteObject: async (palaceId, objId) => {
      let next: PalaceObject[] = [];
      set((s) => {
        const p = s.palaces.find((p) => p.id === palaceId);
        if (!p) return;
        p.objects = p.objects.filter((o) => o.id !== objId);
        p.updated_at = nowISO();
        next = JSON.parse(JSON.stringify(p.objects));
      });
      await persist(palaceId, { objects: next });
    },
  }))
);

// Helper: get a palace by id without subscribing.
export function getPalaceById(id: string): MemoryPalace | undefined {
  return useMemoryPalaceStore.getState().palaces.find((p) => p.id === id);
}
