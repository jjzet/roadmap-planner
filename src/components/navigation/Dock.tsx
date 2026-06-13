import { useUIStore } from '@/store/uiStore';
import { useTodoStore } from '@/store/todoStore';
import type { ActiveView } from '@/types';

/** First root page = the daily driver ("Today" in the dock). */
export function useDefaultPageId(): string | null {
  const todoList = useTodoStore((s) => s.todoList);
  const roots = todoList.filter((t) => !t.parentId).sort((a, b) => a.orderIndex - b.orderIndex);
  return roots[0]?.id ?? null;
}

interface DockTab {
  key: ActiveView | 'today';
  label: string;
}

const TABS: DockTab[] = [
  { key: 'today', label: 'Today' },
  { key: 'pages', label: 'Pages' },
  { key: 'journal', label: 'Journal' },
  { key: 'library', label: 'Library' },
  { key: 'board', label: 'Board' },
];

export function Dock() {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const openCapture = useUIStore((s) => s.openCapture);
  const currentTodoId = useTodoStore((s) => s.currentTodoId);
  const loadTodo = useTodoStore((s) => s.loadTodo);
  const defaultPageId = useDefaultPageId();

  const isToday = activeView === 'tasks' && currentTodoId === defaultPageId;

  const isActive = (key: DockTab['key']) => {
    if (key === 'today') return isToday;
    if (key === 'pages') return activeView === 'pages' || (activeView === 'tasks' && !isToday);
    return activeView === key;
  };

  const handleTab = (key: DockTab['key']) => {
    if (key === 'today') {
      if (defaultPageId && currentTodoId !== defaultPageId) loadTodo(defaultPageId);
      setActiveView('tasks');
      return;
    }
    setActiveView(key as ActiveView);
  };

  return (
    <div className="fixed left-0 right-0 bottom-6 z-50 flex justify-center pointer-events-none">
      <nav
        className="pointer-events-auto flex items-stretch gap-2 rounded-[20px] p-2.5"
        style={{
          background: 'var(--dock-bg)',
          boxShadow: '0 24px 60px -16px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.07)',
        }}
      >
        <span
          className="flex items-center justify-center rounded-[13px] px-4 select-none"
          style={{
            background: 'var(--dock-logo)',
            color: '#F2EFE8',
            fontFamily: 'var(--font-display)',
            fontWeight: 880,
            fontSize: 19,
            letterSpacing: '-0.02em',
          }}
        >
          O.
        </span>

        {TABS.map(({ key, label }) => {
          const on = isActive(key);
          return (
            <button
              key={key}
              onClick={() => handleTab(key)}
              className="rounded-[13px] px-6 py-3.5 text-[14.5px] font-semibold cursor-pointer transition-colors border"
              style={{
                background: on ? 'var(--dock-on)' : 'var(--dock-tile)',
                borderColor: on ? 'rgba(255,255,255,.16)' : 'var(--dock-border)',
                color: on ? 'var(--dock-on-text)' : 'var(--dock-text)',
              }}
            >
              {label}
            </button>
          );
        })}

        <button
          onClick={openCapture}
          className="rounded-[13px] px-6 py-3.5 text-[14.5px] font-bold cursor-pointer border-none ml-1"
          style={{ background: 'var(--sand)', color: 'var(--on-sand)' }}
        >
          + Capture
        </button>

        <span
          className="o-dot flex items-center pl-1.5 pr-3 text-[12px] select-none"
          style={{ color: 'var(--dock-text)' }}
          title="Quick capture"
        >
          ⌘K
        </span>
      </nav>
    </div>
  );
}
