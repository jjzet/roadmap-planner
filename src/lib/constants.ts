import type { PhaseType } from '../types';

export const SIDEBAR_WIDTH = 220;
export const COLUMN_WIDTH_WEEK = 120;
export const COLUMN_WIDTH_MONTH = 180;
export const STREAM_HEADER_HEIGHT = 40;
export const ITEM_ROW_HEIGHT = 40;
export const BAR_HEIGHT = 30;
export const BAR_VERTICAL_PADDING = (ITEM_ROW_HEIGHT - BAR_HEIGHT) / 2;
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

export const DEFAULT_SETTINGS = {
  timelineStartDate: '2025-12-22',
  timelineEndDate: '2026-12-31',
};
