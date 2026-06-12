import { lazy, Suspense, useMemo, useState } from 'react';
import { Castle, Plus, Trash2, Box, DoorOpen, Footprints, ChevronDown, Sparkles, Mountain } from 'lucide-react';
import { usePalaceStore } from '@/store/palaceStore';
import { PalaceMap } from '@/components/palace/PalaceMap';
import { PALACE_THEMES, themeLabel } from '@/components/palace/constants';
import { ObjectEditor } from '@/components/palace/ObjectEditor';
import { PalaceWalk } from '@/components/palace/PalaceWalk';
import { PalaceBuilder } from '@/components/palace/PalaceBuilder';

// three.js is a heavy chunk — load it only when someone steps inside.
const Palace3D = lazy(() => import('@/components/palace/three/Palace3D'));
import { PixelSprite } from '@/components/palace/PixelSprite';
import { usePalaceReviewStore, reviewKey, isDue } from '@/store/palaceReviewStore';
import {
  THEME_ROOMS,
  objectsForRoomKind,
  type ObjectKind,
  type RoomKind,
} from '@/components/palace/presets';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import type { PalaceRoom, PalaceTheme } from '@/types';

export function PalacesView() {
  const palaces = usePalaceStore((s) => s.palaces);
  const currentPalaceId = usePalaceStore((s) => s.currentPalaceId);
  const selectedObjectId = usePalaceStore((s) => s.selectedObjectId);
  const isLoading = usePalaceStore((s) => s.isLoading);
  const selectPalace = usePalaceStore((s) => s.selectPalace);
  const selectObject = usePalaceStore((s) => s.selectObject);
  const renamePalace = usePalaceStore((s) => s.renamePalace);
  const setTheme = usePalaceStore((s) => s.setTheme);
  const deletePalace = usePalaceStore((s) => s.deletePalace);
  const addRoom = usePalaceStore((s) => s.addRoom);
  const addObject = usePalaceStore((s) => s.addObject);
  const updateRoom = usePalaceStore((s) => s.updateRoom);
  const updateObject = usePalaceStore((s) => s.updateObject);
  const removeObject = usePalaceStore((s) => s.removeObject);
  const removeRoom = usePalaceStore((s) => s.removeRoom);

  const palace = palaces.find((p) => p.id === currentPalaceId) ?? null;
  const selectedObject = palace?.data.objects.find((o) => o.id === selectedObjectId) ?? null;

  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [walkMode, setWalkMode] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [threeD, setThreeD] = useState(false);

  // Due count for the current palace — powers the "Review" call to action.
  const reviews = usePalaceReviewStore((s) => s.reviews);
  const dueCount = useMemo(() => {
    if (!palace) return 0;
    const now = new Date();
    let n = 0;
    for (const o of palace.data.objects) {
      if (isDue(reviews[reviewKey(palace.id, o.id)] ?? null, now)) n++;
    }
    return n;
  }, [palace, reviews]);

  const handleNew = () => setBuilderOpen(true);

  const enterWalk = (review: boolean) => {
    selectObject(null);
    setReviewMode(review);
    setWalkMode(true);
  };
  const exitWalk = () => {
    setWalkMode(false);
    setReviewMode(false);
  };

  const handleAddRoomKind = async (kind: RoomKind) => {
    if (!palace) return;
    // If a room of this kind already exists, suffix with a counter — palaces
    // can hold multiple rooms of the same type ("Tower", "Tower 2").
    const existing = palace.data.rooms.filter((r) => r.kind === kind.id).length;
    const name = existing === 0 ? kind.name : `${kind.name} ${existing + 1}`;
    await addRoom(palace.id, { name, kind: kind.id, color: kind.color });
  };

  const handleAddObjectKind = async (room: PalaceRoom, kind: ObjectKind) => {
    if (!palace) return;
    await addObject(palace.id, {
      name: kind.name,
      icon: kind.icon,
      color: kind.color,
      kind: kind.id,
      roomId: room.id,
    });
  };

  // Assign a kind to a legacy room (no name overwrite — user-chosen names
  // like "Change Hut" stay; only the kind + floor colour adopt the preset).
  const handleAssignRoomKind = async (room: PalaceRoom, kind: RoomKind) => {
    if (!palace) return;
    await updateRoom(palace.id, room.id, { kind: kind.id, color: kind.color });
  };

  const handleDelete = async () => {
    if (!palace) return;
    if (!window.confirm(`Delete palace "${palace.name}"? This cannot be undone.`)) return;
    await deletePalace(palace.id);
  };

  const startRename = () => {
    if (!palace) return;
    setDraftName(palace.name);
    setRenaming(true);
  };
  const commitRename = async () => {
    if (palace && draftName.trim() && draftName.trim() !== palace.name) {
      await renamePalace(palace.id, draftName.trim());
    }
    setRenaming(false);
  };

  return (
    <div className="flex-1 overflow-hidden bg-gray-50 flex">
      {/* Left rail: palace list */}
      <div className="w-56 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-3 h-10 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-1.5">
            <Castle className="w-3.5 h-3.5 text-cyan-600" />
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-700 font-semibold">
              Palaces
            </p>
          </div>
          <button
            onClick={handleNew}
            className="text-gray-400 hover:text-cyan-600 bg-transparent border-none cursor-pointer p-0.5"
            title="New palace"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {palaces.length === 0 && !isLoading && (
            <div className="px-3 py-6 text-center">
              <p className="text-[11px] font-mono font-light text-gray-400 leading-relaxed">
                No palaces yet. Paste a list of things to remember and get a
                ready-made palace to walk through.
              </p>
              <button
                onClick={handleNew}
                className="mt-3 text-[10px] font-mono uppercase tracking-wider text-cyan-600 hover:text-cyan-700 bg-transparent border border-cyan-200 hover:border-cyan-400 rounded-full px-3 py-1 cursor-pointer transition-colors"
              >
                New palace
              </button>
            </div>
          )}
          {palaces.map((p) => (
            <PalaceListItem
              key={p.id}
              palaceId={p.id}
              name={p.name}
              theme={p.theme}
              roomCount={p.data.rooms.length}
              objectCount={p.data.objects.length}
              objectIds={p.data.objects.map((o) => o.id)}
              active={p.id === currentPalaceId}
              onSelect={() => selectPalace(p.id)}
            />
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        {!palace ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[12px] font-mono font-light text-gray-400">
              Select or create a palace to begin.
            </p>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-5 h-12 border-b border-gray-100 bg-white">
              <div className="flex items-center gap-3 min-w-0">
                <Castle className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                {renaming ? (
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setRenaming(false);
                    }}
                    className="text-[16px] font-mono font-light text-gray-800 bg-transparent border-b border-cyan-300 outline-none min-w-0"
                  />
                ) : (
                  <h1
                    onDoubleClick={startRename}
                    className="text-[16px] font-mono font-light text-gray-800 truncate cursor-text"
                    title="Double-click to rename"
                  >
                    {palace.name}
                  </h1>
                )}
                <select
                  value={palace.theme}
                  onChange={(e) => setTheme(palace.id, e.target.value as PalaceTheme)}
                  className="text-[10px] font-mono uppercase tracking-wider text-gray-600 bg-white border border-gray-200 rounded px-2 py-1 cursor-pointer focus:border-cyan-300 outline-none"
                >
                  {PALACE_THEMES.map((t) => (
                    <option key={t} value={t}>{themeLabel(t)}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                {!walkMode && !threeD && (
                  <>
                    <AddRoomMenu
                      theme={palace.theme}
                      existingKinds={palace.data.rooms.map((r) => r.kind)}
                      onPick={handleAddRoomKind}
                    />
                    <AddMemoryMenu
                      theme={palace.theme}
                      rooms={palace.data.rooms}
                      onPick={handleAddObjectKind}
                      onAssignKind={handleAssignRoomKind}
                    />
                  </>
                )}
                {!walkMode && !threeD && dueCount > 0 && (
                  <button
                    onClick={() => enterWalk(true)}
                    className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-white bg-amber-500 hover:bg-amber-600 border border-amber-500 rounded px-2 py-1 cursor-pointer transition-colors"
                    title={`Start a review session — ${dueCount} loci due`}
                  >
                    <Sparkles className="w-3 h-3" />
                    Review {dueCount}
                  </button>
                )}
                {!threeD && (
                  <button
                    onClick={() => (walkMode ? exitWalk() : enterWalk(false))}
                    className={`flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider rounded px-2 py-1 cursor-pointer transition-colors border ${
                      walkMode
                        ? 'text-cyan-800 bg-cyan-50 border-cyan-300'
                        : 'text-gray-600 hover:text-cyan-700 bg-white border-gray-200 hover:border-cyan-300 hover:bg-cyan-50/40'
                    }`}
                    title={walkMode ? 'Exit walk mode (Esc)' : 'Walk through this palace (2D)'}
                  >
                    <Footprints className="w-3 h-3" />
                    {walkMode ? 'Exit walk' : 'Walk'}
                  </button>
                )}
                {!walkMode && (
                  <button
                    onClick={() => setThreeD((v) => !v)}
                    className={`flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider rounded px-2 py-1 cursor-pointer transition-colors border ${
                      threeD
                        ? 'text-cyan-800 bg-cyan-50 border-cyan-300'
                        : 'text-white bg-cyan-600 hover:bg-cyan-700 border-cyan-600'
                    }`}
                    title={threeD ? 'Back to the 2D map' : 'Step inside this palace in 3D'}
                  >
                    <Mountain className="w-3 h-3" />
                    {threeD ? 'Exit 3D' : 'Enter'}
                  </button>
                )}
                {!walkMode && !threeD && (
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-gray-400 hover:text-red-500 bg-transparent border border-transparent hover:border-red-100 rounded px-2 py-1 cursor-pointer transition-colors"
                    title="Delete palace"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {threeD ? (
              <Suspense
                fallback={
                  <div className="flex-1 flex items-center justify-center bg-gray-900">
                    <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-gray-400 animate-pulse">
                      Raising the walls…
                    </p>
                  </div>
                }
              >
                <Palace3D key={palace.id} palace={palace} onExit={() => setThreeD(false)} />
              </Suspense>
            ) : walkMode ? (
              <PalaceWalk
                key={`${palace.id}-${reviewMode ? 'review' : 'walk'}`}
                palace={palace}
                startInReview={reviewMode}
                onExit={exitWalk}
              />
            ) : (
              /* Canvas + side editor */
              <div className="flex-1 overflow-auto bg-gray-100/60">
                <div className="flex items-start gap-4 p-6 min-w-max">
                  <div>
                    <PalaceMap
                      data={palace.data}
                      theme={palace.theme}
                      selectedObjectId={selectedObjectId}
                      onSelectObject={selectObject}
                      onTileClick={() => setThreeD(true)}
                    />
                    <p className="mt-2 text-[10px] font-mono uppercase tracking-wider text-gray-400">
                      {palace.data.width}×{palace.data.height} · {palace.data.rooms.length} rooms · {palace.data.objects.length} memories
                      <span className="text-cyan-600"> · click the map to step inside</span>
                    </p>
                    {palace.data.rooms.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5 max-w-[600px]">
                        {palace.data.rooms.map((r) => (
                          <div
                            key={r.id}
                            className="group flex items-center gap-1.5 bg-white border border-gray-200 rounded-full pl-2 pr-1 py-0.5 text-[10px] font-mono"
                          >
                            <span className="w-2 h-2 rounded-sm" style={{ background: r.color }} />
                            <span className="text-gray-600">{r.name}</span>
                            <button
                              onClick={() => {
                                if (window.confirm(`Remove room "${r.name}"? Memories inside stay on the map.`)) {
                                  removeRoom(palace.id, r.id);
                                }
                              }}
                              className="text-gray-300 hover:text-red-500 bg-transparent border-none cursor-pointer p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove room"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedObject && (
                    <ObjectEditor
                      object={selectedObject}
                      data={palace.data}
                      onPatch={(patch) => updateObject(palace.id, selectedObject.id, patch)}
                      onDelete={() => removeObject(palace.id, selectedObject.id)}
                      onClose={() => selectObject(null)}
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {builderOpen && (
        <PalaceBuilder
          onClose={() => setBuilderOpen(false)}
          onCreated={() => setBuilderOpen(false)}
        />
      )}
    </div>
  );
}

// ── Toolbar pickers ──────────────────────────────────────────────────────

const TOOLBAR_BTN_CLS =
  'flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-gray-600 hover:text-cyan-700 bg-white border border-gray-200 hover:border-cyan-300 hover:bg-cyan-50/40 rounded px-2 py-1 cursor-pointer transition-colors';

function AddRoomMenu({
  theme, existingKinds, onPick,
}: {
  theme: PalaceTheme;
  existingKinds: (string | undefined)[];
  onPick: (kind: RoomKind) => void;
}) {
  const kinds = THEME_ROOMS[theme] ?? [];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={TOOLBAR_BTN_CLS} title={`Add a ${themeLabel(theme).toLowerCase()} room`}>
          <DoorOpen className="w-3 h-3" />
          Add room
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500">
          {themeLabel(theme)} rooms
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {kinds.map((k) => {
          const count = existingKinds.filter((id) => id === k.id).length;
          return (
            <DropdownMenuItem
              key={k.id}
              onSelect={() => onPick(k)}
              className="text-[12px] font-mono"
            >
              <span
                className="inline-block w-3 h-3 rounded-sm mr-2 flex-shrink-0"
                style={{ background: k.color }}
              />
              <span className="flex-1 truncate">{k.name}</span>
              {count > 0 && (
                <span className="ml-2 text-[10px] text-gray-400">×{count}</span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AddMemoryMenu({
  theme, rooms, onPick, onAssignKind,
}: {
  theme: PalaceTheme;
  rooms: PalaceRoom[];
  onPick: (room: PalaceRoom, kind: ObjectKind) => void;
  onAssignKind: (room: PalaceRoom, kind: RoomKind) => void;
}) {
  if (rooms.length === 0) {
    return (
      <button
        className={TOOLBAR_BTN_CLS + ' opacity-50 cursor-not-allowed'}
        disabled
        title="Add a room before placing memories"
      >
        <Box className="w-3 h-3" />
        Add memory
      </button>
    );
  }

  // If there's exactly one room with a kind, skip the room layer and show
  // its object kinds directly. Any other shape gets the per-room submenu.
  const single = rooms.length === 1 && rooms[0].kind ? rooms[0] : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={TOOLBAR_BTN_CLS} title="Drop a memory anchor in a room">
          <Box className="w-3 h-3" />
          Add memory
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        {single ? (
          <RoomObjectList room={single} onPick={onPick} />
        ) : (
          rooms.map((r) => (
            <DropdownMenuSub key={r.id}>
              <DropdownMenuSubTrigger className="text-[12px] font-mono">
                <span
                  className="inline-block w-3 h-3 rounded-sm mr-2 flex-shrink-0"
                  style={{ background: r.color }}
                />
                <span className="flex-1 truncate">{r.name}</span>
                {!r.kind && (
                  <span className="ml-2 text-[9px] font-mono uppercase tracking-wider text-amber-600">
                    no type
                  </span>
                )}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[200px]">
                {r.kind ? (
                  <RoomObjectList room={r} onPick={onPick} />
                ) : (
                  <RoomKindPicker
                    theme={theme}
                    room={r}
                    onAssign={onAssignKind}
                  />
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RoomObjectList({
  room, onPick,
}: {
  room: PalaceRoom;
  onPick: (room: PalaceRoom, kind: ObjectKind) => void;
}) {
  const kinds = objectsForRoomKind(room.kind);
  return (
    <>
      <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500">
        {room.name}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      {kinds.map((k) => (
        <DropdownMenuItem
          key={k.id}
          onSelect={() => onPick(room, k)}
          className="text-[12px] font-mono"
        >
          <span className="inline-block w-4 h-4 mr-2 flex-shrink-0">
            <PixelSprite icon={k.icon} color={k.color} size={16} />
          </span>
          <span className="flex-1 truncate">{k.name}</span>
        </DropdownMenuItem>
      ))}
    </>
  );
}

// Surfaced when a room has no `kind` assigned yet (legacy data, before the
// presets landed). Picking a kind here commits it to the room so the next
// "Add memory" click on this room shows the room-specific object list.
function RoomKindPicker({
  theme, room, onAssign,
}: {
  theme: PalaceTheme;
  room: PalaceRoom;
  onAssign: (room: PalaceRoom, kind: RoomKind) => void;
}) {
  const kinds = THEME_ROOMS[theme] ?? [];
  return (
    <>
      <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-700">
        Set "{room.name}" type
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      {kinds.map((k) => (
        <DropdownMenuItem
          key={k.id}
          onSelect={() => onAssign(room, k)}
          className="text-[12px] font-mono"
        >
          <span
            className="inline-block w-3 h-3 rounded-sm mr-2 flex-shrink-0"
            style={{ background: k.color }}
          />
          <span className="flex-1 truncate">{k.name}</span>
        </DropdownMenuItem>
      ))}
    </>
  );
}

interface PalaceListItemProps {
  palaceId: string;
  name: string;
  theme: PalaceTheme;
  roomCount: number;
  objectCount: number;
  objectIds: string[];
  active: boolean;
  onSelect: () => void;
}

function PalaceListItem({
  palaceId, name, theme, roomCount, objectCount, objectIds, active, onSelect,
}: PalaceListItemProps) {
  const reviews = usePalaceReviewStore((s) => s.reviews);
  const dueCount = useMemo(() => {
    const now = new Date();
    let n = 0;
    for (const oid of objectIds) {
      const r = reviews[reviewKey(palaceId, oid)] ?? null;
      if (isDue(r, now)) n++;
    }
    return n;
  }, [palaceId, objectIds, reviews]);

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-2 cursor-pointer border-l-2 ${
        active
          ? 'bg-cyan-50/50 border-cyan-500'
          : 'border-transparent hover:bg-gray-50 bg-transparent'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={`text-[12px] font-mono ${active ? 'text-cyan-800 font-semibold' : 'text-gray-700'} truncate`}>
          {name}
        </p>
        {dueCount > 0 && (
          <span
            className="text-[9px] font-mono font-semibold tracking-wider text-amber-800 bg-amber-100 border border-amber-200 rounded-full px-1.5 py-0.5 leading-none"
            title={`${dueCount} memories due for review`}
          >
            {dueCount} due
          </span>
        )}
      </div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mt-0.5">
        {themeLabel(theme)} · {roomCount}r · {objectCount}m
      </p>
    </button>
  );
}
