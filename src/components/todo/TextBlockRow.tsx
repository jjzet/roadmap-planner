import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTodoStore } from '@/store/todoStore';
import type { TextBlock } from '@/types';
import { useRef, useEffect, useCallback } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';

interface Props {
  block: TextBlock;
}

export function TextBlockRow({ block }: Props) {
  const updateTextBlock = useTodoStore((s) => s.updateTextBlock);
  const removeBlock = useTodoStore((s) => s.removeBlock);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  }, []);

  useEffect(() => {
    autoResize();
  }, [block.content, autoResize]);

  return (
    <div ref={setNodeRef} style={style} className="mb-4 group">
      <div className="flex items-start gap-2">
        <span
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex-shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </span>

        <textarea
          ref={textareaRef}
          className="flex-1 text-base leading-relaxed text-gray-700 bg-transparent border-none outline-none resize-none placeholder:text-gray-300 min-h-[1.75rem]"
          style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
          placeholder="Type something..."
          value={block.content}
          onChange={(e) => {
            updateTextBlock(block.id, e.target.value);
            autoResize();
          }}
          rows={1}
        />

        <button
          onClick={() => removeBlock(block.id)}
          className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity border-none bg-transparent cursor-pointer p-0 flex-shrink-0 mt-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
