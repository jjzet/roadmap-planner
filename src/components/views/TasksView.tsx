import { TasksToolbar } from '../layout/TasksToolbar';
import { TodoListContent } from '../todo/TodoListContent';
import { CleanupPanel } from '../todo/CleanupPanel';
import { useTodoAutoSave } from '../../hooks/useTodoAutoSave';
import { useTodoStore } from '../../store/todoStore';
import { useUIStore } from '../../store/uiStore';
import { DailyInsightWidget } from '../dashboard/DailyInsightWidget';
import { useListCleanup } from '../../hooks/useListCleanup';
import { FileText, Plus } from 'lucide-react';

export function TasksView() {
  useTodoAutoSave();

  const isLoading = useTodoStore((s) => s.isLoading);
  const currentTodoId = useTodoStore((s) => s.currentTodoId);
  const todoList = useTodoStore((s) => s.todoList);
  const loadTodo = useTodoStore((s) => s.loadTodo);
  const createSubPage = useTodoStore((s) => s.createSubPage);
  const setActiveView = useUIStore((s) => s.setActiveView);

  const subPages = currentTodoId
    ? todoList.filter((t) => t.parentId === currentTodoId)
    : [];

  const { suggestions, isAnalysing, error, isDone, analyse, applySelected, dismiss } =
    useListCleanup();

  const panelVisible = isAnalysing || isDone;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading page...</div>
      </div>
    );
  }

  if (!currentTodoId) {
    return (
      <>
        <TasksToolbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500 text-sm">
            Select or create a page from the sidebar.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TasksToolbar
        onCleanup={analyse}
        isAnalysing={isAnalysing}
        cleanupVisible={panelVisible}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-5 pb-0">
          <DailyInsightWidget />
          {panelVisible && (
            <CleanupPanel
              suggestions={suggestions}
              isAnalysing={isAnalysing}
              error={error}
              isDone={isDone}
              onApply={applySelected}
              onDismiss={dismiss}
            />
          )}
        </div>
        <TodoListContent />

        {/* Sub-pages section */}
        <div className="px-8 pb-8">
          <div className="mt-2 border-t border-gray-100 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400 font-semibold">Sub-pages</span>
              <button
                onClick={async () => {
                  const name = prompt('Enter sub-page name:');
                  if (name?.trim() && currentTodoId) {
                    await createSubPage(currentTodoId, name.trim());
                    setActiveView('tasks');
                  }
                }}
                className="ml-1 flex items-center gap-1 text-[10px] text-gray-400 hover:text-cyan-600 border-none bg-transparent cursor-pointer px-0"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>
            {subPages.length === 0 ? (
              <p className="text-xs text-gray-300 font-mono">No sub-pages yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {subPages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => { loadTodo(page.id); setActiveView('tasks'); }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-cyan-50 hover:border-cyan-200 text-left transition-colors cursor-pointer group"
                  >
                    <FileText className="w-3.5 h-3.5 text-gray-400 group-hover:text-cyan-500 flex-shrink-0" />
                    <span className="text-xs font-mono text-gray-700 group-hover:text-cyan-700 truncate">{page.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
