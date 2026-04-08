import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Target, X } from 'lucide-react';
import { useGoalStore } from '@/store/goalStore';
import { useTodoStore } from '@/store/todoStore';
import type { GoalCardBlockData } from '@/types';

interface Props {
  block: GoalCardBlockData;
}

export function GoalCardBlock({ block }: Props) {
  const getGoalById = useGoalStore((s) => s.getGoalById);
  const removeBlock = useTodoStore((s) => s.removeBlock);
  const goal = getGoalById(block.goalId);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (!goal) {
    return (
      <div ref={setNodeRef} style={style} className="mb-4 group">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 border-dashed rounded-lg px-4 py-3">
          <Target className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
          <p className="text-sm text-gray-400 italic flex-1">Goal not found — it may have been deleted.</p>
          <button
            onClick={() => removeBlock(block.id)}
            className="text-gray-300 hover:text-red-500 border-none bg-transparent cursor-pointer p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove block"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className="mb-4 group">
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <span
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity mt-3 flex-shrink-0"
          {...attributes}
          {...listeners}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/>
            <circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>
            <circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>
          </svg>
        </span>

        {/* Card */}
        <div className="flex-1 bg-gradient-to-r from-amber-50/40 to-orange-50/20 border border-amber-100/50 rounded-lg px-4 py-3 relative">
          <div className="flex items-start gap-2.5">
            <Target className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-700 leading-snug">
                {goal.title || <span className="text-gray-400 italic font-normal">Untitled goal</span>}
              </p>
              {goal.body && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                  {goal.body}
                </p>
              )}
            </div>
          </div>

          {/* Remove button */}
          <button
            onClick={() => removeBlock(block.id)}
            className="absolute top-2 right-2 text-gray-300 hover:text-red-500 border-none bg-transparent cursor-pointer p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove from page"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
