import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Target, X } from 'lucide-react';
import { useGoalStore } from '@/store/goalStore';
import { useTodoStore } from '@/store/todoStore';
import { useUIStore } from '@/store/uiStore';
import type { GoalCardBlockData } from '@/types';

interface Props {
  block: GoalCardBlockData;
}

export function GoalCardBlock({ block }: Props) {
  const getGoalById = useGoalStore((s) => s.getGoalById);
  const removeBlock = useTodoStore((s) => s.removeBlock);
  const setActiveView = useUIStore((s) => s.setActiveView);
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
      <div ref={setNodeRef} style={style} className="mb-4 group relative">
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-3"
          style={{ background: 'var(--ink-04)', border: '1.5px dashed var(--ink-14)' }}
        >
          <Target className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--ink-28)' }} />
          <p className="m-0 text-sm flex-1" style={{ color: 'var(--ink-45)' }}>Goal not found — it may have been deleted.</p>
          <button
            onClick={() => removeBlock(block.id)}
            className="text-o-ink-28 hover:text-o-blue border-none bg-transparent cursor-pointer p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove block"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className="mb-4 group relative">
      {/* Drag handle */}
      <span
        className="absolute -left-6 top-3.5 text-o-ink-14 hover:text-o-ink-45 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        {...attributes}
        {...listeners}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/>
          <circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>
          <circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>
        </svg>
      </span>

      {/* Standing goal tile — sand, like the margin */}
      <div
        className="w-full rounded-[14px] px-4 py-3.5 relative cursor-pointer transition-transform hover:scale-[1.006]"
        style={{ background: 'var(--sand-soft)', border: '1px solid var(--ink-14)' }}
        onClick={() => setActiveView('goals')}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex items-center justify-center w-6 h-6 rounded-[8px] flex-shrink-0 mt-0.5"
            style={{ background: 'var(--sand)' }}
          >
            <Target className="w-3.5 h-3.5" style={{ color: 'var(--on-sand)' }} />
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <p
              className="m-0 text-[15px] leading-snug"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.005em', color: 'var(--ink)' }}
            >
              {goal.title || 'Untitled goal'}
            </p>
            {goal.body && (
              <div
                className="text-[12.5px] mt-1 line-clamp-2 leading-relaxed [&_p]:m-0 [&_*]:inline [&_br]:hidden"
                style={{ color: 'var(--ink-65)' }}
                dangerouslySetInnerHTML={{ __html: goal.body }}
              />
            )}
          </div>
        </div>

        {/* Remove button */}
        <button
          onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}
          className="absolute top-2.5 right-2.5 text-o-ink-28 hover:text-o-blue border-none bg-transparent cursor-pointer p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          title="Remove from page"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
