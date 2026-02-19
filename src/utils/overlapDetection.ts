import type { RoadmapItem, PhaseBar } from '../types';

/** Check if the given date range overlaps any other item in the list. */
export function hasOverlap(
  items: RoadmapItem[],
  movingItemId: string,
  newStart: string,
  newEnd: string
): boolean {
  return items.some(
    (item) =>
      item.id !== movingItemId &&
      newStart < item.endDate &&
      newEnd > item.startDate
  );
}

/** Check if the given date range overlaps any other phase bar in the list. */
export function hasPhaseBarOverlap(
  phaseBars: PhaseBar[],
  movingBarId: string,
  newStart: string,
  newEnd: string
): boolean {
  return phaseBars.some(
    (bar) =>
      bar.id !== movingBarId &&
      newStart < bar.endDate &&
      newEnd > bar.startDate
  );
}
