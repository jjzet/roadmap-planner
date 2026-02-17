import { useEffect, useRef } from 'react';
import { useRoadmapStore } from '../store/roadmapStore';
import { AUTOSAVE_DEBOUNCE_MS } from '../lib/constants';

export function useAutoSave() {
  const isDirty = useRoadmapStore((s) => s.isDirty);
  const saveRoadmap = useRoadmapStore((s) => s.saveRoadmap);
  const currentId = useRoadmapStore((s) => s.currentRoadmapId);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isDirty || !currentId) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveRoadmap();
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isDirty, currentId, saveRoadmap]);
}
