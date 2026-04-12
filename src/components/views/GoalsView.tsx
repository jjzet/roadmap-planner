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
  return new Date(dateStr).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
}

function GoalCard({ goal }: { goal: { id: string; title: string; body: string; updated_at: string } }) {
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
    <div className="bg-white rounded-xl border border-gray-100 hover:shadow-md transition-all duration-200 group/goal overflow-hidden">
      <div className="p-5">
        {/* Title */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <input
            ref={titleRef}
            className="flex-1 text-base font-semibold text-gray-800 bg-transparent border-none outline-none placeholder:text-gray-300 hover:bg-gray-50/50 focus:bg-gray-50 rounded px-1 -ml-1 transition-colors"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            placeholder="Untitled goal"
          />
          {/* Hover actions */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover/goal:opacity-100 transition-opacity flex-shrink-0">
            <button
              onClick={() => archiveGoal(goal.id)}
              className="text-gray-300 hover:text-gray-500 border-none bg-transparent cursor-pointer p-1 rounded transition-colors"
              title="Archive"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              className="text-gray-300 hover:text-red-500 border-none bg-transparent cursor-pointer p-1 rounded transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Body — rich text */}
        <div className="cursor-text rounded-lg px-1 -ml-1 py-1 min-h-[40px]">
          <RichTextEditor
            content={goal.body || ''}
            onBlur={handleBodySave}
            placeholder="Write about this goal… select text to format"
          />
        </div>

        {/* Footer */}
        <p className="text-[10px] text-gray-300 mt-3">
          Updated {formatRelativeTime(goal.updated_at)}
        </p>
      </div>
    </div>
  );
}

export function GoalsView() {
  const goals = useGoalStore((s) => s.goals);
  const isLoading = useGoalStore((s) => s.isLoading);
  const createGoal = useGoalStore((s) => s.createGoal);

  const handleNewGoal = async () => {
    await createGoal('');
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Goals</h1>
            <p className="text-sm text-gray-400 mt-1">Your goals and intentions. Pin them to any page to keep them front of mind.</p>
          </div>
          <button
            onClick={handleNewGoal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Goal
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="h-5 bg-gray-100 rounded-full animate-pulse w-32 mb-3" />
                <div className="h-3 bg-gray-100 rounded-full animate-pulse w-3/4 mb-1.5" />
                <div className="h-3 bg-gray-100 rounded-full animate-pulse w-1/2" />
              </div>
            ))}
          </div>
        ) : goals.length === 0 ? (
          <div className="text-center py-20">
            <Target className="w-10 h-10 text-gray-200 mx-auto mb-4" />
            <p className="text-base text-gray-400 font-medium">No goals yet</p>
            <p className="text-sm text-gray-300 mt-1 mb-6">Create your first goal to get started.</p>
            <button
              onClick={handleNewGoal}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors cursor-pointer border-none"
            >
              <Plus className="w-4 h-4" />
              New Goal
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {goals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
