import { useCallback, useRef, useState, useMemo } from 'react';
import type { RoadmapItem } from '../../types';
import { useRoadmapStore } from '../../store/roadmapStore';
import { useUIStore } from '../../store/uiStore';
import { getBarRect } from '../../store/selectors';
import { parseDate, dateToX, xToDate, formatDate, formatDateDisplay, durationInWeeks } from '../../lib/dates';
import { BAR_HEIGHT, BAR_VERTICAL_PADDING } from '../../lib/constants';
import { snapToWeek } from '../../utils/snapToWeek';
import { hasOverlap } from '../../utils/overlapDetection';
import { BarResizeHandle } from './BarResizeHandle';

interface TimelineBarProps {
  item: RoadmapItem;
  streamId: string;
  streamColor: string;
  streamItems: RoadmapItem[];
  originDate: Date;
}

export function TimelineBar({ item, streamId, streamColor, streamItems, originDate }: TimelineBarProps) {
  const moveItem = useRoadmapStore((s) => s.moveItem);
  const resizeItem = useRoadmapStore((s) => s.resizeItem);
  const selectItem = useUIStore((s) => s.selectItem);
  const openEditPanel = useUIStore((s) => s.openEditPanel);
  const selectedItemId = useUIStore((s) => s.selectedItemId);
  const isPanning = useUIStore((s) => s.isPanning);
  const zoom = useUIStore((s) => s.zoom);
  const dependencyMode = useUIStore((s) => s.dependencyMode);
  const dependencySourceItemId = useUIStore((s) => s.dependencySourceItemId);
  const enterDependencyMode = useUIStore((s) => s.enterDependencyMode);
  const exitDependencyMode = useUIStore((s) => s.exitDependencyMode);
  const addDependency = useRoadmapStore((s) => s.addDependency);

  const [isDragging, setIsDragging] = useState(false);
  const [dragDeltaX, setDragDeltaX] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeSide, setResizeSide] = useState<'left' | 'right'>('right');
  const [resizeDelta, setResizeDelta] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartX = useRef(0);
  const didDrag = useRef(false);

  // Keep refs in sync so mouseup/resizeEnd always have fresh values
  const itemRef = useRef(item);
  itemRef.current = item;
  const streamIdRef = useRef(streamId);
  streamIdRef.current = streamId;
  const streamItemsRef = useRef(streamItems);
  streamItemsRef.current = streamItems;
  const originDateRef = useRef(originDate);
  originDateRef.current = originDate;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const isSelected = selectedItemId === item.id;
  const rect = useMemo(() => getBarRect(item.startDate, item.endDate, originDate, zoom), [item.startDate, item.endDate, originDate, zoom]);

  // Calculate display rect with drag/resize offset
  const displayX = isResizing && resizeSide === 'left' ? rect.x + resizeDelta : rect.x + (isDragging ? dragDeltaX : 0);
  const displayWidth = isResizing
    ? resizeSide === 'left'
      ? rect.width - resizeDelta
      : rect.width + resizeDelta
    : rect.width;

  // Drag handling (single click = select, double click = open edit panel)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning || isResizing) return;

      // Handle dependency mode click
      if (dependencyMode) {
        e.stopPropagation();
        if (dependencySourceItemId && dependencySourceItemId !== item.id) {
          addDependency(dependencySourceItemId, item.id);
          exitDependencyMode();
        }
        return;
      }

      dragStartX.current = e.clientX;
      didDrag.current = false;

      // Capture scroll container reference eagerly
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

          const currentItem = itemRef.current;
          const currentOrigin = originDateRef.current;
          const currentZoom = zoomRef.current;
          const currentStreamItems = streamItemsRef.current;
          const currentStreamId = streamIdRef.current;

          const currentStart = parseDate(currentItem.startDate);
          const currentEnd = parseDate(currentItem.endDate);
          const newStartRaw = xToDate(dateToX(currentStart, currentOrigin, currentZoom) + totalDelta, currentOrigin, currentZoom);
          const snappedStart = snapToWeek(newStartRaw);
          const duration = currentEnd.getTime() - currentStart.getTime();
          const snappedEnd = new Date(snappedStart.getTime() + duration);

          const newStartStr = formatDate(snappedStart);
          const newEndStr = formatDate(snappedEnd);

          if (!hasOverlap(currentStreamItems, currentItem.id, newStartStr, newEndStr)) {
            moveItem(currentStreamId, currentItem.id, newStartStr, newEndStr);
          }
        } else {
          // Single click = select (highlight) only
          selectItem(itemRef.current.id, streamIdRef.current);
        }

        setIsDragging(false);
        setDragDeltaX(0);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [isPanning, isResizing, dependencyMode, dependencySourceItemId, item.id, moveItem, selectItem, addDependency, exitDependencyMode]
  );

  // Double-click opens edit panel
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      selectItem(item.id, streamId);
      openEditPanel();
    },
    [item.id, streamId, selectItem, openEditPanel]
  );

  // Resize handling — uses refs to avoid stale closures
  const handleResizeStart = useCallback((side: 'left' | 'right') => {
    setIsResizing(true);
    setResizeSide(side);
    setResizeDelta(0);
  }, []);

  const handleResize = useCallback((delta: number) => {
    setResizeDelta(delta);
  }, []);

  const handleResizeEnd = useCallback((finalDelta: number) => {
    const currentItem = itemRef.current;
    const currentOrigin = originDateRef.current;
    const currentZoom = zoomRef.current;
    const currentStreamItems = streamItemsRef.current;
    const currentStreamId = streamIdRef.current;

    const currentStart = parseDate(currentItem.startDate);
    const currentEnd = parseDate(currentItem.endDate);

    // Determine which side was being resized from the finalDelta direction
    // We need to know which side — store it in a ref too
    const side = resizeSideRef.current;

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

    // Ensure minimum 1 week
    if (newEndDate.getTime() - newStartDate.getTime() >= 7 * 86400000) {
      const newStartStr = formatDate(newStartDate);
      const newEndStr = formatDate(newEndDate);

      if (!hasOverlap(currentStreamItems, currentItem.id, newStartStr, newEndStr)) {
        resizeItem(currentStreamId, currentItem.id, newStartStr, newEndStr);
      }
    }

    setIsResizing(false);
    setResizeDelta(0);
  }, [resizeItem]);

  // Ref for resize side so handleResizeEnd can read it without stale closure
  const resizeSideRef = useRef<'left' | 'right'>('right');
  const handleResizeStartWrapped = useCallback((side: 'left' | 'right') => {
    resizeSideRef.current = side;
    handleResizeStart(side);
  }, [handleResizeStart]);

  // Tooltip
  const handleMouseEnter = () => {
    tooltipTimeout.current = setTimeout(() => setShowTooltip(true), 500);
  };
  const handleMouseLeave = () => {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    setShowTooltip(false);
  };

  // Link button for dependency creation
  const handleLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    enterDependencyMode(item.id);
  };

  return (
    <div
      className={`absolute rounded-md shadow-sm cursor-pointer group select-none ${
        isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''
      } ${isDragging ? 'opacity-80 shadow-md' : ''} ${
        dependencyMode ? 'cursor-crosshair' : ''
      }`}
      style={{
        left: displayX,
        width: Math.max(displayWidth, 20),
        top: BAR_VERTICAL_PADDING,
        height: BAR_HEIGHT,
        backgroundColor: streamColor,
        zIndex: isDragging || isResizing ? 30 : 5,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Bar label */}
      <div className="px-2 text-xs text-white font-medium leading-[30px] truncate pointer-events-none">
        {item.name}
      </div>

      {/* Resize handles */}
      {!isPanning && !dependencyMode && (
        <>
          <BarResizeHandle
            side="left"
            onResizeStart={() => handleResizeStartWrapped('left')}
            onResize={handleResize}
            onResizeEnd={handleResizeEnd}
          />
          <BarResizeHandle
            side="right"
            onResizeStart={() => handleResizeStartWrapped('right')}
            onResize={handleResize}
            onResizeEnd={handleResizeEnd}
          />
        </>
      )}

      {/* Dependency link dot */}
      {!dependencyMode && (
        <div
          className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-gray-400 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer hover:border-blue-500 hover:bg-blue-100 z-20"
          onClick={handleLinkClick}
          title="Create dependency"
        />
      )}

      {/* Tooltip */}
      {showTooltip && !isDragging && !isResizing && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap pointer-events-none z-50">
          <div className="font-medium">{item.name}</div>
          <div className="text-gray-300 mt-0.5">
            {formatDateDisplay(item.startDate)} — {formatDateDisplay(item.endDate)}
          </div>
          <div className="text-gray-300">{durationInWeeks(item.startDate, item.endDate)} weeks</div>
          {item.lead && <div className="text-gray-300">Lead: {item.lead}</div>}
        </div>
      )}
    </div>
  );
}
