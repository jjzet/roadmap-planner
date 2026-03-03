import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTodoStore } from '@/store/todoStore';
import type { DividerBlock } from '@/types';
import { GripVertical, Trash2 } from 'lucide-react';

interface Props {
  block: DividerBlock;
}

export function DividerBlockRow({ block }: Props) {
  const removeBlock = useTodoStore((s) => s.removeBlock);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-4 group">
      <div className="flex items-center gap-2 py-2">
        <span
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </span>

        <div className="flex-1 h-px bg-gray-200" />

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
