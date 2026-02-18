import { useMemo } from 'react';
import type { Milestone, Stream } from '../../types';
import { STREAM_HEADER_HEIGHT, ITEM_ROW_HEIGHT } from '../../lib/constants';
import { getBarRect } from '../../store/selectors';
import { useRoadmapStore } from '../../store/roadmapStore';
import { useUIStore } from '../../store/uiStore';
import { dateToX, parseDate } from '../../lib/dates';
import { TimelineBar } from './TimelineBar';
import { MilestoneMarker } from './MilestoneMarker';

interface StreamGroupProps {
  stream: Stream;
  originDate: Date;
}

export function StreamGroup({ stream, originDate }: StreamGroupProps) {
  const zoom = useUIStore((s) => s.zoom);
  const milestones = useRoadmapStore((s) => s.roadmap.milestones);

  // Milestones belonging to this stream
  const streamMilestones = useMemo(
    () => milestones.filter((m: Milestone) => m.streamId === stream.id),
    [milestones, stream.id]
  );

  // Compute the summary bar: spans from earliest item start to latest item end
  const summaryRect = useMemo(() => {
    if (stream.items.length === 0) return null;
    let minStart = stream.items[0].startDate;
    let maxEnd = stream.items[0].endDate;
    for (const item of stream.items) {
      if (item.startDate < minStart) minStart = item.startDate;
      if (item.endDate > maxEnd) maxEnd = item.endDate;
    }
    return getBarRect(minStart, maxEnd, originDate, zoom);
  }, [stream.items, originDate, zoom]);

  // Lighter version of stream color (30% opacity)
  const summaryColor = stream.color + '4D'; // hex alpha ~30%

  return (
    <div>
      {/* Stream header row with summary bar — z-[2] to sit above the month color grid overlay */}
      <div
        className="relative border-b border-gray-200"
        style={{
          height: STREAM_HEADER_HEIGHT,
          backgroundColor: `${stream.color}08`,
          zIndex: 2,
        }}
      >
        {/* Summary bar */}
        {summaryRect && (
          <div
            className="absolute rounded-sm"
            style={{
              left: summaryRect.x,
              width: summaryRect.width,
              top: 8,
              height: STREAM_HEADER_HEIGHT - 16,
              backgroundColor: summaryColor,
              border: `1px solid ${stream.color}33`,
            }}
          />
        )}

        {/* Milestones on the header row */}
        {streamMilestones.map((ms) => (
          <MilestoneMarker
            key={ms.id}
            milestone={ms}
            x={dateToX(parseDate(ms.date), originDate, zoom)}
            streamColor={stream.color}
            originDate={originDate}
            zoom={zoom}
          />
        ))}
      </div>

      {/* Item rows */}
      {!stream.collapsed &&
        stream.items.map((item) => (
          <div
            key={item.id}
            className="relative border-b border-gray-50"
            style={{ height: ITEM_ROW_HEIGHT }}
          >
            <TimelineBar
              item={item}
              streamId={stream.id}
              streamColor={stream.color}
              streamItems={stream.items}
              originDate={originDate}
            />
          </div>
        ))}

      {/* Add item row (just spacing — the button is in the sidebar) */}
      {!stream.collapsed && (
        <div
          className="border-b border-gray-50"
          style={{ height: ITEM_ROW_HEIGHT }}
        />
      )}
    </div>
  );
}
