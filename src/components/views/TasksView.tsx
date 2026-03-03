import { TasksToolbar } from '../layout/TasksToolbar';
import { TodoListContent } from '../todo/TodoListContent';
import { useTodoAutoSave } from '../../hooks/useTodoAutoSave';
import { useTodoStore } from '../../store/todoStore';

export function TasksView() {
  useTodoAutoSave();

  const isLoading = useTodoStore((s) => s.isLoading);
  const currentTodoId = useTodoStore((s) => s.currentTodoId);

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
      <TasksToolbar />
      <div className="flex-1 overflow-y-auto">
        <TodoListContent />
      </div>
    </>
  );
}
