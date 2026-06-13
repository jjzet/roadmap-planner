import { useState, useRef, useEffect } from 'react';
import { Plus, Archive, Trash2, Target } from 'lucide-react';
import { useGoalStore } from '@/store/goalStore';
import { RichTextEditor } from '@/components/editor/RichTextEditor';

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

function GoalCard({ goal, ordinal }: { goal: { id: string; title: string; body: string; updated_at: string }; ordinal: number }) {
  const updateGoal = useGoalStore((s) => s.updateGoal);
  const archiveGoal = useGoalStore((s) => s.archiveGoal);
  const deleteGoal = useGoalStore((s) => s.deleteGoal);

  const [title, setTitle] = useState(goal.title);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(goal.title);
  }, [goal.title]);

  const handleTitleBlur = () => {
    if (title !== goal.title) updateGoal(goal.id, { title });
  };

  const handleBodySave = (html: string) => {
    if (html !== (goal.body || '')) updateGoal(goal.id, { body: html });
  };

  const handleDelete = () => {
    if (window.confirm(`Delete "${goal.title || 'Untitled goal'}"? This cannot be undone.`)) {
      deleteGoal(goal.id);
    }
  };

  return (
    <div className="group/goal pt-8 mt-8" style={{ borderTop: '2px solid var(--ink)' }}>
      {/* Header row */}
      <div className="flex items-start gap-4 mb-3">
        <span
          className="o-dot text-[13px] rounded-[7px] px-2 pt-[5px] pb-1 leading-none select-none flex-shrink-0 mt-1.5"
          style={{ background: 'var(--sand)', color: 'var(--on-sand)', fontWeight: 900 }}
        >
          {String(ordinal).padStart(2, '0')}
        </span>
        <input
          ref={titleRef}
          className="flex-1 bg-transparent border-none outline-none uppercase"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 830,
            fontStretch: '110%',
            fontSize: 27,
            letterSpacing: '-0.015em',
            color: 'var(--ink)',
          }}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          placeholder="UNTITLED GOAL"
        />
        <div className="flex items-center gap-0.5 opacity-0 group-hover/goal:opacity-100 transition-opacity flex-shrink-0 mt-2">
          <button
            onClick={() => archiveGoal(goal.id)}
            className="text-o-ink-28 hover:text-o-blue border-none bg-transparent cursor-pointer p-1 rounded transition-colors"
            title="Archive"
          >
            <Archive className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            className="text-o-ink-28 hover:text-o-blue border-none bg-transparent cursor-pointer p-1 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body — the manifesto text */}
      <div className="cursor-text min-h-[40px] max-w-[760px] ml-12">
        <RichTextEditor
          content={goal.body || ''}
          onBlur={handleBodySave}
          placeholder="Write about this goal… select text to format"
        />
      </div>

      <p className="o-dot text-[10px] mt-4 ml-12" style={{ color: 'var(--ink-28)' }}>
        Updated {formatRelativeTime(goal.updated_at)}
      </p>
    </div>
  );
}

export function GoalsView() {
  const goals = useGoalStore((s) => s.goals);
  const isLoading = useGoalStore((s) => s.isLoading);
  const createGoal = useGoalStore((s) => s.createGoal);

  const active = goals.filter((g) => !g.archived);

  const handleNewGoal = async () => {
    await createGoal('');
  };

  return (
    <div className="o-scroll flex-1 overflow-y-auto">
      <div className="max-w-[1060px] mx-auto px-10 pt-9 pb-44 w-full">
        {/* Topline */}
        <div className="flex items-center justify-between pb-3" style={{ borderBottom: '2px solid var(--ink)' }}>
          <span className="text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <span className="o-dot text-[12.5px]" style={{ color: 'var(--ink-65)' }}>
            {active.length} STANDING
          </span>
        </div>

        <div className="flex items-end justify-between pt-7">
          <h1 className="o-display m-0" style={{ fontSize: 'clamp(44px, 7vw, 84px)', color: 'var(--ink)' }}>
            Goals
          </h1>
          <button
            onClick={handleNewGoal}
            className="flex items-center gap-2 mb-2 text-[14px] font-bold border-none cursor-pointer rounded-xl px-5 py-3"
            style={{ background: 'var(--blue)', color: 'var(--on-blue)' }}
          >
            <Plus className="w-4 h-4" />
            New goal
          </button>
        </div>
        <p className="m-0 mt-1 text-[14px] font-medium" style={{ color: 'var(--ink-45)' }}>
          Where you’re heading. The Board reads these before every note.
        </p>

        {/* Content */}
        {isLoading ? (
          <p className="o-dot text-[12px] pt-10" style={{ color: 'var(--ink-45)' }}>LOADING…</p>
        ) : active.length === 0 ? (
          <div className="text-center py-20">
            <Target className="w-10 h-10 mx-auto mb-4" style={{ color: 'var(--ink-14)' }} />
            <p className="text-base font-semibold m-0" style={{ color: 'var(--ink-65)' }}>No goals yet</p>
            <p className="text-sm m-0 mt-1 mb-6" style={{ color: 'var(--ink-45)' }}>Write the first one — the Board is waiting.</p>
            <button
              onClick={handleNewGoal}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-[13px] font-bold rounded-xl cursor-pointer border-none"
              style={{ background: 'var(--blue)', color: 'var(--on-blue)' }}
            >
              <Plus className="w-4 h-4" />
              New goal
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            {active.map((goal, i) => (
              <GoalCard key={goal.id} goal={goal} ordinal={i + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
