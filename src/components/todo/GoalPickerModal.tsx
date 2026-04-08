import { useState, useRef, useEffect } from 'react';
import { Target, Search } from 'lucide-react';
import { useGoalStore } from '@/store/goalStore';

interface Props {
  onSelect: (goalId: string) => void;
  onClose: () => void;
}

export function GoalPickerModal({ onSelect, onClose }: Props) {
  const goals = useGoalStore((s) => s.goals);
  const [query, setQuery] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = goals.filter((g) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return g.title.toLowerCase().includes(q) || g.body.toLowerCase().includes(q);
  });

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      ref={modalRef}
      className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 min-w-[280px] max-w-[360px] overflow-hidden"
    >
      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
        <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <input
          ref={inputRef}
          className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-gray-300"
          placeholder="Search goals..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Goal list */}
      <div className="max-h-64 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <Target className="w-5 h-5 text-gray-200 mx-auto mb-1.5" />
            <p className="text-xs text-gray-400">
              {goals.length === 0 ? 'No goals created yet.' : 'No matching goals.'}
            </p>
          </div>
        ) : (
          filtered.map((goal) => (
            <button
              key={goal.id}
              onClick={() => onSelect(goal.id)}
              className="flex items-start gap-2.5 w-full px-3 py-2.5 text-left border-none bg-transparent cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <Target className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">
                  {goal.title || <span className="text-gray-400 italic">Untitled</span>}
                </p>
                {goal.body && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">{goal.body}</p>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
