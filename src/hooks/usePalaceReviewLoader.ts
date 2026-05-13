import { useEffect } from 'react';
import { usePalaceReviewStore } from '@/store/palaceReviewStore';

export function usePalaceReviewLoader() {
  const fetchReviews = usePalaceReviewStore((s) => s.fetchReviews);
  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);
}
