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

export interface StreamLayout {
  streamId: string;
  y: number;
  headerY: number;
  height: number;
  itemYs: { itemId: string; y: number }[];
}

export function computeStreamLayouts(streams: Stream[]): StreamLayout[] {
  const layouts: StreamLayout[] = [];
  let currentY = 0;

  for (const stream of streams) {
    const headerY = currentY;
    currentY += STREAM_HEADER_HEIGHT;

    const itemYs: { itemId: string; y: number }[] = [];
    if (!stream.collapsed) {
      for (const item of stream.items) {
        itemYs.push({ itemId: item.id, y: currentY });
        currentY += ITEM_ROW_HEIGHT;
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
