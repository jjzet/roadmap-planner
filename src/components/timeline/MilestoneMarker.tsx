import { useCallback, useRef, useState, useEffect } from 'react';
import type { Milestone, ZoomLevel } from '../../types';
import { useRoadmapStore } from '../../store/roadmapStore';
import { STREAM_HEADER_HEIGHT } from '../../lib/constants';
import { formatDateDisplay, dateToX, xToDate, parseDate, formatDate } from '../../lib/dates';
import { snapToWeek } from '../../utils/snapToWeek';

interface MilestoneMarkerProps {
  milestone: Milestone;
  x: number;
  streamColor: string;
  originDate: Date;
  zoom: ZoomLevel;
}

export function MilestoneMarker({ milestone, x, streamColor, originDate, zoom }: MilestoneMarkerProps) {
  const removeMilestone = useRoadmapStore((s) => s.removeMilestone);
  const moveMilestone = useRoadmapStore((s) => s.moveMilestone);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragDeltaX, setDragDeltaX] = useState(0);
  const dragStartX = useRef(0);
  const didDrag = useRef(false);
  const markerRef = useRef<HTMLDivElement>(null);

  // Keep refs in sync for mouseup closure
  const milestoneRef = useRef(milestone);
  milestoneRef.current = milestone;
  const originDateRef = useRef(originDate);
  originDateRef.current = originDate;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const size = 18; // diamond size in px
  const centerY = STREAM_HEADER_HEIGHT / 2;

  // Keyboard delete when selected
  useEffect(() => {
    if (!isSelected) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeMilestone(milestone.id);
      }
      if (e.key === 'Escape') {
        setIsSelected(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelected, milestone.id, removeMilestone]);

  // Deselect when clicking outside
  useEffect(() => {
    if (!isSelected) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (markerRef.current && !markerRef.current.contains(e.target as Node)) {
        setIsSelected(false);
      }
    };
    // Use timeout so the click that selected it doesn't immediately deselect
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSelected]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
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

          const currentMs = milestoneRef.current;
          const currentOrigin = originDateRef.current;
          const currentZoom = zoomRef.current;

          const currentDate = parseDate(currentMs.date);
          const currentX = dateToX(currentDate, currentOrigin, currentZoom);
          const rawNewDate = xToDate(currentX + totalDelta, currentOrigin, currentZoom);
          const snappedDate = snapToWeek(rawNewDate);

          moveMilestone(currentMs.id, formatDate(snappedDate));
        } else {
          // Single click = select
          setIsSelected(true);
        }

        setIsDragging(false);
        setDragDeltaX(0);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [moveMilestone]
  );

  const displayX = x + (isDragging ? dragDeltaX : 0);

  return (
    <div
      ref={markerRef}
      className="absolute"
      style={{
        left: displayX - size / 2,
        top: 0,
        width: size + 8, // slightly wider hit area
        height: STREAM_HEADER_HEIGHT,
        zIndex: isDragging ? 30 : 6,
        cursor: isDragging ? 'grabbing' : 'pointer',
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => { setShowTooltip(false); }}
    >
      {/* Vertical tick line */}
      <div
        className="absolute"
        style={{
          left: size / 2 + 4, // center within wider hit area
          top: 4,
          bottom: 4,
          width: 1,
          backgroundColor: streamColor,
          opacity: 0.4,
          transform: 'translateX(-50%)',
        }}
      />

      {/* Diamond shape */}
      <div
        className="absolute"
        style={{
          left: (size + 8) / 2,
          top: centerY,
          width: size,
          height: size,
          transform: 'translate(-50%, -50%) rotate(45deg)',
          backgroundColor: streamColor,
          border: isSelected ? '2px solid #3B82F6' : '2px solid white',
          boxShadow: isSelected
            ? '0 0 0 2px #3B82F6, 0 1px 3px rgba(0,0,0,0.2)'
            : '0 1px 3px rgba(0,0,0,0.2)',
          opacity: isDragging ? 0.8 : 1,
        }}
      />

      {/* Tooltip */}
      {showTooltip && !isDragging && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap pointer-events-auto z-50"
        >
          <div className="font-medium">{milestone.name}</div>
          <div className="text-gray-300 mt-0.5">{formatDateDisplay(milestone.date)}</div>
          {isSelected && (
            <div className="text-gray-400 mt-1 text-[10px]">Press Delete to remove</div>
          )}
        </div>
      )}
    </div>
  );
}
