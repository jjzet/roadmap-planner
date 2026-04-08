import { useEffect } from 'react';
import { useGoalStore } from '@/store/goalStore';

export function useGoalLoader() {
  const fetchGoals = useGoalStore((s) => s.fetchGoals);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);
}
