import { useCallback, useRef, useState, useMemo } from 'react';
import type { RoadmapItem } from '../../types';
import { useRoadmapStore } from '../../store/roadmapStore';
import { useUIStore } from '../../store/uiStore';
import { getBarRect } from '../../store/selectors';
import { parseDate, dateToX, xToDate, formatDate, formatDateDisplay, durationInWeeks } from '../../lib/dates';
import { SUB_BAR_HEIGHT, SUB_BAR_VERTICAL_PADDING } from '../../lib/constants';
import { snapToWeek } from '../../utils/snapToWeek';
import { BarResizeHandle } from './BarResizeHandle';

interface SubItemBarProps {
  subItem: RoadmapItem;
  parentItemId: string;
  streamId: string;
  streamColor: string;
  originDate: Date;
}

export function SubItemBar({ subItem, parentItemId, streamId, streamColor, originDate }: SubItemBarProps) {
  const moveSubItem = useRoadmapStore((s) => s.moveSubItem);
  const resizeSubItem = useRoadmapStore((s) => s.resizeSubItem);
  const selectItem = useUIStore((s) => s.selectItem);
  const openEditPanel = useUIStore((s) => s.openEditPanel);
  const selectedItemId = useUIStore((s) => s.selectedItemId);
  const isPanning = useUIStore((s) => s.isPanning);
  const zoom = useUIStore((s) => s.zoom);

  const [isDragging, setIsDragging] = useState(false);
  const [dragDeltaX, setDragDeltaX] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeSide, setResizeSide] = useState<'left' | 'right'>('right');
  const [resizeDelta, setResizeDelta] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartX = useRef(0);
  const didDrag = useRef(false);

  const subItemRef = useRef(subItem);
  subItemRef.current = subItem;
  const originDateRef = useRef(originDate);
  originDateRef.current = originDate;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const streamIdRef = useRef(streamId);
  streamIdRef.current = streamId;
  const parentItemIdRef = useRef(parentItemId);
  parentItemIdRef.current = parentItemId;
  const resizeSideRef = useRef<'left' | 'right'>('right');

  const isSelected = selectedItemId === subItem.id;
  const rect = useMemo(() => getBarRect(subItem.startDate, subItem.endDate, originDate, zoom), [subItem.startDate, subItem.endDate, originDate, zoom]);

  const displayX = isResizing && resizeSide === 'left' ? rect.x + resizeDelta : rect.x + (isDragging ? dragDeltaX : 0);
  const displayWidth = isResizing
    ? resizeSide === 'left'
      ? rect.width - resizeDelta
      : rect.width + resizeDelta
    : rect.width;

  // Use custom color if set, otherwise lighter version of stream color (60% opacity)
  const subColor = subItem.color || (streamColor + '99');

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
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

          const current = subItemRef.current;
          const currentOrigin = originDateRef.current;
          const currentZoom = zoomRef.current;

          const currentStart = parseDate(current.startDate);
          const currentEnd = parseDate(current.endDate);
          const newStartRaw = xToDate(dateToX(currentStart, currentOrigin, currentZoom) + totalDelta, currentOrigin, currentZoom);
          const snappedStart = snapToWeek(newStartRaw);
          const duration = currentEnd.getTime() - currentStart.getTime();
          const snappedEnd = new Date(snappedStart.getTime() + duration);

          moveSubItem(streamIdRef.current, parentItemIdRef.current, current.id, formatDate(snappedStart), formatDate(snappedEnd));
        } else {
          selectItem(subItemRef.current.id, streamIdRef.current);
        }

        setIsDragging(false);
        setDragDeltaX(0);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [isPanning, isResizing, moveSubItem, selectItem]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      selectItem(subItem.id, streamId);
      openEditPanel();
    },
    [subItem.id, streamId, selectItem, openEditPanel]
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
    const current = subItemRef.current;
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
      resizeSubItem(streamIdRef.current, parentItemIdRef.current, current.id, formatDate(newStartDate), formatDate(newEndDate));
    }

    setIsResizing(false);
    setResizeDelta(0);
  }, [resizeSubItem]);

  const handleMouseEnter = () => {
    tooltipTimeout.current = setTimeout(() => setShowTooltip(true), 500);
  };
  const handleMouseLeave = () => {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    setShowTooltip(false);
  };

  return (
    <div
      className={`absolute rounded cursor-pointer group select-none ${
        isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''
      } ${isDragging ? 'opacity-80 shadow-md' : ''}`}
      style={{
        left: displayX,
        width: Math.max(displayWidth, 16),
        top: SUB_BAR_VERTICAL_PADDING,
        height: SUB_BAR_HEIGHT,
        backgroundColor: subColor,
        zIndex: isDragging || isResizing ? 30 : 5,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="px-1.5 text-[10px] text-white font-medium leading-[20px] truncate pointer-events-none">
        {subItem.name}
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
          <div className="font-medium">{subItem.name}</div>
          <div className="text-gray-300 mt-0.5">
            {formatDateDisplay(subItem.startDate)} — {formatDateDisplay(subItem.endDate)}
          </div>
          <div className="text-gray-300">{durationInWeeks(subItem.startDate, subItem.endDate)} weeks</div>
          {subItem.lead && <div className="text-gray-300">Lead: {subItem.lead}</div>}
        </div>
      )}
    </div>
  );
}
