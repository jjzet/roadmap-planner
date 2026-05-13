import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { supabase } from '../lib/supabase';
import type {
  MemoryPalaceRecord,
  MemoryPalaceData,
  PalaceObject,
  PalaceObjectIcon,
  PalaceRoom,
  PalaceTheme,
} from '../types';

function uuid(): string {
  return crypto.randomUUID();
}

function emptyPalaceData(): MemoryPalaceData {
  return { width: 24, height: 16, rooms: [], objects: [] };
}

const ROOM_PALETTE = [
  '#7DD3FC', // sky
  '#86EFAC', // green
  '#FCD34D', // amber
  '#FCA5A5', // rose
  '#C4B5FD', // violet
  '#FDBA74', // orange
];

interface PalaceStore {
  palaces: MemoryPalaceRecord[];
  currentPalaceId: string | null;
  selectedObjectId: string | null;
  isLoading: boolean;

  fetchPalaces: () => Promise<void>;
  selectPalace: (id: string | null) => void;
  selectObject: (id: string | null) => void;

  createPalace: (name: string, theme?: PalaceTheme) => Promise<string | null>;
  renamePalace: (id: string, name: string) => Promise<void>;
  setTheme: (id: string, theme: PalaceTheme) => Promise<void>;
  deletePalace: (id: string) => Promise<void>;

  addRoom: (palaceId: string, partial?: Partial<PalaceRoom>) => Promise<string | null>;
  updateRoom: (palaceId: string, roomId: string, patch: Partial<PalaceRoom>) => Promise<void>;
  removeRoom: (palaceId: string, roomId: string) => Promise<void>;

  addObject: (palaceId: string, partial?: Partial<PalaceObject>) => Promise<string | null>;
  updateObject: (palaceId: string, objectId: string, patch: Partial<PalaceObject>) => Promise<void>;
  removeObject: (palaceId: string, objectId: string) => Promise<void>;
}

async function persist(id: string, patch: Partial<MemoryPalaceRecord>) {
  const payload: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  const { error } = await supabase.from('memory_palaces').update(payload).eq('id', id);
  if (error) console.error('palace persist failed:', error);
}

