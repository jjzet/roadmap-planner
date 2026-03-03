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
      loadTodo(todoList[0].id);
    }
  }, [todoList, currentTodoId, loadTodo, isLoading]);
}
