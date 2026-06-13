import { useTodoStore } from '@/store/todoStore';

/** First root page = the daily driver ("Today" in the dock). */
export function useDefaultPageId(): string | null {
  const todoList = useTodoStore((s) => s.todoList);
  const roots = todoList.filter((t) => !t.parentId).sort((a, b) => a.orderIndex - b.orderIndex);
  return roots[0]?.id ?? null;
}
