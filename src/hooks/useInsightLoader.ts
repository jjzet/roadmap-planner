import { useEffect } from 'react';
import { useInsightStore } from '@/store/insightStore';

export function useInsightLoader() {
  const fetchFavourites = useInsightStore((s) => s.fetchFavourites);
  const fetchAllInsights = useInsightStore((s) => s.fetchAllInsights);

  useEffect(() => {
    fetchFavourites();
    fetchAllInsights();
  }, [fetchFavourites, fetchAllInsights]);
}
