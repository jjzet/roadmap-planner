import { useState } from 'react';
import { Sparkles } from 'lucide-react';
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
      {isEditing ? (
        <input
          className="text-lg font-semibold px-2 py-1 border border-blue-400 rounded outline-none"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={handleNameKeyDown}
          autoFocus
        />
      ) : (
        <h1
          className="text-lg font-semibold cursor-pointer hover:text-blue-600 truncate max-w-64"
          onClick={handleNameClick}
          title="Click to rename"
        >
          {todoName}
        </h1>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Tidy up button */}
      {onCleanup && (
        <button
          onClick={onCleanup}
          disabled={isAnalysing || cleanupVisible}
          title="Tidy up — AI list cleanup"
          className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border-none bg-transparent cursor-pointer px-2 py-1 rounded hover:bg-gray-50"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isAnalysing ? 'animate-pulse' : ''}`} />
          <span className="hidden sm:inline">{isAnalysing ? 'Analysing…' : 'Tidy up'}</span>
        </button>
      )}

      {/* Save status */}
      <div className="text-xs text-gray-400 w-16 text-right">
        {saveStatus === 'saving' && 'Saving...'}
        {saveStatus === 'saved' && 'Saved'}
        {saveStatus === 'error' && 'Error'}
      </div>
    </div>
  );
}
