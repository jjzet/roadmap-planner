import type { Stream, ZoomLevel } from '../types';
import {
  dateToX,
  parseDate,
  generateWeekColumns,
  generateMonthColumns,
  addDays,
  type TimelineColumn,
} from '../lib/dates';
import {
  STREAM_HEADER_HEIGHT,
  ITEM_ROW_HEIGHT,
  SUB_ITEM_ROW_HEIGHT,
  PHASE_ROW_HEIGHT,
  PHASE_HIGHLIGHT_STRIP_HEIGHT,
  TIMELINE_BUFFER_WEEKS,
} from '../lib/constants';

// ── Bar geometry ──

export interface BarRect {
  x: number;
  width: number;
}

export function getBarRect(
  startDate: string,
  endDate: string,
  origin: Date,
  zoom: ZoomLevel
): BarRect {
  const x = dateToX(parseDate(startDate), origin, zoom);
  const x2 = dateToX(parseDate(endDate), origin, zoom);
  return { x, width: Math.max(x2 - x, 10) };
}

// ── Stream layout (Y positions) ──

export interface SubItemY {
  subItemId: string;
  y: number;
  phaseBarRowY?: number;
}

export interface ItemLayout {
  itemId: string;
  y: number;
  subItemYs: SubItemY[];
}

export interface StreamLayout {
  streamId: string;
  y: number;
  headerY: number;
  height: number;
  itemYs: { itemId: string; y: number }[];
  itemLayouts: ItemLayout[];
}

export function computeStreamLayouts(streams: Stream[]): StreamLayout[] {
  const layouts: StreamLayout[] = [];
  let currentY = 0;

  for (const stream of streams) {
    const headerY = currentY;
    currentY += STREAM_HEADER_HEIGHT;

    const itemYs: { itemId: string; y: number }[] = [];
    const itemLayouts: ItemLayout[] = [];
    if (!stream.collapsed) {
      for (const item of stream.items) {
        const itemY = currentY;
        itemYs.push({ itemId: item.id, y: currentY });
        currentY += ITEM_ROW_HEIGHT;

        const subItemYs: SubItemY[] = [];
        if (item.expanded && item.subItems && item.subItems.length > 0) {
          for (const sub of item.subItems) {
            const subY = currentY;
            currentY += SUB_ITEM_ROW_HEIGHT;

            // Highlight strip when collapsed with phase bars
            const hasPhases = sub.phaseBars && sub.phaseBars.length > 0;
            if (!sub.phasesExpanded && hasPhases) {
              currentY += PHASE_HIGHLIGHT_STRIP_HEIGHT;
            }

            let phaseBarRowY: number | undefined;
            if (sub.phasesExpanded) {
              phaseBarRowY = currentY;
              currentY += PHASE_ROW_HEIGHT;
            }

            subItemYs.push({ subItemId: sub.id, y: subY, phaseBarRowY });
          }
          // Space for "+ Add Sub-item" row
          currentY += SUB_ITEM_ROW_HEIGHT;
        }

        itemLayouts.push({ itemId: item.id, y: itemY, subItemYs });
      }
      // Space for "+ Add Item" row
      currentY += ITEM_ROW_HEIGHT;
    }

    layouts.push({
      streamId: stream.id,
      y: headerY,
      headerY,
      height: currentY - headerY,
      itemYs,
      itemLayouts,
    });
  }

  return layouts;
}

// ── Timeline columns ──

export function getTimelineColumns(
  timelineStartDate: string,
  timelineEndDate: string,
  zoom: ZoomLevel
): TimelineColumn[] {
  const origin = parseDate(timelineStartDate);
  const end = parseDate(timelineEndDate);
  // Add buffer
  const bufferedEnd = addDays(end, TIMELINE_BUFFER_WEEKS * 7);
  const bufferedStart = addDays(origin, -TIMELINE_BUFFER_WEEKS * 7);

  if (zoom === 'week') {
    return generateWeekColumns(bufferedStart, bufferedEnd, origin);
  } else {
    return generateMonthColumns(bufferedStart, bufferedEnd, origin);
  }
}

// ── Total timeline dimensions ──

export function getTimelineWidth(columns: TimelineColumn[]): number {
  if (columns.length === 0) return 0;
  const last = columns[columns.length - 1];
  return last.x + last.width;
}

export function getTotalHeight(streams: Stream[]): number {
  const layouts = computeStreamLayouts(streams);
  if (layouts.length === 0) return 200;
  const last = layouts[layouts.length - 1];
  return last.y + last.height + ITEM_ROW_HEIGHT; // Extra space for "Add Stream"
}
