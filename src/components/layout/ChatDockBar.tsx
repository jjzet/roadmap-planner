import { useState, useRef } from 'react';
import { ArrowUp } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useTodoStore } from '@/store/todoStore';
import { useChat } from '@/hooks/useChat';

export function ChatDockBar() {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const chatPanelOpen = useUIStore((s) => s.chatPanelOpen);
  const openChatPanel = useUIStore((s) => s.openChatPanel);
  const activeView = useUIStore((s) => s.activeView);
  const currentTodoId = useTodoStore((s) => s.currentTodoId);

  const activePageId = activeView === 'tasks' ? currentTodoId : null;

  const { sendMessage, isLoading } = useChat();

  const handleFocus = () => {
    if (!chatPanelOpen) openChatPanel();
  };

  const handleSubmit = () => {
    if (!draft.trim() || isLoading) return;
    sendMessage(draft.trim(), activePageId);
    setDraft('');
    if (!chatPanelOpen) openChatPanel();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="absolute bottom-10 left-0 right-0 h-10 bg-white/95 backdrop-blur border-t border-gray-200 flex items-center px-4 gap-2 z-[35]"
      style={{ boxShadow: '0 -1px 3px rgba(0,0,0,0.04)' }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full bg-cyan-500 flex-shrink-0 transition-opacity ${
          isLoading ? 'animate-pulse' : 'opacity-70'
        }`}
      />
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder="Ask Claude…"
        className="flex-1 bg-transparent border-none outline-none text-[12px] font-mono font-light text-gray-700 placeholder-gray-400 min-w-0"
        disabled={isLoading}
      />
      <button
        onClick={handleSubmit}
        disabled={!draft.trim() || isLoading}
        className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors bg-transparent border-none cursor-pointer p-0"
        title="Send (Enter)"
      >
        <ArrowUp className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
