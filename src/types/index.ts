export type PhaseType =
  | 'discovery-design'
  | 'implementation-build'
  | 'testing-release'
  | 'ongoing-continuous'
  | 'fbn-led-work';

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

export interface RoadmapSettings {
  timelineStartDate: string;
  timelineEndDate: string;
}

export interface RoadmapData {
  streams: Stream[];
  dependencies: Dependency[];
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

export type ActiveView = 'roadmap' | 'tasks';

// ── Todo Types ──

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  link: string;
  tags: string[];
  order: number;
}

export interface TodoGroup {
  id: string;
  name: string;
  collapsed: boolean;
  order: number;
  items: TodoItem[];
}

export interface TodoData {
  groups: TodoGroup[];
}

export interface TodoRecord {
  id: string;
  name: string;
  data: TodoData;
  created_at: string;
  updated_at: string;
}
