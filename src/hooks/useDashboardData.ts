import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { TodoData, TodoItem, PageBlock, RoadmapData } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface BriefingTask {
  item: TodoItem;
  groupName: string;
  pageName: string;
  pageId: string;
  groupId: string;
}

export interface TrendDay {
  date: string;   // YYYY-MM-DD
  label: string;  // "Mon 27"
  count: number;
}

export interface GroupHealth {
  id: string;
  name: string;
  pageName: string;
  total: number;
  completed: number;
  overdue: number;
}

export interface PinnedTask {
  item: TodoItem;
  groupName: string;
  pageName: string;
  pageId: string;
}

export interface UpcomingMilestone {
  id: string;
  name: string;
  date: string;
  daysUntil: number;
  roadmapName: string;
}

export interface DashboardData {
  // Trend
  completionTrend: TrendDay[];
  // Velocity: rolling 7 days vs prior 7 days
  velocity: { thisWeek: number; lastWeek: number; delta: number | null };
  // Per-group health
  groupHealth: GroupHealth[];
  // Pinned non-completed tasks
  pinnedItems: PinnedTask[];
  // Roadmap milestones in next 30 days
  upcomingMilestones: UpcomingMilestone[];
  // Task sections (existing today-view data)
  overdue: BriefingTask[];
  dueToday: BriefingTask[];
  dueTomorrow: BriefingTask[];
  dueThisWeek: BriefingTask[];
  recentlyCompleted: BriefingTask[];
  // Summary
  totalTasks: number;
  completedTasks: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildTrendDays(count = 14): TrendDay[] {
  const days: TrendDay[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
    days.push({ date: toLocalDateStr(d), label, count: 0 });
  }
  return days;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);

    // Fetch todos and roadmaps in parallel
    const [todosResult, roadmapsResult] = await Promise.all([
      supabase.from('todo_lists').select('id, name, data').order('updated_at', { ascending: false }),
      supabase.from('roadmaps').select('id, name, data').order('updated_at', { ascending: false }),
    ]);

    if (todosResult.error) console.error('Dashboard: failed to fetch todos', todosResult.error);
    if (roadmapsResult.error) console.error('Dashboard: failed to fetch roadmaps', roadmapsResult.error);

    const todayStr = toLocalDateStr(new Date());
    const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = toLocalDateStr(tomorrowDate);
    const endOfWeekDate = new Date(); endOfWeekDate.setDate(endOfWeekDate.getDate() + (7 - endOfWeekDate.getDay()));
    const endOfWeekStr = toLocalDateStr(endOfWeekDate);

    // ── Trend: last 14 days keyed by local date ──
    const trendDays = buildTrendDays(14);
    const trendMap = new Map(trendDays.map((d) => [d.date, d]));

    // ── Velocity windows ──
    const now = Date.now();
    const msPerDay = 86_400_000;
    const thisWeekStart = now - 7 * msPerDay;
    const lastWeekStart = now - 14 * msPerDay;

    let thisWeekCount = 0;
    let lastWeekCount = 0;

    // ── Task sections ──
    const overdue: BriefingTask[] = [];
    const dueToday: BriefingTask[] = [];
    const dueTomorrow: BriefingTask[] = [];
    const dueThisWeek: BriefingTask[] = [];
    const recentlyCompleted: BriefingTask[] = [];
    let totalTasks = 0;
    let completedTasks = 0;

    // ── Group health & pinned ──
    const groupHealthMap = new Map<string, GroupHealth>();
    const pinnedItems: PinnedTask[] = [];

