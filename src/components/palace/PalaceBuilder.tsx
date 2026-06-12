import { useMemo, useState } from 'react';
import { Castle, Users, ListOrdered, BookOpen, Square, Wand2, X } from 'lucide-react';
import type { PalaceTheme } from '@/types';
import { PALACE_THEMES, themeLabel } from './constants';
import { parseItems, buildPalaceData } from './builder';
import { usePalaceStore } from '@/store/palaceStore';

// Guided palace creation. Pick a use case, paste one item per line, and the
// builder generates the whole palace: themed rooms along a walking path, one
// locus per item, each pre-seeded with a vivid-image suggestion.

interface Template {
  id: string;
  label: string;
  icon: React.ReactNode;
  theme: PalaceTheme;
  namePlaceholder: string;
  hint: string;
  example: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'people',
    label: 'People',
    icon: <Users className="w-4 h-4" />,
    theme: 'castle',
    namePlaceholder: 'New office crew',
    hint: 'One person per line — name, then what to remember about them.',
    example: 'Sarah — Design lead, sits by the window, dog called Biscuit\nTom — Backend dev, triathlete, hates meetings before 10',
  },
  {
    id: 'steps',
    label: 'Steps & lists',
    icon: <ListOrdered className="w-4 h-4" />,
    theme: 'overworld',
    namePlaceholder: 'Presentation walkthrough',
    hint: 'One step per line, in the order you need to recall them.',
    example: 'Opening — hook with the Q3 churn number\nProblem — onboarding drop-off at step 3',
  },
  {
    id: 'facts',
    label: 'Facts & terms',
    icon: <BookOpen className="w-4 h-4" />,
    theme: 'lab',
    namePlaceholder: 'Spanish verbs',
    hint: 'One fact per line — term, then its meaning or definition.',
    example: 'mnemonic — memory aid technique\nloci — places; plural of locus',
  },
  {
    id: 'blank',
    label: 'Blank',
    icon: <Square className="w-4 h-4" />,
    theme: 'overworld',
    namePlaceholder: 'Untitled palace',
    hint: 'Start empty and build the map yourself.',
    example: '',
  },
];

interface PalaceBuilderProps {
  onClose: () => void;
  onCreated: () => void;
}

export function PalaceBuilder({ onClose, onCreated }: PalaceBuilderProps) {
  const createPalace = usePalaceStore((s) => s.createPalace);
  const createPalaceWithData = usePalaceStore((s) => s.createPalaceWithData);

  const [template, setTemplate] = useState<Template>(TEMPLATES[0]);
  const [name, setName] = useState('');
  const [theme, setTheme] = useState<PalaceTheme>(TEMPLATES[0].theme);
  const [itemsText, setItemsText] = useState('');
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => parseItems(itemsText), [itemsText]);
  const blank = template.id === 'blank';
  const canCreate = !busy && (blank || items.length > 0);

  const pickTemplate = (t: Template) => {
    setTemplate(t);
    setTheme(t.theme);
  };

  const handleCreate = async () => {
    if (!canCreate) return;
    setBusy(true);
    const palaceName = name.trim() || template.namePlaceholder;
    const id = blank
      ? await createPalace(palaceName, theme)
      : await createPalaceWithData(palaceName, theme, buildPalaceData(items, theme));
    setBusy(false);
    if (id) onCreated();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-gray-900/40 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 h-11 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Castle className="w-4 h-4 text-cyan-600" />
            <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-gray-700 font-semibold">
              Build a palace
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer p-1"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1.5">
              What do you want to remember?
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => pickTemplate(t)}
                  className={`flex flex-col items-center gap-1 rounded border px-2 py-2.5 cursor-pointer transition-colors text-[10px] font-mono uppercase tracking-wider ${
                    template.id === t.id
                      ? 'border-cyan-400 bg-cyan-50/60 text-cyan-800'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-cyan-200 hover:text-cyan-700'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1">
                Palace name
              </p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={template.namePlaceholder}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-[12px] font-mono text-gray-700 focus:border-cyan-300 focus:ring-1 focus:ring-cyan-200 outline-none"
              />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1">
                Theme
              </p>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as PalaceTheme)}
                className="text-[11px] font-mono uppercase tracking-wider text-gray-600 bg-white border border-gray-200 rounded px-2 py-1.5 cursor-pointer focus:border-cyan-300 outline-none"
              >
                {PALACE_THEMES.map((t) => (
                  <option key={t} value={t}>{themeLabel(t)}</option>
                ))}
              </select>
            </div>
          </div>

          {!blank && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1">
                Items — one per line
              </p>
              <textarea
                value={itemsText}
                onChange={(e) => setItemsText(e.target.value)}
                rows={8}
                placeholder={template.example}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-[12px] font-mono font-light text-gray-700 leading-relaxed focus:border-cyan-300 focus:ring-1 focus:ring-cyan-200 outline-none resize-none"
              />
              <p className="mt-1 text-[10px] font-mono text-gray-400">
                {template.hint}
                {items.length > 0 && (
                  <span className="text-cyan-700">
                    {' '}· {items.length} {items.length === 1 ? 'locus' : 'loci'} across ~
                    {Math.min(6, Math.max(1, Math.ceil(items.length / 4)))} rooms
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between">
          <p className="text-[10px] font-mono text-gray-400 max-w-[280px]">
            {blank
              ? 'You can add rooms and memories from the toolbar afterwards.'
              : 'Each item gets a locus with a suggested vivid image — edit them to make them yours.'}
          </p>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className={`flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider rounded px-3 py-1.5 transition-colors border ${
              canCreate
                ? 'text-white bg-cyan-600 hover:bg-cyan-700 border-cyan-600 cursor-pointer'
                : 'text-gray-400 bg-gray-100 border-gray-200 cursor-not-allowed'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            {busy ? 'Building…' : 'Build palace'}
          </button>
        </div>
      </div>
    </div>
  );
}
