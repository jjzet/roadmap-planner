import { useEffect, useRef, useState } from 'react';
import { Brain, Plus, Sparkles, Square, Castle, Trees, Waves, Rocket, Skull, Trash2 } from 'lucide-react';
import type { PalaceRoom, PalaceTheme } from '@/types';
import { useMemoryPalaceStore } from '@/store/memoryPalaceStore';
import { PalaceCanvas } from '@/components/memory/PalaceCanvas';
import { PalaceInspector } from '@/components/memory/PalaceInspector';

const THEME_ICONS: Record<PalaceTheme, typeof Trees> = {
  forest: Trees,
  dungeon: Skull,
  castle: Castle,
  beach: Waves,
  space: Rocket,
};

const THEME_LABELS: Record<PalaceTheme, string> = {
  forest: 'Forest',
  dungeon: 'Dungeon',
  castle: 'Castle',
  beach: 'Beach',
  space: 'Space',
};

const ROOM_COLORS = ['#7c5e3c', '#3d6a8b', '#6b4a7c', '#3c8b62', '#a35a4a', '#bf9000'];

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function MemoryPalaceView() {
  const palaces = useMemoryPalaceStore((s) => s.palaces);
  const currentPalaceId = useMemoryPalaceStore((s) => s.currentPalaceId);
  const isLoading = useMemoryPalaceStore((s) => s.isLoading);
  const tableMissing = useMemoryPalaceStore((s) => s.tableMissing);
  const selectPalace = useMemoryPalaceStore((s) => s.selectPalace);
  const createPalace = useMemoryPalaceStore((s) => s.createPalace);
  const deletePalace = useMemoryPalaceStore((s) => s.deletePalace);
  const renamePalace = useMemoryPalaceStore((s) => s.renamePalace);
  const setTheme = useMemoryPalaceStore((s) => s.setTheme);
  const addRoom = useMemoryPalaceStore((s) => s.addRoom);
  const addObject = useMemoryPalaceStore((s) => s.addObject);

  const palace = palaces.find((p) => p.id === currentPalaceId);

  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [mode, setMode] = useState<'place_object' | 'draw_room' | 'select'>('select');
  const [draftRoom, setDraftRoom] = useState<{ x: number; y: number } | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (palace) setTitleDraft(palace.name);
  }, [palace?.id, palace?.name]);

  const handleCreate = async () => {
    const id = await createPalace('New palace', 'forest');
    if (id) {
      setMode('select');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleCanvasClick = (gx: number, gy: number) => {
    if (!palace) return;

    if (mode === 'place_object') {
      const obj = {
        id: genId('obj'),
        x: gx,
        y: gy,
        sprite: '🔑',
        label: 'New memory',
        note: '',
        roomId: palace.rooms.find(
          (r) => gx >= r.x && gx < r.x + r.w && gy >= r.y && gy < r.y + r.h
        )?.id,
      };
      addObject(palace.id, obj);
      setSelectedObjectId(obj.id);
      setSelectedRoomId(null);
      setMode('select');
      return;
    }

    if (mode === 'draw_room') {
      if (!draftRoom) {
        setDraftRoom({ x: gx, y: gy });
      } else {
        const x1 = Math.min(draftRoom.x, gx);
        const y1 = Math.min(draftRoom.y, gy);
        const x2 = Math.max(draftRoom.x, gx);
        const y2 = Math.max(draftRoom.y, gy);
        const w = Math.max(2, x2 - x1 + 1);
        const h = Math.max(2, y2 - y1 + 1);
        const room: PalaceRoom = {
          id: genId('room'),
          name: 'Room',
          x: x1,
          y: y1,
          w: Math.min(w, palace.grid_width - x1),
          h: Math.min(h, palace.grid_height - y1),
          color: ROOM_COLORS[palace.rooms.length % ROOM_COLORS.length],
          note: '',
        };
        addRoom(palace.id, room);
        setDraftRoom(null);
        setMode('select');
        setSelectedRoomId(room.id);
      }
    }
  };

  const handleClearSelection = () => {
    setSelectedObjectId(null);
    setSelectedRoomId(null);
  };

  if (tableMissing) {
    return (
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-2xl mx-auto px-6 py-12">
          <div className="bg-white border border-amber-200 rounded-md p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-700 font-semibold">
                Migration needed
              </p>
            </div>
            <p className="text-[13px] font-mono font-light text-gray-700 leading-relaxed">
              The Memory Palace feature needs one SQL migration to be applied. Run{' '}
              <code className="px-1 bg-gray-100 rounded text-xs">
                supabase/migrations/006_memory_palaces.sql
              </code>{' '}
              in your Supabase SQL editor, then refresh.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && palaces.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[12px] font-mono text-gray-400">
        Loading palaces…
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 tech-glow" />
              <h1 className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-gray-700">
                Memory Palace
              </h1>
            </div>
            <p className="text-2xl font-bold text-gray-800 tracking-tight mt-2">
              Build a place to remember.
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Each palace is a 2D map. Drop rooms; place objects on tiles; tag each with what it stands for.
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-mono font-medium uppercase tracking-wider text-gray-600 bg-white border border-gray-200 rounded-sm hover:bg-cyan-50/40 hover:text-cyan-700 hover:border-cyan-300 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New palace
          </button>
        </div>

        {palaces.length === 0 ? (
          <div className="text-center py-20">
            <Brain className="w-10 h-10 text-gray-200 mx-auto mb-4" />
            <p className="text-base text-gray-400 font-medium">No palaces yet</p>
            <p className="text-sm text-gray-300 mt-1 mb-6">
              Create your first palace to start associating memories with places.
            </p>
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-mono font-medium uppercase tracking-wider text-white bg-cyan-600 rounded-sm hover:bg-cyan-700 transition-colors cursor-pointer border-none"
            >
              <Plus className="w-4 h-4" />
              New palace
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-[200px_1fr_280px] gap-4">
            {/* Left: palace list */}
            <aside className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 px-1 mb-1">
                Palaces
              </p>
              {palaces.map((p) => {
                const Icon = THEME_ICONS[p.theme];
                const active = p.id === currentPalaceId;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      selectPalace(p.id);
                      handleClearSelection();
                    }}
                    className={`w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-sm border transition-all cursor-pointer ${
                      active
                        ? 'bg-cyan-50 border-cyan-300 text-cyan-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-[11px] font-mono uppercase tracking-wider truncate flex-1">
                      {p.name}
                    </span>
                    <span className="text-[9px] font-mono text-gray-400">{p.objects.length}</span>
                  </button>
                );
              })}
            </aside>

            {/* Center: canvas + toolbar */}
            <main className="space-y-3 min-w-0">
              {palace && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <input
                      ref={inputRef}
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onBlur={() => titleDraft !== palace.name && renamePalace(palace.id, titleDraft || 'Untitled palace')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      className="flex-1 text-base font-mono font-medium text-gray-800 bg-transparent border-none outline-none placeholder:text-gray-300 hover:bg-gray-50/60 focus:bg-white rounded-sm px-2 py-1 -ml-2 transition-colors"
                      placeholder="Untitled palace"
                    />
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete palace "${palace.name}"? This cannot be undone.`)) {
                          deletePalace(palace.id);
                        }
                      }}
                      className="text-gray-300 hover:text-red-500 bg-transparent border-none cursor-pointer p-1 transition-colors"
                      title="Delete palace"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Toolbar */}
                  <div className="flex items-center gap-2 flex-wrap bg-white border border-gray-200 rounded-md px-3 py-2">
                    <ToolbarButton
                      active={mode === 'select'}
                      onClick={() => {
                        setMode('select');
                        setDraftRoom(null);
                      }}
                      label="Select"
                    />
                    <ToolbarButton
                      active={mode === 'draw_room'}
                      onClick={() => {
                        setMode('draw_room');
                        setDraftRoom(null);
                        handleClearSelection();
                      }}
                      label={draftRoom ? 'Click opposite corner' : 'Add room'}
                      icon={<Square className="w-3 h-3" />}
                    />
                    <ToolbarButton
                      active={mode === 'place_object'}
                      onClick={() => {
                        setMode('place_object');
                        handleClearSelection();
                      }}
                      label="Drop object"
                      icon={<Plus className="w-3 h-3" />}
                    />

                    <div className="ml-auto flex items-center gap-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mr-1">
                        Theme
                      </span>
                      {(Object.keys(THEME_LABELS) as PalaceTheme[]).map((t) => {
                        const Icon = THEME_ICONS[t];
                        const isActive = palace.theme === t;
                        return (
                          <button
                            key={t}
                            onClick={() => setTheme(palace.id, t)}
                            className={`w-6 h-6 flex items-center justify-center rounded-sm border cursor-pointer transition-all ${
                              isActive
                                ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                            }`}
                            title={THEME_LABELS[t]}
                          >
                            <Icon className="w-3 h-3" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <PalaceCanvas
                      palace={palace}
                      selectedObjectId={selectedObjectId}
                      selectedRoomId={selectedRoomId}
                      onSelectObject={(id) => {
                        setSelectedObjectId(id);
                        setSelectedRoomId(null);
                      }}
                      onSelectRoom={(id) => {
                        setSelectedRoomId(id);
                        setSelectedObjectId(null);
                      }}
                      onCanvasClick={handleCanvasClick}
                    />
                  </div>
                </>
              )}
            </main>

            {/* Right: inspector */}
            <aside>
              {palace && (
                <PalaceInspector
                  palace={palace}
                  selectedObjectId={selectedObjectId}
                  selectedRoomId={selectedRoomId}
                  onClearSelection={handleClearSelection}
                />
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider rounded-sm border cursor-pointer transition-all ${
        active
          ? 'bg-cyan-50 border-cyan-300 text-cyan-700'
          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
