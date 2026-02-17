import { useMemo } from 'react';
import { useRoadmapStore } from '../../store/roadmapStore';
import { useUIStore } from '../../store/uiStore';
import { getBarRect, computeStreamLayouts } from '../../store/selectors';
import { BAR_HEIGHT, BAR_VERTICAL_PADDING } from '../../lib/constants';
import { DependencyArrow } from './DependencyArrow';

interface DependencyOverlayProps {
  originDate: Date;
  totalHeight: number;
  timelineWidth: number;
}

export function DependencyOverlay({ originDate, totalHeight, timelineWidth }: DependencyOverlayProps) {
  const streams = useRoadmapStore((s) => s.roadmap.streams);
  const dependencies = useRoadmapStore((s) => s.roadmap.dependencies);
  const zoom = useUIStore((s) => s.zoom);

  const arrows = useMemo(() => {
    if (dependencies.length === 0) return [];

    const layouts = computeStreamLayouts(streams);

    // Build a map of itemId → { rect, y }
    const itemMap = new Map<string, { rect: { x: number; width: number }; y: number }>();

    for (const stream of streams) {
      const layout = layouts.find((l) => l.streamId === stream.id);
      if (!layout) continue;

      for (const item of stream.items) {
        const itemLayout = layout.itemYs.find((iy) => iy.itemId === item.id);
        if (!itemLayout) continue;
        const rect = getBarRect(item.startDate, item.endDate, originDate, zoom);
        itemMap.set(item.id, { rect, y: itemLayout.y });
      }
    }

    return dependencies.map((dep) => {
      const from = itemMap.get(dep.fromItemId);
      const to = itemMap.get(dep.toItemId);
      if (!from || !to) return null;

      return {
        id: dep.id,
        fromX: from.rect.x + from.rect.width,
        fromY: from.y + BAR_VERTICAL_PADDING + BAR_HEIGHT / 2,
        toX: to.rect.x,
        toY: to.y + BAR_VERTICAL_PADDING + BAR_HEIGHT / 2,
      };
    }).filter(Boolean) as { id: string; fromX: number; fromY: number; toX: number; toY: number }[];
  }, [streams, dependencies, originDate, zoom]);

  if (arrows.length === 0) return null;

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none"
      style={{ width: timelineWidth, height: totalHeight }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill="#94A3B8" />
        </marker>
      </defs>
      {arrows.map((a) => (
        <DependencyArrow
          key={a.id}
          fromX={a.fromX}
          fromY={a.fromY}
          toX={a.toX}
          toY={a.toY}
        />
      ))}
    </svg>
  );
}
