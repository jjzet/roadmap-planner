import { useState } from 'react';
import type { Milestone } from '../../types';
import { useRoadmapStore } from '../../store/roadmapStore';
import { ITEM_ROW_HEIGHT } from '../../lib/constants';
import { formatDateDisplay } from '../../lib/dates';

interface MilestoneMarkerProps {
  milestone: Milestone;
  x: number;
  streamColor: string;
}

export function MilestoneMarker({ milestone, x, streamColor }: MilestoneMarkerProps) {
  const removeMilestone = useRoadmapStore((s) => s.removeMilestone);
  const [showTooltip, setShowTooltip] = useState(false);

  const size = 18; // diamond size in px
  const centerY = ITEM_ROW_HEIGHT / 2;

  return (
    <div
      className="absolute"
      style={{
        left: x - size / 2,
        top: 0,
        width: size,
        height: ITEM_ROW_HEIGHT,
        zIndex: 6,
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Vertical tick line */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: 4,
          bottom: 4,
          width: 1,
          backgroundColor: streamColor,
          opacity: 0.4,
        }}
      />

      {/* Diamond shape */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: centerY - size / 2,
          width: size,
          height: size,
          transform: 'translateX(-50%) rotate(45deg)',
          backgroundColor: streamColor,
          border: '2px solid white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          cursor: 'pointer',
        }}
      />

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap pointer-events-auto z-50"
        >
          <div className="font-medium">{milestone.name}</div>
          <div className="text-gray-300 mt-0.5">{formatDateDisplay(milestone.date)}</div>
          <button
            className="text-red-400 hover:text-red-300 text-xs mt-1 border-none bg-transparent p-0 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              removeMilestone(milestone.id);
            }}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
