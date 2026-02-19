export type PhaseType =
  | 'discovery-design'
  | 'implementation-build'
  | 'testing-release'
  | 'ongoing-continuous'
  | 'fbn-led-work';

export interface PhaseBar {
  id: string;
  name: string;
  startDate: string; // ISO date "YYYY-MM-DD"
  endDate: string;
  color: string; // hex color, user-picked
}

export interface RoadmapItem {
  id: string;
  name: string;
  lead: string;
  support: string;
  startDate: string; // ISO date "YYYY-MM-DD"
  endDate: string;
  phase: PhaseType;
  notes: string;
  order: number;
  color?: string; // optional override color for the bar
  subItems?: RoadmapItem[];
  expanded?: boolean;
  phaseBars?: PhaseBar[];
  phasesExpanded?: boolean;
}

export interface Stream {
  id: string;
  name: string;
  color: string; // hex — applies to all bars in the stream
  collapsed: boolean;
  order: number;
  items: RoadmapItem[];
}

export interface Dependency {
  id: string;
  fromItemId: string;
  toItemId: string;
}

export interface Milestone {
  id: string;
  name: string;
  date: string; // ISO date "YYYY-MM-DD"
  streamId: string; // which stream this milestone belongs to
}

export interface RoadmapSettings {
  timelineStartDate: string;
  timelineEndDate: string;
}

export interface RoadmapData {
  streams: Stream[];
  dependencies: Dependency[];
  milestones: Milestone[];
  settings: RoadmapSettings;
}

export interface RoadmapRecord {
  id: string;
  name: string;
  data: RoadmapData;
  created_at: string;
  updated_at: string;
}

export type ZoomLevel = 'week' | 'month';
