import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useTodoStore } from '@/store/todoStore';
import { useDefaultPageId } from '@/hooks/useDefaultPageId';

/**
 * ⌘K quick capture. Lands the thought in the page you're looking at when
 * you're inside a page; otherwise in the Today bucket (first root page).
 * Items go to the end of the page's first group.
 */
export function CaptureOverlay() {
  const open = useUIStore((s) => s.captureOpen);
  const openCapture = useUIStore((s) => s.openCapture);
  const closeCapture = useUIStore((s) => s.closeCapture);
  const activeView = useUIStore((s) => s.activeView);

  const currentTodoId = useTodoStore((s) => s.currentTodoId);
  const todoList = useTodoStore((s) => s.todoList);
  const defaultPageId = useDefaultPageId();

  const [text, setText] = useState('');
  const [flash, setFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const targetId = activeView === 'tasks' && currentTodoId ? currentTodoId : defaultPageId;
  const targetName = todoList.find((t) => t.id === targetId)?.name ?? '';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setText('');
        openCapture();
      }
      if (e.key === 'Escape') {
        setText('');
        closeCapture();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openCapture, closeCapture]);

  useEffect(() => {
    if (open) {
      // focus after the overlay paints
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || !targetId) return;

    const store = useTodoStore.getState();
    if (store.currentTodoId !== targetId) {
      await store.loadTodo(targetId);
    }
    const after = useTodoStore.getState();
    const firstGroup = after.todo.blocks.find(
      (b): b is Extract<typeof b, { type: 'group' }> => b.type === 'group'
    );
    const groupId = firstGroup ? firstGroup.data.id : null;
    if (groupId) {
      const itemId = after.addItem(groupId, trimmed);
      void itemId;
    } else {
      after.addGroupBlock('Inbox');
      const fresh = useTodoStore.getState();
      const created = fresh.todo.blocks.find(
        (b): b is Extract<typeof b, { type: 'group' }> => b.type === 'group'
      );
      if (created) fresh.addItem(created.data.id, trimmed);
    }

    setText('');
    setFlash(true);
    setTimeout(() => setFlash(false), 700);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[22vh]"
      style={{ background: 'color-mix(in srgb, var(--ink) 22%, transparent)', backdropFilter: 'blur(3px)' }}
      onMouseDown={() => { setText(''); closeCapture(); }}
    >
      <div
        className="w-[640px] max-w-[90vw] rounded-[18px] p-2.5"
        style={{
          background: 'var(--dock-bg)',
          boxShadow: '0 32px 80px -20px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.07)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span
            className="flex items-center justify-center rounded-[11px] px-3.5 self-stretch select-none"
            style={{
              background: flash ? 'var(--blue)' : 'var(--dock-logo)',
              color: '#F2EFE8',
              fontFamily: 'var(--font-display)',
              fontWeight: 880,
              fontSize: 16,
              transition: 'background .2s ease',
            }}
          >
            {flash ? '✓' : 'O.'}
          </span>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            placeholder="Capture a to do…"
            className="flex-1 bg-transparent border-none outline-none px-3 py-3.5 text-[15.5px] font-medium"
            style={{ color: '#F2EFE8' }}
          />
          <span className="o-dot text-[11px] pr-3 select-none" style={{ color: 'var(--dock-text)' }}>
            → {targetName || '…'}
          </span>
        </div>
      </div>
    </div>
  );
}
