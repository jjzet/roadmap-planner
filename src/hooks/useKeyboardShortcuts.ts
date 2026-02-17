import { useEffect } from 'react';
import { useUIStore } from '../store/uiStore';
import { useRoadmapStore } from '../store/roadmapStore';

export function useKeyboardShortcuts() {
  const closeEditPanel = useUIStore((s) => s.closeEditPanel);
  const exitDependencyMode = useUIStore((s) => s.exitDependencyMode);
  const setZoom = useUIStore((s) => s.setZoom);
  const selectedItemId = useUIStore((s) => s.selectedItemId);
  const selectedStreamId = useUIStore((s) => s.selectedStreamId);
  const dependencyMode = useUIStore((s) => s.dependencyMode);
  const removeItem = useRoadmapStore((s) => s.removeItem);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Escape') {
        if (dependencyMode) {
          exitDependencyMode();
        } else {
          closeEditPanel();
        }
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItemId && selectedStreamId) {
        e.preventDefault();
        if (window.confirm('Delete this item?')) {
          removeItem(selectedStreamId, selectedItemId);
          closeEditPanel();
        }
      }

      if (e.key === '1') setZoom('week');
      if (e.key === '2') setZoom('month');
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closeEditPanel, exitDependencyMode, setZoom, selectedItemId, selectedStreamId, dependencyMode, removeItem]);
}
