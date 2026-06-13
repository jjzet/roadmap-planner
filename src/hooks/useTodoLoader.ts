import { useEffect } from 'react';
import { useTodoStore } from '../store/todoStore';

export function useTodoLoader() {
  const fetchTodoList = useTodoStore((s) => s.fetchTodoList);
  const loadTodo = useTodoStore((s) => s.loadTodo);
  const todoList = useTodoStore((s) => s.todoList);
  const currentTodoId = useTodoStore((s) => s.currentTodoId);
  const isLoading = useTodoStore((s) => s.isLoading);

  useEffect(() => {
    fetchTodoList();
  }, [fetchTodoList]);

  useEffect(() => {
    if (!currentTodoId && todoList.length > 0 && !isLoading) {
      // Open on the Today bucket: first root page by order, not most-recent.
      const roots = todoList
        .filter((t) => !t.parentId)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      loadTodo((roots[0] ?? todoList[0]).id);
    }
  }, [todoList, currentTodoId, loadTodo, isLoading]);
}
