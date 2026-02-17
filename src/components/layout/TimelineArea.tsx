import { useRef, useMemo, useEffect } from 'react';
import { useRoadmapStore } from '../../store/roadmapStore';
import { useUIStore } from '../../store/uiStore';
import { getTimelineColumns, getTimelineWidth, getTotalHeight } from '../../store/selectors';
import { parseDate, dateToX, addDays } from '../../lib/dates';
import { usePanHandler } from '../../hooks/usePanHandler';
import { TimelineHeader } from '../timeline/TimelineHeader';
import { TimelineGrid } from '../timeline/TimelineGrid';
import { TodayMarker } from '../timeline/TodayMarker';
import { StreamGroup } from '../timeline/StreamGroup';
import { DependencyOverlay } from '../dependencies/DependencyOverlay';

export function TimelineArea() {
  const streams = useRoadmapStore((s) => s.roadmap.streams);
  const settings = useRoadmapStore((s) => s.roadmap.settings);
  const currentRoadmapId = useRoadmapStore((s) => s.currentRoadmapId);
  const zoom = useUIStore((s) => s.zoom);
  const isPanning = useUIStore((s) => s.isPanning);
  const dependencyMode = useUIStore((s) => s.dependencyMode);
  const exitDependencyMode = useUIStore((s) => s.exitDependencyMode);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef<string | null>(null);

  usePanHandler(scrollRef);

  const columns = useMemo(
    () => getTimelineColumns(settings.timelineStartDate, settings.timelineEndDate, zoom),
    [settings.timelineStartDate, settings.timelineEndDate, zoom]
  );

  const timelineWidth = useMemo(() => getTimelineWidth(columns), [columns]);
  const totalHeight = useMemo(() => getTotalHeight(streams), [streams]);
  const originDate = useMemo(() => parseDate(settings.timelineStartDate), [settings.timelineStartDate]);

  // Scroll to current date -1 week/month on load
  useEffect(() => {
    if (!scrollRef.current || !currentRoadmapId) return;
    // Only auto-scroll once per roadmap load
    if (hasScrolledRef.current === currentRoadmapId) return;
    hasScrolledRef.current = currentRoadmapId;

    const today = new Date();
    const offset = zoom === 'week' ? -7 : -30; // 1 week or ~1 month before today
    const targetDate = addDays(today, offset);
    const scrollX = dateToX(targetDate, originDate, zoom);

    // Clamp to 0
    scrollRef.current.scrollLeft = Math.max(0, scrollX);
  }, [currentRoadmapId, originDate, zoom]);

  // Also re-scroll when zoom changes
  useEffect(() => {
    if (!scrollRef.current || !currentRoadmapId) return;
    const today = new Date();
    const offset = zoom === 'week' ? -7 : -30;
    const targetDate = addDays(today, offset);
    const scrollX = dateToX(targetDate, originDate, zoom);
    scrollRef.current.scrollLeft = Math.max(0, scrollX);
  }, [zoom, originDate, currentRoadmapId]);

  const handleBackgroundClick = () => {
    if (dependencyMode) {
      exitDependencyMode();
    }
  };

  return (
    <div
      ref={scrollRef}
      className={`flex-1 overflow-auto timeline-scroll relative ${
        isPanning ? (dependencyMode ? '' : 'cursor-grab-all') : ''
      } ${dependencyMode ? 'cursor-crosshair' : ''}`}
      onClick={handleBackgroundClick}
    >
      <div style={{ width: timelineWidth, minHeight: '100%' }}>
        <TimelineHeader />
        <div className="relative" style={{ height: totalHeight }}>
          <TimelineGrid height={totalHeight} />
          <TodayMarker height={totalHeight} />
          <DependencyOverlay originDate={originDate} totalHeight={totalHeight} timelineWidth={timelineWidth} />
          {streams.map((stream) => (
            <StreamGroup
              key={stream.id}
              stream={stream}
              originDate={originDate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
