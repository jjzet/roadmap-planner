import { useMemo } from 'react';
import type { Milestone, Stream } from '../../types';
import { STREAM_HEADER_HEIGHT, ITEM_ROW_HEIGHT, SUB_ITEM_ROW_HEIGHT, PHASE_ROW_HEIGHT, PHASE_HIGHLIGHT_STRIP_HEIGHT, DEFAULT_PHASE_BAR_DURATION_DAYS } from '../../lib/constants';
import { getBarRect } from '../../store/selectors';
import { useRoadmapStore } from '../../store/roadmapStore';
import { useUIStore } from '../../store/uiStore';
import { dateToX, xToDate, parseDate, formatDate } from '../../lib/dates';
import { hasPhaseBarOverlap } from '../../utils/overlapDetection';
import { snapToWeek } from '../../utils/snapToWeek';
import { TimelineBar } from './TimelineBar';
import { SubItemBar } from './SubItemBar';
import { PhaseBarSegment } from './PhaseBarSegment';
import { MilestoneMarker } from './MilestoneMarker';

interface StreamGroupProps {
  stream: Stream;
  originDate: Date;
}

export function StreamGroup({ stream, originDate }: StreamGroupProps) {
  const zoom = useUIStore((s) => s.zoom);
  const isPanning = useUIStore((s) => s.isPanning);
  const milestones = useRoadmapStore((s) => s.roadmap.milestones);
  const addPhaseBar = useRoadmapStore((s) => s.addPhaseBar);

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
          <div key={item.id}>
            <div
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

            {/* Sub-item rows */}
            {item.expanded && item.subItems && item.subItems.map((sub) => {
              const phaseBars = sub.phaseBars || [];
              const hasPhases = phaseBars.length > 0;

              const handlePhaseRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
                if (isPanning) return;
                // Only create on direct click (not on a phase bar)
                if (e.target !== e.currentTarget) return;

                // The phase row div spans the full timeline width inside the
                // scroll container, so clientX - rect.left already gives us
                // the absolute X position within the timeline (no need to add scrollLeft).
                const rect = e.currentTarget.getBoundingClientRect();
                const absoluteX = e.clientX - rect.left;

                const clickDate = xToDate(absoluteX, originDate, zoom);
                const snappedStart = snapToWeek(clickDate);
                const snappedEnd = new Date(snappedStart.getTime() + DEFAULT_PHASE_BAR_DURATION_DAYS * 86400000);
                const startStr = formatDate(snappedStart);
                const endStr = formatDate(snappedEnd);

                if (!hasPhaseBarOverlap(phaseBars, '', startStr, endStr)) {
                  addPhaseBar(stream.id, item.id, sub.id, startStr, endStr);
                }
              };

              return (
                <div key={sub.id}>
                  {/* Sub-item bar row */}
                  <div
                    className="relative border-b border-gray-50"
                    style={{ height: SUB_ITEM_ROW_HEIGHT, backgroundColor: `${stream.color}06` }}
                  >
                    <SubItemBar
                      subItem={sub}
                      parentItemId={item.id}
                      streamId={stream.id}
                      streamColor={stream.color}
                      originDate={originDate}
                    />

                    {/* Collapsed highlight strip — shows phase bar colors as a thin strip */}
                    {!sub.phasesExpanded && hasPhases && (
                      <div
                        className="absolute bottom-0 left-0 right-0"
                        style={{ height: PHASE_HIGHLIGHT_STRIP_HEIGHT }}
                      >
                        {phaseBars.map((bar) => {
                          const barRect = getBarRect(bar.startDate, bar.endDate, originDate, zoom);
                          return (
                            <div
                              key={bar.id}
                              className="absolute rounded-sm"
                              style={{
                                left: barRect.x,
                                width: barRect.width,
                                top: 0,
                                height: PHASE_HIGHLIGHT_STRIP_HEIGHT,
                                backgroundColor: bar.color,
                                opacity: 0.7,
                              }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Expanded phase bar row */}
                  {sub.phasesExpanded && (
                    <div
                      className="relative border-b border-gray-50 cursor-crosshair"
                      style={{
                        height: PHASE_ROW_HEIGHT,
                        backgroundColor: `${stream.color}04`,
                      }}
                      onClick={handlePhaseRowClick}
                    >
                      {phaseBars.map((bar) => (
                        <PhaseBarSegment
                          key={bar.id}
                          bar={bar}
                          allBars={phaseBars}
                          subItemId={sub.id}
                          parentItemId={item.id}
                          streamId={stream.id}
                          originDate={originDate}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add sub-item row spacing */}
            {item.expanded && item.subItems && item.subItems.length >= 0 && (
              <div
                className="border-b border-gray-50"
                style={{ height: SUB_ITEM_ROW_HEIGHT }}
              />
            )}
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