export const usePalaceStore = create<PalaceStore>()(
  immer((set, get) => ({
    palaces: [],
    currentPalaceId: null,
    selectedObjectId: null,
    isLoading: false,

    fetchPalaces: async () => {
      set({ isLoading: true });
      const { data, error } = await supabase
        .from('memory_palaces')
        .select('*')
        .eq('archived', false)
        .order('updated_at', { ascending: false });
      if (error) {
        console.error('Failed to load palaces:', error);
        set({ isLoading: false });
        return;
      }
      const rows = (data ?? []) as MemoryPalaceRecord[];
      set((s) => {
        s.palaces = rows;
        if (rows.length && !rows.find((p) => p.id === s.currentPalaceId)) {
          s.currentPalaceId = rows[0].id;
        }
        if (!rows.length) s.currentPalaceId = null;
        s.isLoading = false;
      });
    },

    selectPalace: (id) => set({ currentPalaceId: id, selectedObjectId: null }),
    selectObject: (id) => set({ selectedObjectId: id }),

    createPalace: async (name, theme = 'overworld') => {
      const { data, error } = await supabase
        .from('memory_palaces')
        .insert({ name, theme, data: emptyPalaceData() })
        .select('*')
        .single();
      if (error || !data) {
        console.error('Failed to create palace:', error);
        return null;
      }
      const row = data as MemoryPalaceRecord;
      set((s) => {
        s.palaces.unshift(row);
        s.currentPalaceId = row.id;
        s.selectedObjectId = null;
      });
      return row.id;
    },

    renamePalace: async (id, name) => {
      set((s) => {
        const p = s.palaces.find((x) => x.id === id);
        if (p) p.name = name;
      });
      await persist(id, { name });
    },

    setTheme: async (id, theme) => {
      set((s) => {
        const p = s.palaces.find((x) => x.id === id);
        if (p) p.theme = theme;
      });
      await persist(id, { theme });
    },

    deletePalace: async (id) => {
      const { error } = await supabase.from('memory_palaces').delete().eq('id', id);
      if (error) {
        console.error('Failed to delete palace:', error);
        return;
      }
      set((s) => {
        s.palaces = s.palaces.filter((p) => p.id !== id);
        if (s.currentPalaceId === id) {
          s.currentPalaceId = s.palaces[0]?.id ?? null;
          s.selectedObjectId = null;
        }
      });
    },

    addRoom: async (palaceId, partial) => {
      const palace = get().palaces.find((p) => p.id === palaceId);
      if (!palace) return null;
      const data: MemoryPalaceData = JSON.parse(JSON.stringify(palace.data));
      const idx = data.rooms.length;
      const room: PalaceRoom = {
        id: uuid(),
        name: partial?.name ?? `Room ${idx + 1}`,
        description: partial?.description ?? '',
        x: partial?.x ?? 1 + (idx % 3) * 7,
        y: partial?.y ?? 1 + Math.floor(idx / 3) * 5,
        width: partial?.width ?? 6,
        height: partial?.height ?? 4,
        color: partial?.color ?? ROOM_PALETTE[idx % ROOM_PALETTE.length],
      };
      data.rooms.push(room);
      set((s) => {
        const p = s.palaces.find((x) => x.id === palaceId);
        if (p) p.data = data;
      });
      await persist(palaceId, { data });
      return room.id;
    },

    updateRoom: async (palaceId, roomId, patch) => {
      const palace = get().palaces.find((p) => p.id === palaceId);
      if (!palace) return;
      const data: MemoryPalaceData = JSON.parse(JSON.stringify(palace.data));
      const room = data.rooms.find((r) => r.id === roomId);
      if (!room) return;
      Object.assign(room, patch);
      set((s) => {
        const p = s.palaces.find((x) => x.id === palaceId);
        if (p) p.data = data;
      });
      await persist(palaceId, { data });
    },

    removeRoom: async (palaceId, roomId) => {
      const palace = get().palaces.find((p) => p.id === palaceId);
      if (!palace) return;
      const data: MemoryPalaceData = JSON.parse(JSON.stringify(palace.data));
      data.rooms = data.rooms.filter((r) => r.id !== roomId);
      data.objects = data.objects.map((o) => (o.roomId === roomId ? { ...o, roomId: undefined } : o));
      set((s) => {
        const p = s.palaces.find((x) => x.id === palaceId);
        if (p) p.data = data;
      });
      await persist(palaceId, { data });
    },

    addObject: async (palaceId, partial) => {
      const palace = get().palaces.find((p) => p.id === palaceId);
      if (!palace) return null;
      const data: MemoryPalaceData = JSON.parse(JSON.stringify(palace.data));
      const icon: PalaceObjectIcon = partial?.icon ?? 'chest';
      // Auto-place inside the assigned room if no coords supplied.
      let x = partial?.x;
      let y = partial?.y;
      if (x == null || y == null) {
        const room = partial?.roomId ? data.rooms.find((r) => r.id === partial.roomId) : data.rooms[0];
        if (room) {
          const taken = new Set(
            data.objects.filter((o) => o.roomId === room.id).map((o) => `${o.x},${o.y}`)
          );
          outer: for (let oy = room.y + 1; oy < room.y + room.height - 1; oy++) {
            for (let ox = room.x + 1; ox < room.x + room.width - 1; ox++) {
              if (!taken.has(`${ox},${oy}`)) {
                x = ox;
                y = oy;
                break outer;
              }
            }
          }
        }
        if (x == null || y == null) {
          x = Math.min(data.width - 2, 2 + (data.objects.length % (data.width - 4)));
          y = Math.min(data.height - 2, 2 + Math.floor(data.objects.length / (data.width - 4)));
        }
      }
      const obj: PalaceObject = {
        id: uuid(),
        name: partial?.name ?? 'New memory',
        content: partial?.content ?? '',
        x,
        y,
        icon,
        color: partial?.color ?? '#06B6D4',
        roomId: partial?.roomId,
        link: partial?.link,
      };
      data.objects.push(obj);
      set((s) => {
        const p = s.palaces.find((x) => x.id === palaceId);
        if (p) p.data = data;
        s.selectedObjectId = obj.id;
      });
      await persist(palaceId, { data });
      return obj.id;
    },

    updateObject: async (palaceId, objectId, patch) => {
      const palace = get().palaces.find((p) => p.id === palaceId);
      if (!palace) return;
      const data: MemoryPalaceData = JSON.parse(JSON.stringify(palace.data));
      const obj = data.objects.find((o) => o.id === objectId);
      if (!obj) return;
      Object.assign(obj, patch);
      // Re-link object to a room based on coords.
      const inRoom = data.rooms.find(
        (r) => obj.x >= r.x && obj.x < r.x + r.width && obj.y >= r.y && obj.y < r.y + r.height
      );
      obj.roomId = inRoom?.id;
      set((s) => {
        const p = s.palaces.find((x) => x.id === palaceId);
        if (p) p.data = data;
      });
      await persist(palaceId, { data });
    },

    removeObject: async (palaceId, objectId) => {
      const palace = get().palaces.find((p) => p.id === palaceId);
      if (!palace) return;
      const data: MemoryPalaceData = JSON.parse(JSON.stringify(palace.data));
      data.objects = data.objects.filter((o) => o.id !== objectId);
      set((s) => {
        const p = s.palaces.find((x) => x.id === palaceId);
        if (p) p.data = data;
        if (s.selectedObjectId === objectId) s.selectedObjectId = null;
      });
      await persist(palaceId, { data });
      // Best-effort cleanup of the spaced-repetition record for this locus.
      // Loaded lazily so the palace store stays decoupled from review state.
      try {
        const { usePalaceReviewStore } = await import('./palaceReviewStore');
        await usePalaceReviewStore.getState().removeReviewsForObject(palaceId, objectId);
      } catch (e) {
        console.warn('failed to clear review for removed object:', e);
      }
    },
  }))
);
