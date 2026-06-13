import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTodoStore } from '@/store/todoStore';
import type { HeadingBlock } from '@/types';
import { useRef, useEffect } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';

interface Props {
  block: HeadingBlock;
}

// Page section headings — condensed Archivo, sized by level. H1 marks the big
// chapters of a page ("London Migration"), H2/H3 step down.
const HEADING_STYLES: Record<number, React.CSSProperties> = {
  1: { fontFamily: 'var(--font-display)', fontWeight: 850, fontStretch: '110%', fontSize: 26, letterSpacing: '0.01em', textTransform: 'uppercase', color: 'var(--ink)' },
  2: { fontFamily: 'var(--font-display)', fontWeight: 800, fontStretch: '105%', fontSize: 19, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--ink)' },
  3: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-65)' },
};

const PLACEHOLDER: Record<number, string> = {
  1: 'Heading 1',
  2: 'Heading 2',
  3: 'Heading 3',
};

export function HeadingBlockRow({ block }: Props) {
  const updateHeadingBlock = useTodoStore((s) => s.updateHeadingBlock);
  const removeBlock = useTodoStore((s) => s.removeBlock);
  const inputRef = useRef<HTMLInputElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  useEffect(() => {
    if (!block.content && inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <div ref={setNodeRef} style={style} className="mt-10 mb-5 group">
      <div className="flex items-center gap-2">
        <span
          className="text-o-ink-14 hover:text-o-ink-45 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </span>

        <input
          ref={inputRef}
          className="flex-1 bg-transparent border-none outline-none"
          style={{ ...HEADING_STYLES[block.level] || HEADING_STYLES[2] }}
          placeholder={PLACEHOLDER[block.level] || 'Heading'}
          value={block.content}
          onChange={(e) => updateHeadingBlock(block.id, e.target.value)}
        />

        <button
          onClick={() => removeBlock(block.id)}
          className="text-o-ink-28 hover:text-o-blue opacity-0 group-hover:opacity-100 transition-opacity border-none bg-transparent cursor-pointer p-0 flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