    for (const row of todosResult.data || []) {
      const todoData = row.data as TodoData;
      const blocks: PageBlock[] = todoData.blocks || [];
      const legacyGroups = todoData.groups || [];
      const allGroups = [
        ...blocks.filter((b): b is Extract<PageBlock, { type: 'group' }> => b.type === 'group'),
        ...legacyGroups.map((g) => ({ type: 'group' as const, data: g })),
      ];

      for (const block of allGroups) {
        const group = block.data;

        // Initialise group health entry
        if (!groupHealthMap.has(group.id)) {
          groupHealthMap.set(group.id, {
            id: group.id,
            name: group.name,
            pageName: row.name,
            total: 0,
            completed: 0,
            overdue: 0,
          });
        }
        const gh = groupHealthMap.get(group.id)!;

        for (const item of group.items) {
          if (item.archived) continue;
          totalTasks++;
          gh.total++;

          // Pinned non-completed items
          if (item.pinned && !item.completed) {
            pinnedItems.push({ item, groupName: group.name, pageName: row.name, pageId: row.id });
          }

          if (item.completed) {
            completedTasks++;
            gh.completed++;

            // Trend bucketing via completedAt
            if (item.completedAt) {
              const completedLocalDate = toLocalDateStr(new Date(item.completedAt));
              const trendDay = trendMap.get(completedLocalDate);
              if (trendDay) trendDay.count++;

              // Velocity
              const ts = new Date(item.completedAt).getTime();
              if (ts >= thisWeekStart) thisWeekCount++;
              else if (ts >= lastWeekStart) lastWeekCount++;
            }

            // Recently completed (sorted later)
            recentlyCompleted.push({ item, groupName: group.name, pageName: row.name, pageId: row.id, groupId: group.id });
            continue;
          }

          // Overdue count for group health
          if (item.dueDate && item.dueDate < todayStr) gh.overdue++;

          // Task sections
          const task: BriefingTask = { item, groupName: group.name, pageName: row.name, pageId: row.id, groupId: group.id };
          if (!item.dueDate) continue;
          if (item.dueDate < todayStr) overdue.push(task);
          else if (item.dueDate === todayStr) dueToday.push(task);
          else if (item.dueDate === tomorrowStr) dueTomorrow.push(task);
          else if (item.dueDate <= endOfWeekStr) dueThisWeek.push(task);
        }
      }
    }

    // ── Velocity delta ──
    const delta =
      lastWeekCount === 0
        ? thisWeekCount > 0 ? null : 0
        : Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100);

    // ── Group health: only groups with items, sorted by most overdue ──
    const groupHealth = Array.from(groupHealthMap.values())
      .filter((g) => g.total > 0)
      .sort((a, b) => b.overdue - a.overdue || b.total - a.total);

    // ── Sort task sections ──
    overdue.sort((a, b) => (a.item.dueDate || '').localeCompare(b.item.dueDate || ''));
    const sortPinned = (arr: BriefingTask[]) =>
      arr.sort((a, b) => (a.item.pinned === b.item.pinned ? 0 : a.item.pinned ? -1 : 1));
    sortPinned(overdue); sortPinned(dueToday); sortPinned(dueTomorrow); sortPinned(dueThisWeek);

    // ── Recently completed: by completedAt desc, cap 10 ──
    recentlyCompleted.sort((a, b) => {
      const aT = a.item.completedAt || '';
      const bT = b.item.completedAt || '';
      if (aT && bT) return bT.localeCompare(aT);
      return aT ? -1 : bT ? 1 : 0;
    });
    recentlyCompleted.splice(10);

    // ── Upcoming milestones: next 30 days ──
    const todayMs = new Date(todayStr).getTime();
    const thirtyDaysMs = todayMs + 30 * msPerDay;
    const upcomingMilestones: UpcomingMilestone[] = [];

    for (const row of roadmapsResult.data || []) {
      const roadmapData = row.data as RoadmapData;
      for (const milestone of roadmapData.milestones || []) {
        const ms = new Date(milestone.date + 'T00:00:00').getTime();
        if (ms >= todayMs && ms <= thirtyDaysMs) {
          const daysUntil = Math.round((ms - todayMs) / msPerDay);
          upcomingMilestones.push({ id: milestone.id, name: milestone.name, date: milestone.date, daysUntil, roadmapName: row.name });
        }
      }
    }
    upcomingMilestones.sort((a, b) => a.date.localeCompare(b.date));

    setData({
      completionTrend: trendDays,
      velocity: { thisWeek: thisWeekCount, lastWeek: lastWeekCount, delta },
      groupHealth,
      pinnedItems,
      upcomingMilestones,
      overdue,
      dueToday,
      dueTomorrow,
      dueThisWeek,
      recentlyCompleted,
      totalTasks,
      completedTasks,
    });
    setIsLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, isLoading, refresh };
}
