import { TasksToolbar } from '../layout/TasksToolbar';
import { TodoListContent } from '../todo/TodoListContent';
import { CleanupPanel } from '../todo/CleanupPanel';
import { useTodoAutoSave } from '../../hooks/useTodoAutoSave';
import { useTodoStore } from '../../store/todoStore';
import { DailyInsightWidget } from '../dashboard/DailyInsightWidget';
import { useListCleanup } from '../../hooks/useListCleanup';

export function TasksView() {
  useTodoAutoSave();

  const isLoading = useTodoStore((s) => s.isLoading);
  const currentTodoId = useTodoStore((s) => s.currentTodoId);

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
      </div>
    </>
  );
}
