import { useEffect, useRef } from 'react';
import { useTodoStore } from '../store/todoStore';
import { AUTOSAVE_DEBOUNCE_MS } from '../lib/constants';

export function useTodoAutoSave() {
  const isDirty = useTodoStore((s) => s.isDirty);
  const saveTodo = useTodoStore((s) => s.saveTodo);
  const currentId = useTodoStore((s) => s.currentTodoId);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isDirty || !currentId) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveTodo();
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isDirty, currentId, saveTodo]);
}
