import { useEffect } from 'react';
import { usePalaceStore } from '@/store/palaceStore';

export function usePalaceLoader() {
  const fetchPalaces = usePalaceStore((s) => s.fetchPalaces);
  useEffect(() => {
    fetchPalaces();
  }, [fetchPalaces]);
}
