import type { PhaseType } from '../types';

export const SIDEBAR_WIDTH = 220;
export const COLUMN_WIDTH_WEEK = 120;
export const COLUMN_WIDTH_MONTH = 180;
export const STREAM_HEADER_HEIGHT = 40;
export const ITEM_ROW_HEIGHT = 40;
export const BAR_HEIGHT = 30;
export const BAR_VERTICAL_PADDING = (ITEM_ROW_HEIGHT - BAR_HEIGHT) / 2;
export const SUB_ITEM_ROW_HEIGHT = 28;
export const SUB_BAR_HEIGHT = 20;
export const SUB_BAR_VERTICAL_PADDING = (SUB_ITEM_ROW_HEIGHT - SUB_BAR_HEIGHT) / 2;
export const PHASE_ROW_HEIGHT = 24;
export const PHASE_BAR_HEIGHT = 16;
export const PHASE_BAR_VERTICAL_PADDING = (PHASE_ROW_HEIGHT - PHASE_BAR_HEIGHT) / 2;
export const PHASE_HIGHLIGHT_STRIP_HEIGHT = 4;
export const DEFAULT_PHASE_BAR_DURATION_DAYS = 14;
export const DEFAULT_PHASE_BAR_COLOR = '#4472C4';
export const TOOLBAR_HEIGHT = 52;
export const TIMELINE_HEADER_HEIGHT = 50;
export const EDIT_PANEL_WIDTH = 340;
export const MIN_ITEM_DURATION_DAYS = 7;
export const AUTOSAVE_DEBOUNCE_MS = 2000;
export const TIMELINE_BUFFER_WEEKS = 8;

export const DEFAULT_STREAM_COLORS = [
  '#4472C4', // blue
  '#548235', // green
  '#BF8F00', // amber
  '#C00000', // red
  '#7030A0', // purple
  '#00B0F0', // cyan
  '#FFC000', // gold
  '#ED7D31', // orange
];

export const PHASE_LABELS: Record<PhaseType, string> = {
  'discovery-design': 'Discovery / Design',
  'implementation-build': 'Implementation / Build',
  'testing-release': 'Testing / Release',
  'ongoing-continuous': 'Ongoing / Continuous',
  'fbn-led-work': 'FBN-Led Work',
};

export const DETAIL_COLUMN_WIDTH = 80;

export const PHASE_SHORT_LABELS: Record<PhaseType, string> = {
  'discovery-design': 'Discovery',
  'implementation-build': 'Build',
  'testing-release': 'Testing',
  'ongoing-continuous': 'Ongoing',
  'fbn-led-work': 'FBN-Led',
};

/** Subtle alternating background colors per month (indexed 0-11, Jan-Dec).
 *  Uses a 6-color palette that repeats, so adjacent months always contrast. */
export const MONTH_SHADING_COLORS = [
  '#EFF6FF', // Jan - blue-50
  '#F0FDF4', // Feb - green-50
  '#FFFBEB', // Mar - amber-50
  '#FFF1F2', // Apr - rose-50
  '#F5F3FF', // May - violet-50
  '#ECFDF5', // Jun - emerald-50
  '#EFF6FF', // Jul - blue-50
  '#F0FDF4', // Aug - green-50
  '#FFFBEB', // Sep - amber-50
  '#FFF1F2', // Oct - rose-50
  '#F5F3FF', // Nov - violet-50
  '#ECFDF5', // Dec - emerald-50
];

export const DEFAULT_SETTINGS = {
  timelineStartDate: '2025-12-22',
  timelineEndDate: '2026-12-31',
};
