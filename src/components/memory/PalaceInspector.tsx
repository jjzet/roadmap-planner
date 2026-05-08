import { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import type { MemoryPalace, PalaceObject, PalaceRoom } from '@/types';
import { useMemoryPalaceStore } from '@/store/memoryPalaceStore';

const SPRITE_OPTIONS = ['📜', '🔑', '⚔️', '🛡️', '🔮', '📕', '🪬', '🕯️', '🗝️', '⚙️', '🌱', '🌟', '💎', '🧭', '🪙', '🎯', '🧠', '🪐', '🪞', '🗿'];
const ROOM_COLORS = ['#7c5e3c', '#3d6a8b', '#6b4a7c', '#3c8b62', '#a35a4a', '#bf9000', '#475569', '#9d174d'];

interface Props {
  palace: MemoryPalace;
  selectedObjectId: string | null;
  selectedRoomId: string | null;
  onClearSelection: () => void;
}

export function PalaceInspector({ palace, selectedObjectId, selectedRoomId, onClearSelection }: Props) {
  const updateObject = useMemoryPalaceStore((s) => s.updateObject);
  const deleteObject = useMemoryPalaceStore((s) => s.deleteObject);
  const updateRoom = useMemoryPalaceStore((s) => s.updateRoom);
  const deleteRoom = useMemoryPalaceStore((s) => s.deleteRoom);

  const obj = selectedObjectId ? palace.objects.find((o) => o.id === selectedObjectId) : null;
  const room = selectedRoomId ? palace.rooms.find((r) => r.id === selectedRoomId) : null;

  if (obj) {
    return (
      <ObjectInspector
        palaceId={palace.id}
        obj={obj}
        onClose={onClearSelection}
        onUpdate={(patch) => updateObject(palace.id, obj.id, patch)}
        onDelete={() => {
          deleteObject(palace.id, obj.id);
          onClearSelection();
        }}
      />
    );
  }

  if (room) {
    return (
      <RoomInspector
        room={room}
        onClose={onClearSelection}
        onUpdate={(patch) => updateRoom(palace.id, room.id, patch)}
        onDelete={() => {
          deleteRoom(palace.id, room.id);
          onClearSelection();
        }}
      />
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4">
      <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-2">Inspector</p>
      <p className="text-[12px] font-mono font-light text-gray-500 leading-relaxed">
        Click a room or object on the map to inspect.<br />
        Click an empty tile to drop a new object there.
      </p>
    </div>
  );
}

function ObjectInspector({
  obj,
  onClose,
  onUpdate,
  onDelete,
}: {
  palaceId: string;
  obj: PalaceObject;
  onClose: () => void;
  onUpdate: (patch: Partial<PalaceObject>) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(obj.label);
  const [note, setNote] = useState(obj.note);
  const [sprite, setSprite] = useState(obj.sprite);

  useEffect(() => {
    setLabel(obj.label);
    setNote(obj.note);
    setSprite(obj.sprite);
  }, [obj.id]);

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono uppercase tracking-wider text-cyan-600 font-semibold">Object</p>
        <button
          onClick={onClose}
          className="text-gray-300 hover:text-gray-600 bg-transparent border-none cursor-pointer p-0.5 transition-colors"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1.5">Sprite</p>
        <div className="flex flex-wrap gap-1">
          {SPRITE_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setSprite(s);
                onUpdate({ sprite: s });
              }}
              className={`w-7 h-7 flex items-center justify-center rounded-sm border text-base cursor-pointer transition-all ${
                s === sprite ? 'border-cyan-500 bg-cyan-50' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
              type="button"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1.5">Label</p>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label !== obj.label && onUpdate({ label })}
          placeholder="e.g. The locked chest"
          className="w-full text-[12px] font-mono text-gray-700 bg-gray-50 border border-gray-200 rounded-sm px-2 py-1.5 outline-none focus:border-cyan-300 focus:ring-1 focus:ring-cyan-200"
        />
      </div>

      <div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1.5">Memory note</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== obj.note && onUpdate({ note })}
          rows={4}
          placeholder="What does this object stand for?"
          className="w-full text-[12px] font-mono font-light text-gray-700 bg-gray-50 border border-gray-200 rounded-sm px-2 py-1.5 outline-none resize-none focus:border-cyan-300 focus:ring-1 focus:ring-cyan-200 leading-relaxed"
        />
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 pt-1">
        <span>
          tile {obj.x},{obj.y}
        </span>
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1 text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          remove
        </button>
      </div>
    </div>
  );
}

function RoomInspector({
  room,
  onClose,
  onUpdate,
  onDelete,
}: {
  room: PalaceRoom;
  onClose: () => void;
  onUpdate: (patch: Partial<PalaceRoom>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(room.name);
  const [note, setNote] = useState(room.note ?? '');

  useEffect(() => {
    setName(room.name);
    setNote(room.note ?? '');
  }, [room.id]);

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono uppercase tracking-wider text-cyan-600 font-semibold">Room</p>
        <button
          onClick={onClose}
          className="text-gray-300 hover:text-gray-600 bg-transparent border-none cursor-pointer p-0.5 transition-colors"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1.5">Name</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== room.name && onUpdate({ name })}
          placeholder="Foyer"
          className="w-full text-[12px] font-mono text-gray-700 bg-gray-50 border border-gray-200 rounded-sm px-2 py-1.5 outline-none focus:border-cyan-300 focus:ring-1 focus:ring-cyan-200"
        />
      </div>

      <div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1.5">Floor color</p>
        <div className="flex flex-wrap gap-1">
          {ROOM_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onUpdate({ color: c })}
              className={`w-6 h-6 rounded-sm border-2 cursor-pointer ${
                c === room.color ? 'border-cyan-500' : 'border-gray-200'
              }`}
              style={{ background: c }}
              type="button"
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1.5">What lives here?</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== (room.note ?? '') && onUpdate({ note })}
          rows={3}
          placeholder="The theme this room holds…"
          className="w-full text-[12px] font-mono font-light text-gray-700 bg-gray-50 border border-gray-200 rounded-sm px-2 py-1.5 outline-none resize-none focus:border-cyan-300 focus:ring-1 focus:ring-cyan-200 leading-relaxed"
        />
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 pt-1">
        <span>
          {room.w}×{room.h} at ({room.x},{room.y})
        </span>
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1 text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          remove
        </button>
      </div>
    </div>
  );
}
