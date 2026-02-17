import type { RoadmapItem } from '../types';

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
