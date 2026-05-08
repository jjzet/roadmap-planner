import { useEffect } from 'react';
import { useMemoryPalaceStore } from '@/store/memoryPalaceStore';

export function useMemoryPalaceLoader() {
  const fetchPalaces = useMemoryPalaceStore((s) => s.fetchPalaces);
  const loaded = useMemoryPalaceStore((s) => s.loaded);
  useEffect(() => {
    if (!loaded) fetchPalaces();
  }, [loaded, fetchPalaces]);
}
