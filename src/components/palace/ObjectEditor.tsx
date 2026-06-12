import { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import type { MemoryPalaceData, PalaceObject, PalaceObjectIcon } from '@/types';
import { PixelSprite } from './PixelSprite';
import { PALACE_ICONS, PALACE_OBJECT_COLORS } from './constants';

interface ObjectEditorProps {
  object: PalaceObject;
  data: MemoryPalaceData;
  onPatch: (patch: Partial<PalaceObject>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ObjectEditor({ object, data, onPatch, onDelete, onClose }: ObjectEditorProps) {
  const [name, setName] = useState(object.name);
  const [content, setContent] = useState(object.content);
  const [imagery, setImagery] = useState(object.imagery ?? '');
  const [link, setLink] = useState(object.link ?? '');

  useEffect(() => {
    setName(object.name);
    setContent(object.content);
    setImagery(object.imagery ?? '');
    setLink(object.link ?? '');
  }, [object.id, object.name, object.content, object.imagery, object.link]);

  // Debounced flush of text fields → parent → store → supabase.
  useEffect(() => {
    const t = setTimeout(() => {
      const patch: Partial<PalaceObject> = {};
      if (name !== object.name) patch.name = name;
      if (content !== object.content) patch.content = content;
      const imageryClean = imagery.trim() ? imagery.trim() : undefined;
      if (imageryClean !== object.imagery) patch.imagery = imageryClean;
      const linkClean = link.trim() ? link.trim() : undefined;
      if (linkClean !== object.link) patch.link = linkClean;
      if (Object.keys(patch).length) onPatch(patch);
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, content, imagery, link]);

  const room = object.roomId ? data.rooms.find((r) => r.id === object.roomId) : null;

  return (
    <div className="w-72 flex-shrink-0 bg-white border border-gray-200 rounded-md shadow-sm flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 h-9 border-b border-gray-100 bg-gradient-to-r from-white to-cyan-50/30">
        <div className="flex items-center gap-2">
          <PixelSprite icon={object.icon} color={object.color} size={16} />
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-700 font-semibold">
            Memory
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer p-1"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-transparent border border-gray-200 rounded px-2 py-1 text-[12px] font-mono text-gray-700 focus:border-cyan-300 focus:ring-1 focus:ring-cyan-200 outline-none"
            placeholder="What's this memory?"
          />
        </Field>

        <Field label="Memory">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="w-full bg-transparent border border-gray-200 rounded px-2 py-1.5 text-[12px] font-mono font-light text-gray-700 leading-relaxed focus:border-cyan-300 focus:ring-1 focus:ring-cyan-200 outline-none resize-none"
            placeholder="The thing to remember…"
          />
        </Field>

        <Field label="Vivid image">
          <textarea
            value={imagery}
            onChange={(e) => setImagery(e.target.value)}
            rows={3}
            className="w-full bg-amber-50/40 border border-amber-100 rounded px-2 py-1.5 text-[11px] font-mono font-light text-amber-900 leading-relaxed focus:border-amber-300 focus:ring-1 focus:ring-amber-200 outline-none resize-none"
            placeholder="Picture something absurd linking this spot to the memory — the weirder, the stickier."
          />
        </Field>

        <Field label="Link (optional)">
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className="w-full bg-transparent border border-gray-200 rounded px-2 py-1 text-[11px] font-mono font-light text-gray-700 focus:border-cyan-300 focus:ring-1 focus:ring-cyan-200 outline-none"
            placeholder="https://…"
          />
        </Field>

        <Field label="Icon">
          <div className="grid grid-cols-8 gap-1">
            {PALACE_ICONS.map((ic: PalaceObjectIcon) => (
              <button
                key={ic}
                onClick={() => onPatch({ icon: ic })}
                className={`p-0.5 rounded border ${
                  object.icon === ic
                    ? 'border-cyan-400 bg-cyan-50'
                    : 'border-transparent hover:border-gray-200'
                } bg-transparent cursor-pointer`}
                title={ic}
              >
                <PixelSprite icon={ic} color={object.color} size={20} />
              </button>
            ))}
          </div>
        </Field>

        <Field label="Colour">
          <div className="flex flex-wrap gap-1">
            {PALACE_OBJECT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onPatch({ color: c })}
                className={`w-5 h-5 rounded-sm border-2 cursor-pointer ${
                  object.color === c ? 'border-gray-700' : 'border-transparent'
                }`}
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
        </Field>

        <Field label="Position">
          <div className="grid grid-cols-2 gap-2">
            <NumInput
              label="x"
              value={object.x}
              min={0}
              max={data.width - 1}
              onChange={(n) => onPatch({ x: n })}
            />
            <NumInput
              label="y"
              value={object.y}
              min={0}
              max={data.height - 1}
              onChange={(n) => onPatch({ y: n })}
            />
          </div>
          <p className="mt-1 text-[10px] font-mono text-gray-400">
            Room: {room?.name ?? '—'}
          </p>
        </Field>
      </div>

      <div className="border-t border-gray-100 px-3 py-2">
        <button
          onClick={onDelete}
          className="w-full flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-red-500 hover:text-red-700 bg-transparent border border-red-100 hover:border-red-200 rounded py-1.5 cursor-pointer transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          Delete
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1">
        {label}
      </p>
      {children}
    </div>
  );
}

function NumInput({
  label, value, min, max, onChange,
}: {
  label: string; value: number; min: number; max: number; onChange: (n: number) => void;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
        }}
        className="flex-1 bg-transparent border border-gray-200 rounded px-1.5 py-0.5 text-[11px] font-mono text-gray-700 focus:border-cyan-300 focus:ring-1 focus:ring-cyan-200 outline-none"
      />
    </label>
  );
}
