import { useState } from 'react';
import { useTodoStore } from '../../store/todoStore';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { TOOLBAR_HEIGHT } from '../../lib/constants';

interface Props {
  onCleanup?: () => void;
  isAnalysing?: boolean;
  cleanupVisible?: boolean;
}

export function TasksToolbar({ onCleanup, isAnalysing, cleanupVisible }: Props) {
  const todoName = useTodoStore((s) => s.todoName);
  const renameTodo = useTodoStore((s) => s.renameTodo);
  const saveStatus = useTodoStore((s) => s.saveStatus);
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(todoName);

  const handleNameClick = () => {
    setNameInput(todoName);
    setIsEditing(true);
  };

  const handleNameBlur = () => {
    setIsEditing(false);
    if (nameInput.trim() && nameInput !== todoName) {
      renameTodo(nameInput.trim());
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div
      className="flex items-center gap-3 px-4 border-b border-gray-200 bg-white"
      style={{ height: TOOLBAR_HEIGHT }}
    >
      <SidebarTrigger />

      {/* Divider */}
      <div className="h-6 w-px bg-gray-200" />

      {/* Todo list name */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 tech-glow flex-shrink-0" />
        <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.2em] text-gray-400 flex-shrink-0">Page</span>
        {isEditing ? (
          <input
            className="text-base font-semibold px-2 py-0.5 border border-cyan-400 rounded-sm outline-none"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            autoFocus
          />
        ) : (
          <h1
            className="text-base font-semibold text-gray-800 cursor-pointer hover:text-cyan-600 truncate max-w-64"
            onClick={handleNameClick}
            title="Click to rename"
          >
            {todoName}
          </h1>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Review button */}
      {onCleanup && (
        <button
          onClick={onCleanup}
          disabled={isAnalysing || cleanupVisible}
          className="text-[10px] font-mono uppercase tracking-wider text-gray-400 hover:text-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border-none bg-transparent cursor-pointer px-2 py-1 rounded-sm hover:bg-cyan-50/40"
        >
          {isAnalysing ? 'Reviewing…' : 'Review'}
        </button>
      )}

      {/* Save status */}
      <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400 w-20 text-right">
        {saveStatus === 'saving' && 'saving…'}
        {saveStatus === 'saved' && 'saved'}
        {saveStatus === 'error' && 'error'}
      </div>
    </div>
  );
}
