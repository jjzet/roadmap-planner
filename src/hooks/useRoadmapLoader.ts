import { useEffect } from 'react';
import { useRoadmapStore } from '../store/roadmapStore';

export function useRoadmapLoader() {
  const fetchRoadmapList = useRoadmapStore((s) => s.fetchRoadmapList);
  const loadRoadmap = useRoadmapStore((s) => s.loadRoadmap);
  const roadmapList = useRoadmapStore((s) => s.roadmapList);
  const currentRoadmapId = useRoadmapStore((s) => s.currentRoadmapId);
  const isLoading = useRoadmapStore((s) => s.isLoading);

  useEffect(() => {
    fetchRoadmapList();
  }, [fetchRoadmapList]);

  useEffect(() => {
    if (!currentRoadmapId && roadmapList.length > 0 && !isLoading) {
      loadRoadmap(roadmapList[0].id);
    }
  }, [roadmapList, currentRoadmapId, loadRoadmap, isLoading]);
}
