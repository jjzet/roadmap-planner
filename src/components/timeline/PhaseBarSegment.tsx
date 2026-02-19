import { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import type { PhaseBar } from '../../types';
import { useRoadmapStore } from '../../store/roadmapStore';
import { useUIStore } from '../../store/uiStore';
import { getBarRect } from '../../store/selectors';
import { parseDate, dateToX, xToDate, formatDate, formatDateDisplay, durationInWeeks } from '../../lib/dates';
import { PHASE_BAR_HEIGHT, PHASE_BAR_VERTICAL_PADDING } from '../../lib/constants';
import { snapToWeek } from '../../utils/snapToWeek';
import { hasPhaseBarOverlap } from '../../utils/overlapDetection';
import { BarResizeHandle } from './BarResizeHandle';

interface PhaseBarSegmentProps {
  bar: PhaseBar;
  allBars: PhaseBar[];
  subItemId: string;
  parentItemId: string;
  streamId: string;
  originDate: Date;
}

export function PhaseBarSegment({ bar, allBars, subItemId, parentItemId, streamId, originDate }: PhaseBarSegmentProps) {
  const movePhaseBar = useRoadmapStore((s) => s.movePhaseBar);
  const resizePhaseBar = useRoadmapStore((s) => s.resizePhaseBar);
  const removePhaseBar = useRoadmapStore((s) => s.removePhaseBar);
  const selectItem = useUIStore((s) => s.selectItem);
  const selectPhaseBar = useUIStore((s) => s.selectPhaseBar);
  const selectedPhaseBarId = useUIStore((s) => s.selectedPhaseBarId);
  const openEditPanel = useUIStore((s) => s.openEditPanel);
  const isPanning = useUIStore((s) => s.isPanning);
  const zoom = useUIStore((s) => s.zoom);

  const isSelected = selectedPhaseBarId === bar.id;

  const [isDragging, setIsDragging] = useState(false);
  const [dragDeltaX, setDragDeltaX] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeSide, setResizeSide] = useState<'left' | 'right'>('right');
  const [resizeDelta, setResizeDelta] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartX = useRef(0);
  const didDrag = useRef(false);

  const barRef = useRef(bar);
  barRef.current = bar;
  const allBarsRef = useRef(allBars);
  allBarsRef.current = allBars;
  const originDateRef = useRef(originDate);
  originDateRef.current = originDate;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const streamIdRef = useRef(streamId);
  streamIdRef.current = streamId;
  const parentItemIdRef = useRef(parentItemId);
  parentItemIdRef.current = parentItemId;
  const subItemIdRef = useRef(subItemId);
  subItemIdRef.current = subItemId;
  const resizeSideRef = useRef<'left' | 'right'>('right');

  const rect = useMemo(() => getBarRect(bar.startDate, bar.endDate, originDate, zoom), [bar.startDate, bar.endDate, originDate, zoom]);

  const displayX = isResizing && resizeSide === 'left' ? rect.x + resizeDelta : rect.x + (isDragging ? dragDeltaX : 0);
  const displayWidth = isResizing
    ? resizeSide === 'left'
      ? rect.width - resizeDelta
      : rect.width + resizeDelta
    : rect.width;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent click-to-create on the row
      if (isPanning || isResizing) return;

      dragStartX.current = e.clientX;
      didDrag.current = false;

      const scrollContainer = e.currentTarget.closest('.timeline-scroll') as HTMLElement | null;
      const startScrollLeft = scrollContainer?.scrollLeft || 0;

      const handleMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - dragStartX.current;
        if (Math.abs(delta) > 3) {
          didDrag.current = true;
          setIsDragging(true);
          setDragDeltaX(delta);
        }
      };

      const handleMouseUp = (ev: MouseEvent) => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);

        if (didDrag.current) {
          const delta = ev.clientX - dragStartX.current;
          const scrollDelta = (scrollContainer?.scrollLeft || 0) - startScrollLeft;
          const totalDelta = delta + scrollDelta;

          const current = barRef.current;
          const currentOrigin = originDateRef.current;
          const currentZoom = zoomRef.current;

          const currentStart = parseDate(current.startDate);
          const currentEnd = parseDate(current.endDate);
          const newStartRaw = xToDate(dateToX(currentStart, currentOrigin, currentZoom) + totalDelta, currentOrigin, currentZoom);
          const snappedStart = snapToWeek(newStartRaw);
          const duration = currentEnd.getTime() - currentStart.getTime();
          const snappedEnd = new Date(snappedStart.getTime() + duration);

          const newStartStr = formatDate(snappedStart);
          const newEndStr = formatDate(snappedEnd);

          if (!hasPhaseBarOverlap(allBarsRef.current, current.id, newStartStr, newEndStr)) {
            movePhaseBar(streamIdRef.current, parentItemIdRef.current, subItemIdRef.current, current.id, newStartStr, newEndStr);
          }
        } else {
          // Select the parent sub-item and this phase bar on click, open edit panel
          selectItem(subItemIdRef.current, streamIdRef.current);
          selectPhaseBar(barRef.current.id);
          openEditPanel();
        }

        setIsDragging(false);
        setDragDeltaX(0);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [isPanning, isResizing, movePhaseBar, selectItem, selectPhaseBar, openEditPanel]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      selectItem(subItemId, streamId);
      openEditPanel();
    },
    [subItemId, streamId, selectItem, openEditPanel]
  );

  const handleResizeStart = useCallback((side: 'left' | 'right') => {
    resizeSideRef.current = side;
    setIsResizing(true);
    setResizeSide(side);
    setResizeDelta(0);
  }, []);

  const handleResize = useCallback((delta: number) => {
    setResizeDelta(delta);
  }, []);

  const handleResizeEnd = useCallback((finalDelta: number) => {
    const current = barRef.current;
    const currentOrigin = originDateRef.current;
    const currentZoom = zoomRef.current;
    const side = resizeSideRef.current;

    const currentStart = parseDate(current.startDate);
    const currentEnd = parseDate(current.endDate);

    let newStartDate: Date;
    let newEndDate: Date;

    if (side === 'left') {
      const rawStart = xToDate(dateToX(currentStart, currentOrigin, currentZoom) + finalDelta, currentOrigin, currentZoom);
      newStartDate = snapToWeek(rawStart);
      newEndDate = currentEnd;
    } else {
      newStartDate = currentStart;
      const rawEnd = xToDate(dateToX(currentEnd, currentOrigin, currentZoom) + finalDelta, currentOrigin, currentZoom);
      newEndDate = snapToWeek(rawEnd);
    }

    if (newEndDate.getTime() - newStartDate.getTime() >= 7 * 86400000) {
      const newStartStr = formatDate(newStartDate);
      const newEndStr = formatDate(newEndDate);
      if (!hasPhaseBarOverlap(allBarsRef.current, current.id, newStartStr, newEndStr)) {
        resizePhaseBar(streamIdRef.current, parentItemIdRef.current, subItemIdRef.current, current.id, newStartStr, newEndStr);
      }
    }

    setIsResizing(false);
    setResizeDelta(0);
  }, [resizePhaseBar]);

  // Delete key handler when this phase bar is selected
  useEffect(() => {
    if (!isSelected) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't trigger if user is typing in an input/textarea
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        removePhaseBar(streamIdRef.current, parentItemIdRef.current, subItemIdRef.current, barRef.current.id);
        selectPhaseBar(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelected, removePhaseBar, selectPhaseBar]);

  const handleMouseEnter = () => {
    tooltipTimeout.current = setTimeout(() => setShowTooltip(true), 500);
  };
  const handleMouseLeave = () => {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    setShowTooltip(false);
  };

  return (
    <div
      className={`absolute rounded-sm cursor-pointer group select-none ${
        isDragging ? 'opacity-80 shadow-md' : ''
      } ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
      style={{
        left: displayX,
        width: Math.max(displayWidth, 12),
        top: PHASE_BAR_VERTICAL_PADDING,
        height: PHASE_BAR_HEIGHT,
        backgroundColor: bar.color,
        zIndex: isDragging || isResizing ? 30 : isSelected ? 10 : 5,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="px-1 text-[9px] text-white font-medium leading-[16px] truncate pointer-events-none">
        {bar.name}
      </div>

      {!isPanning && (
        <>
          <BarResizeHandle
            side="left"
            onResizeStart={() => handleResizeStart('left')}
            onResize={handleResize}
            onResizeEnd={handleResizeEnd}
          />
          <BarResizeHandle
            side="right"
            onResizeStart={() => handleResizeStart('right')}
            onResize={handleResize}
            onResizeEnd={handleResizeEnd}
          />
        </>
      )}

      {showTooltip && !isDragging && !isResizing && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap pointer-events-none z-50">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: bar.color }} />
            <span className="font-medium">{bar.name}</span>
          </div>
          <div className="text-gray-300 mt-0.5">
            {formatDateDisplay(bar.startDate)} — {formatDateDisplay(bar.endDate)}
          </div>
          <div className="text-gray-300">{durationInWeeks(bar.startDate, bar.endDate)} weeks</div>
        </div>
      )}
    </div>
  );
}
