import { useMemo } from 'react';
import { useRoadmapStore } from '../../store/roadmapStore';
import { useUIStore } from '../../store/uiStore';
import { dateToX, parseDate } from '../../lib/dates';

interface TodayMarkerProps {
  height: number;
}

export function TodayMarker({ height }: TodayMarkerProps) {
  const settings = useRoadmapStore((s) => s.roadmap.settings);
  const zoom = useUIStore((s) => s.zoom);

  const x = useMemo(() => {
    const origin = parseDate(settings.timelineStartDate);
    return dateToX(new Date(), origin, zoom);
  }, [settings.timelineStartDate, zoom]);

  return (
    <div
      className="absolute top-0 w-0.5 bg-red-500 z-10 pointer-events-none"
      style={{ left: x, height }}
    >
      <div className="absolute -top-0 -left-1.5 w-3.5 h-3.5 bg-red-500 rounded-full" />
    </div>
  );
}
