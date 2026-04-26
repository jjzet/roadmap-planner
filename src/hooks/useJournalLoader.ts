import { useEffect } from 'react';
import { useJournalStore } from '../store/journalStore';

export function useJournalLoader() {
  const fetchAll = useJournalStore((s) => s.fetchAll);
  const loaded = useJournalStore((s) => s.loaded);
  useEffect(() => {
    if (!loaded) fetchAll();
  }, [loaded, fetchAll]);
}
