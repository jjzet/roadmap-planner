import { useState, useEffect, useRef, useCallback } from 'react';
import { Type, ListChecks, Minus, Heading1, Heading2, Heading3, Target } from 'lucide-react';

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  keywords: string[];
}

const COMMANDS: SlashCommand[] = [
  {
    id: 'text',
    label: 'Text',
    description: 'Plain text block',
    icon: <Type className="w-4 h-4" />,
    keywords: ['text', 'paragraph', 'plain'],
  },
  {
    id: 'heading1',
    label: 'Heading 1',
    description: 'Large section heading',
    icon: <Heading1 className="w-4 h-4" />,
    keywords: ['heading', 'h1', 'title', 'large'],
  },
  {
    id: 'heading2',
    label: 'Heading 2',
    description: 'Medium section heading',
    icon: <Heading2 className="w-4 h-4" />,
    keywords: ['heading', 'h2', 'subtitle', 'medium'],
  },
  {
    id: 'heading3',
    label: 'Heading 3',
    description: 'Small section heading',
    icon: <Heading3 className="w-4 h-4" />,
    keywords: ['heading', 'h3', 'small'],
  },
  {
    id: 'group',
    label: 'Task Group',
    description: 'Checklist with tasks',
    icon: <ListChecks className="w-4 h-4" />,
    keywords: ['group', 'todo', 'checklist', 'tasks'],
  },
  {
    id: 'divider',
    label: 'Divider',
    description: 'Horizontal separator line',
    icon: <Minus className="w-4 h-4" />,
    keywords: ['divider', 'separator', 'line', 'hr'],
  },
  {
    id: 'goal_card',
    label: 'Goal Card',
    description: 'Embed a goal from your goals page',
    icon: <Target className="w-4 h-4" />,
    keywords: ['goal', 'card', 'objective', 'target', 'embed'],
  },
];

interface Props {
  query: string; // text after the slash, e.g. "te" for "/te"
  onSelect: (commandId: string) => void;
  onClose: () => void;
}

export function SlashCommandMenu({ query, onSelect, onClose }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = COMMANDS.filter((cmd) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.id.toLowerCase().includes(q) ||
      cmd.keywords.some((kw) => kw.includes(q))
    );
  });

  // Reset active index when filtered results change
  useEffect(() => {
    setActiveIndex(0);
  }, [filtered.length]);

  // Keyboard nav
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[activeIndex]) {
          onSelect(filtered[activeIndex].id);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, activeIndex, onSelect, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Scroll active item into view
  useEffect(() => {
    const activeEl = menuRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (filtered.length === 0) {
    return (
      <div
        ref={menuRef}
        className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl py-2 px-3 z-50 min-w-[220px]"
      >
        <p className="text-sm text-gray-400">No matching commands</p>
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-50 min-w-[240px] max-h-[280px] overflow-y-auto"
    >
      <div className="px-3 py-1.5">
        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Blocks</p>
      </div>
      {filtered.map((cmd, i) => (
        <button
          key={cmd.id}
          data-index={i}
          onClick={() => onSelect(cmd.id)}
          onMouseEnter={() => setActiveIndex(i)}
          className={`flex items-center gap-3 w-full px-3 py-2 text-left border-none cursor-pointer transition-colors ${
            i === activeIndex
              ? 'bg-blue-50 text-blue-700'
              : 'bg-transparent text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span
            className={`flex items-center justify-center w-8 h-8 rounded-md border ${
              i === activeIndex
                ? 'bg-blue-100 border-blue-200 text-blue-600'
                : 'bg-gray-50 border-gray-200 text-gray-500'
            }`}
          >
            {cmd.icon}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{cmd.label}</p>
            <p className="text-xs text-gray-400 truncate">{cmd.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
