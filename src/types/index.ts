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

export type ActiveView = 'roadmap' | 'tasks' | 'today' | 'insights' | 'goals' | 'journal' | 'palaces';

// ── Todo Types ──

export type DevStatus = 'dev' | 'test' | 'pr' | 'merged' | 'build';

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  completedAt?: string; // ISO timestamp set when completed, cleared when uncompleted
  pinned: boolean;
  link: string;
  tags: string[];
  order: number;
  dueDate?: string; // ISO date "YYYY-MM-DD"
  notes?: string;
  expanded?: boolean;
  archived?: boolean;
  devStatus?: DevStatus;
  subGroupId?: string; // if set, item belongs to this sub-group
}

export interface SubGroup {
  id: string;
  name: string;    // optional label
  color: string;   // hex — drives left stripe + tinted bg
  order: number;   // position among loose items + other sub-groups
}

export interface TodoGroup {
  id: string;
  name: string;
  collapsed: boolean;
  order: number;
  items: TodoItem[];
  subGroups?: SubGroup[];
}

export interface TextBlock {
  id: string;
  content: string;
  order: number;
}

export interface DividerBlock {
  id: string;
  order: number;
}

export interface HeadingBlock {
  id: string;
  content: string;
  level: 1 | 2 | 3;
  order: number;
}

export interface GoalCardBlockData {
  id: string;
  goalId: string;
  order: number;
}

export type PageBlock =
  | { type: 'group'; data: TodoGroup }
  | { type: 'text'; data: TextBlock }
  | { type: 'divider'; data: DividerBlock }
  | { type: 'heading'; data: HeadingBlock }
  | { type: 'goal_card'; data: GoalCardBlockData };

export interface TodoData {
  groups: TodoGroup[];
  blocks: PageBlock[];
}

export interface TodoRecord {
  id: string;
  name: string;
  data: TodoData;
  created_at: string;
  updated_at: string;
}

// ── Insight Types ──

export interface DailyInsight {
  book?: string;
  author?: string;
  source_type?: 'book' | 'research' | 'synthesis';
  source?: string;
  category: string;
  concept: string;
  lesson: string;
  why_it_matters: string;
  long_summary: string;
}

export interface FavouriteInsight {
  id: string;
  date: string;
  insight_data: DailyInsight;
  favourited_at: string;
}

// ── Goal Types ──

export interface GoalRecord {
  id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  archived: boolean;
}

// ── Journal Types ──

export interface JournalEntry {
  id: string;
  date: string;       // YYYY-MM-DD
  forward: string;
  blockers: string;
  tomorrow: string;
  created_at: string;
  updated_at: string;
}

// ── Memory Palace Types ──
// Tile-based 2D memory palaces (Nintendo-style 8-bit overworld). Each palace
// is one map; rooms are coloured rectangles for organisation; objects are
// memory anchors placed at tile coords. Object content is the thing you're
// trying to remember (a fact, a person, a checklist, a story).

export type PalaceTheme = 'overworld' | 'dungeon' | 'castle' | 'forest' | 'beach' | 'lab';

export type PalaceObjectIcon =
  | 'chest'
  | 'book'
  | 'scroll'
  | 'crystal'
  | 'key'
  | 'tree'
  | 'sign'
  | 'lantern'
  | 'npc'
  | 'gem'
  | 'potion'
  | 'sword'
  | 'shield'
  | 'star'
  | 'heart';

export interface PalaceRoom {
  id: string;
  name: string;
  description?: string;
  x: number;       // top-left tile coord
  y: number;
  width: number;   // tile span
  height: number;
  color: string;   // hex — floor tint for the room
  kind?: string;   // RoomKind.id from presets — drives object picker
}

export interface PalaceObject {
  id: string;
  name: string;
  content: string;   // the memory itself (free-form text / markdown)
  x: number;         // tile coord
  y: number;
  icon: PalaceObjectIcon;
  color: string;     // hex — sprite accent
  roomId?: string;   // optional — assigned to a room
  link?: string;     // optional URL or page ref
  kind?: string;     // ObjectKind.id from presets
}

export interface MemoryPalaceData {
  width: number;     // map size in tiles
  height: number;
  rooms: PalaceRoom[];
  objects: PalaceObject[];
}

export interface MemoryPalaceRecord {
  id: string;
  name: string;
  theme: PalaceTheme;
  description: string;
  data: MemoryPalaceData;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

// Spaced repetition record for a single locus inside a palace. One row per
// (palace_id, object_id). See supabase/migrations/007_palace_reviews.sql.
export type ReviewQuality = 'hard' | 'good' | 'easy';

export interface PalaceReview {
  id: string;
  palace_id: string;
  object_id: string;
  last_seen: string;       // ISO timestamp
  next_due: string;        // ISO timestamp
  ease: number;            // [1.3, 3.0]
  interval_days: number;   // >= 1
  created_at: string;
  updated_at: string;
}
