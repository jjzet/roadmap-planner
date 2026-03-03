import { useMemo } from 'react';
import { useRoadmapStore } from '../../store/roadmapStore';
import { useUIStore } from '../../store/uiStore';
import { getTimelineColumns } from '../../store/selectors';
import { TIMELINE_HEADER_HEIGHT, MONTH_SHADING_COLORS } from '../../lib/constants';

export function TimelineHeader() {
  const settings = useRoadmapStore((s) => s.roadmap.settings);
  const zoom = useUIStore((s) => s.zoom);
  const showMonthColors = useUIStore((s) => s.showMonthColors);

  const columns = useMemo(
    () => getTimelineColumns(settings.timelineStartDate, settings.timelineEndDate, zoom),
    [settings.timelineStartDate, settings.timelineEndDate, zoom]
  );

  // Group month columns by quarter for sublabels
  const quarterGroups = useMemo(() => {
    if (zoom !== 'month') return [];
    const groups: { label: string; x: number; width: number }[] = [];
    let current: { label: string; x: number; width: number } | null = null;
    for (const col of columns) {
      if (col.sublabel && (!current || current.label !== col.sublabel)) {
        if (current) groups.push(current);
        current = { label: col.sublabel, x: col.x, width: col.width };
      } else if (current && col.sublabel === current.label) {
        current.width += col.width;
      }
    }
    if (current) groups.push(current);
    return groups;
  }, [columns, zoom]);

  return (
    <div
      className="sticky top-0 z-20 border-b border-gray-200"
      style={{ height: TIMELINE_HEADER_HEIGHT }}
    >
      {/* Quarter labels (month view only) */}
      {zoom === 'month' && (
        <div className="relative h-5">
          {quarterGroups.map((g, i) => (
            <div
              key={i}
              className="absolute top-0 text-[10px] text-gray-400 font-medium text-center border-r border-gray-100"
              style={{ left: g.x, width: g.width }}
            >
              {g.label}
            </div>
          ))}
        </div>
      )}

      {/* Column labels */}
      <div className="relative" style={{ height: zoom === 'month' ? 30 : TIMELINE_HEADER_HEIGHT }}>
        {columns.map((col, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 flex items-center justify-center text-xs text-gray-500 border-r border-gray-100"
            style={{
              left: col.x,
              width: col.width,
              backgroundColor: showMonthColors ? MONTH_SHADING_COLORS[col.month] : undefined,
            }}
          >
            {col.label}
          </div>
        ))}
      </div>
    </div>
  );
}
