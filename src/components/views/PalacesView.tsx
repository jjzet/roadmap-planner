import { useMemo, useState } from 'react';
import { Castle, Plus, Trash2, Box, DoorOpen, Footprints } from 'lucide-react';
import { usePalaceStore } from '@/store/palaceStore';
import { PalaceMap } from '@/components/palace/PalaceMap';
import { PALACE_THEMES, themeLabel } from '@/components/palace/constants';
import { ObjectEditor } from '@/components/palace/ObjectEditor';
import { PalaceWalk } from '@/components/palace/PalaceWalk';
import { usePalaceReviewStore, reviewKey, isDue } from '@/store/palaceReviewStore';
import type { PalaceTheme } from '@/types';

export function PalacesView() {
  const palaces = usePalaceStore((s) => s.palaces);
  const currentPalaceId = usePalaceStore((s) => s.currentPalaceId);
  const selectedObjectId = usePalaceStore((s) => s.selectedObjectId);
  const isLoading = usePalaceStore((s) => s.isLoading);
  const selectPalace = usePalaceStore((s) => s.selectPalace);
  const selectObject = usePalaceStore((s) => s.selectObject);
  const createPalace = usePalaceStore((s) => s.createPalace);
  const renamePalace = usePalaceStore((s) => s.renamePalace);
  const setTheme = usePalaceStore((s) => s.setTheme);
  const deletePalace = usePalaceStore((s) => s.deletePalace);
  const addRoom = usePalaceStore((s) => s.addRoom);
  const addObject = usePalaceStore((s) => s.addObject);
  const updateObject = usePalaceStore((s) => s.updateObject);
  const removeObject = usePalaceStore((s) => s.removeObject);
  const removeRoom = usePalaceStore((s) => s.removeRoom);

  const palace = palaces.find((p) => p.id === currentPalaceId) ?? null;
  const selectedObject = palace?.data.objects.find((o) => o.id === selectedObjectId) ?? null;

  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [walkMode, setWalkMode] = useState(false);

  const handleNew = async () => {
    const name = window.prompt('Name your palace:', 'Untitled palace');
    if (!name?.trim()) return;
    await createPalace(name.trim());
  };

  const handleAddRoom = async () => {
    if (!palace) return;
    const name = window.prompt('Room name:', 'New room');
    if (!name?.trim()) return;
    await addRoom(palace.id, { name: name.trim() });
  };

  const handleAddObject = async () => {
    if (!palace) return;
    const name = window.prompt('Memory name:', 'New memory');
    if (!name?.trim()) return;
    await addObject(palace.id, { name: name.trim() });
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
                No palaces yet. Build a 2D map to anchor things you want to remember.
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
                {!walkMode && (
                  <>
                    <ToolbarButton onClick={handleAddRoom} icon={<DoorOpen className="w-3 h-3" />} label="Add room" />
                    <ToolbarButton onClick={handleAddObject} icon={<Box className="w-3 h-3" />} label="Add memory" />
                  </>
                )}
                <button
                  onClick={() => {
                    if (!walkMode) selectObject(null);
                    setWalkMode((v) => !v);
                  }}
                  className={`flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider rounded px-2 py-1 cursor-pointer transition-colors border ${
                    walkMode
                      ? 'text-cyan-800 bg-cyan-50 border-cyan-300'
                      : 'text-gray-600 hover:text-cyan-700 bg-white border-gray-200 hover:border-cyan-300 hover:bg-cyan-50/40'
                  }`}
                  title={walkMode ? 'Exit walk mode (Esc)' : 'Walk through this palace'}
                >
                  <Footprints className="w-3 h-3" />
                  {walkMode ? 'Exit walk' : 'Walk'}
                </button>
                {!walkMode && (
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

            {walkMode ? (
              <PalaceWalk key={palace.id} palace={palace} onExit={() => setWalkMode(false)} />
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
                    />
                    <p className="mt-2 text-[10px] font-mono uppercase tracking-wider text-gray-400">
                      {palace.data.width}×{palace.data.height} · {palace.data.rooms.length} rooms · {palace.data.objects.length} memories
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
    </div>
  );
}

function ToolbarButton({
  onClick, icon, label,
}: {
  onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-gray-600 hover:text-cyan-700 bg-white border border-gray-200 hover:border-cyan-300 hover:bg-cyan-50/40 rounded px-2 py-1 cursor-pointer transition-colors"
    >
      {icon}
      {label}
    </button>
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
