import { TodoListContent } from '../todo/TodoListContent';
import { PageMasthead } from '../daily/PageMasthead';
import { InsightBand } from '../daily/InsightBand';
import { MarginColumn } from '../daily/MarginColumn';
import { useTodoStore } from '../../store/todoStore';
import { useUIStore } from '../../store/uiStore';
import { FileText, Plus } from 'lucide-react';

export function TasksView() {
  const isLoading = useTodoStore((s) => s.isLoading);
  const currentTodoId = useTodoStore((s) => s.currentTodoId);
  const todoList = useTodoStore((s) => s.todoList);
  const loadTodo = useTodoStore((s) => s.loadTodo);
  const createSubPage = useTodoStore((s) => s.createSubPage);
  const setActiveView = useUIStore((s) => s.setActiveView);

  const subPages = currentTodoId
    ? todoList.filter((t) => t.parentId === currentTodoId)
    : [];

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="o-dot text-[12px]" style={{ color: 'var(--ink-45)' }}>LOADING PAGE…</span>
      </div>
    );
  }

  if (!currentTodoId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-[15px] mb-3" style={{ color: 'var(--ink-45)' }}>No page selected.</p>
          <button
            onClick={() => setActiveView('pages')}
            className="text-[14px] font-bold border-none cursor-pointer rounded-xl px-5 py-2.5"
            style={{ background: 'var(--blue)', color: 'var(--on-blue)' }}
          >
            Open Pages
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="o-scroll flex-1 overflow-y-auto">
      <div className="max-w-[1180px] mx-auto px-10 pt-9 pb-44 w-full">
        <PageMasthead />

        <InsightBand />

        {/* Spread: list + margin */}
        <div className="flex gap-14 pt-2">
          <div className="flex-1 min-w-0 pt-6">
            <TodoListContent />

            {/* Sub-pages */}
            <div className="mt-10 pt-6" style={{ borderTop: '1px solid var(--ink-14)' }}>
              <div className="flex items-center gap-3 mb-3">
                <span className="o-dot text-[11px]" style={{ color: 'var(--ink-45)' }}>Sub-pages</span>
                <button
                  onClick={async () => {
                    const name = prompt('Enter sub-page name:');
                    if (name?.trim() && currentTodoId) {
                      await createSubPage(currentTodoId, name.trim());
                      setActiveView('tasks');
                    }
                  }}
                  className="flex items-center gap-1 text-[11.5px] font-semibold text-o-ink-28 hover:text-o-blue border-none bg-transparent cursor-pointer px-0 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>
              {subPages.length === 0 ? (
                <p className="o-dot text-[10px]" style={{ color: 'var(--ink-28)' }}>None yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {subPages.map((page) => (
                    <button
                      key={page.id}
                      onClick={() => { loadTodo(page.id); setActiveView('tasks'); }}
                      className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-left transition-all cursor-pointer group hover:scale-[1.015]"
                      style={{ background: 'var(--paper-raise)', border: '1px solid var(--ink-14)' }}
                    >
                      <FileText className="w-3.5 h-3.5 flex-shrink-0 text-o-ink-45 group-hover:text-o-blue transition-colors" />
                      <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                        {page.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <MarginColumn />
        </div>
      </div>
    </div>
  );
}
