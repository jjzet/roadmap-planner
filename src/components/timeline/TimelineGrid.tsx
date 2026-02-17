import { useMemo } from 'react';
import { useRoadmapStore } from '../../store/roadmapStore';
import { useUIStore } from '../../store/uiStore';
import { getTimelineColumns } from '../../store/selectors';
import { MONTH_SHADING_COLORS } from '../../lib/constants';

interface TimelineGridProps {
  height: number;
}

export function TimelineGrid({ height }: TimelineGridProps) {
  const settings = useRoadmapStore((s) => s.roadmap.settings);
  const zoom = useUIStore((s) => s.zoom);

  const columns = useMemo(
    () => getTimelineColumns(settings.timelineStartDate, settings.timelineEndDate, zoom),
    [settings.timelineStartDate, settings.timelineEndDate, zoom]
  );

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ height }}>
      {columns.map((col, i) => (
        <div
          key={i}
          className="absolute top-0 border-r border-gray-100"
          style={{
            left: col.x,
            width: col.width,
            height,
            backgroundColor: MONTH_SHADING_COLORS[col.month],
          }}
        />
      ))}
    </div>
  );
}
