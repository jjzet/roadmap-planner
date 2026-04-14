import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTodoStore } from '@/store/todoStore';
import type { HeadingBlock } from '@/types';
import { useRef, useEffect } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';

interface Props {
  block: HeadingBlock;
}

// HUD/tech aesthetic: mono uppercase tracked headings, sized down to feel like
// instrument panel labels rather than chunky document titles.
const HEADING_STYLES: Record<number, string> = {
  1: 'text-[15px] font-mono font-semibold uppercase tracking-[0.18em] text-gray-800',
  2: 'text-[12px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-700',
  3: 'text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-gray-600',
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

  // Auto-focus new empty headings
  useEffect(() => {
    if (!block.content && inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <div ref={setNodeRef} style={style} className="mb-4 group">
      <div className="flex items-center gap-2">
        <span
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </span>

        <input
          ref={inputRef}
          className={`flex-1 bg-transparent border-none outline-none placeholder:text-gray-300 ${HEADING_STYLES[block.level] || HEADING_STYLES[2]}`}
          placeholder={PLACEHOLDER[block.level] || 'Heading'}
          value={block.content}
          onChange={(e) => updateHeadingBlock(block.id, e.target.value)}
        />

        <button
          onClick={() => removeBlock(block.id)}
          className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity border-none bg-transparent cursor-pointer p-0 flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
