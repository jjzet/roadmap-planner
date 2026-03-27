import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { TodoData, TodoItem, PageBlock, RoadmapData } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export type TimeRange = 'daily' | 'weekly' | 'monthly';

export interface BriefingTask {
  item: TodoItem;
  groupName: string;
  pageName: string;
  pageId: string;
  groupId: string;
}

export interface TrendBucket {
  key: string;    // unique key for the bucket
  label: string;  // display label: "Mon 27", "Mar 2", "Mar"
  count: number;
}

export interface VelocityData {
  current: number;
  previous: number;
  delta: number | null; // null = "new this period" (prev was 0, current > 0)
  currentLabel: string;
  previousLabel: string;
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
  // Trends for all three ranges
  trends: Record<TimeRange, TrendBucket[]>;
  // Velocity for all three ranges
  velocity: Record<TimeRange, VelocityData>;
  // Per-group health (includes archived items in totals)
  groupHealth: GroupHealth[];
  // Pinned non-completed tasks
  pinnedItems: PinnedTask[];
  // Roadmap milestones in next 30 days
  upcomingMilestones: UpcomingMilestone[];
  // Task sections (active items only)
  overdue: BriefingTask[];
  dueToday: BriefingTask[];
  dueTomorrow: BriefingTask[];
  dueThisWeek: BriefingTask[];
  recentlyCompleted: BriefingTask[];
  // Summary (all items including archived)
  totalTasks: number;
  completedTasks: number;
}

// ── Bucket builders ────────────────────────────────────────────────────────

function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildDailyBuckets(count = 14): TrendBucket[] {
  const buckets: TrendBucket[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    buckets.push({
      key: toLocalDateStr(d),
      label: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
      count: 0,
    });
  }
  return buckets;
}

function buildWeeklyBuckets(count = 12): TrendBucket[] {
  const buckets: TrendBucket[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dow = today.getDay();
  const thisMon = new Date(today); thisMon.setDate(thisMon.getDate() - (dow === 0 ? 6 : dow - 1));
  for (let i = count - 1; i >= 0; i--) {
    const weekStart = new Date(thisMon); weekStart.setDate(weekStart.getDate() - i * 7);
    buckets.push({
      key: toLocalDateStr(weekStart),
      label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count: 0,
    });
  }
  return buckets;
}

function buildMonthlyBuckets(count = 12): TrendBucket[] {
  const buckets: TrendBucket[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const thisYear = today.getFullYear();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(thisYear, today.getMonth() - i, 1);
    const yr = d.getFullYear();
    const label = yr !== thisYear
      ? d.toLocaleDateString('en-US', { month: 'short' }) + ` '${String(yr).slice(2)}`
      : d.toLocaleDateString('en-US', { month: 'short' });
    buckets.push({
      key: `${yr}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label,
      count: 0,
    });
  }
  return buckets;
}

// ── Bucketing helpers for a completedAt timestamp ──────────────────────────

function toDailyKey(ts: Date): string {
  return toLocalDateStr(ts);
}

function toWeeklyKey(ts: Date): string {
  const dow = ts.getDay();
  const mon = new Date(ts); mon.setDate(mon.getDate() - (dow === 0 ? 6 : dow - 1));
  return toLocalDateStr(mon);
}

function toMonthlyKey(ts: Date): string {
  return `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
}

// ── Velocity computation ──────────────────────────────────────────────────

function computeVelocity(timestamps: number[]): Record<TimeRange, VelocityData> {
  const now = Date.now();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const msPerDay = 86_400_000;

  // Daily: rolling 7d vs prior 7d
  const d7 = now - 7 * msPerDay;
  const d14 = now - 14 * msPerDay;
  const dailyCurr = timestamps.filter((t) => t >= d7).length;
  const dailyPrev = timestamps.filter((t) => t >= d14 && t < d7).length;

  // Weekly: this ISO week (Mon–now) vs last full ISO week (Mon–Sun)
  const dow = today.getDay();
  const thisMon = new Date(today); thisMon.setDate(thisMon.getDate() - (dow === 0 ? 6 : dow - 1));
  const lastMon = new Date(thisMon); lastMon.setDate(lastMon.getDate() - 7);
  const weeklyCurr = timestamps.filter((t) => t >= thisMon.getTime()).length;
  const weeklyPrev = timestamps.filter((t) => t >= lastMon.getTime() && t < thisMon.getTime()).length;

  // Monthly: this calendar month vs last calendar month
  const thisMonth1 = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonth1 = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const monthlyCurr = timestamps.filter((t) => t >= thisMonth1.getTime()).length;
  const monthlyPrev = timestamps.filter((t) => t >= lastMonth1.getTime() && t < thisMonth1.getTime()).length;

  const delta = (c: number, p: number) =>
    p === 0 ? (c > 0 ? null : 0) : Math.round(((c - p) / p) * 100);

  return {
    daily:   { current: dailyCurr,   previous: dailyPrev,   delta: delta(dailyCurr, dailyPrev),     currentLabel: 'Last 7 days',  previousLabel: 'Prior 7 days' },
    weekly:  { current: weeklyCurr,  previous: weeklyPrev,  delta: delta(weeklyCurr, weeklyPrev),   currentLabel: 'This week',    previousLabel: 'Last week' },
    monthly: { current: monthlyCurr, previous: monthlyPrev, delta: delta(monthlyCurr, monthlyPrev), currentLabel: 'This month',   previousLabel: 'Last month' },
  };
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);

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

    // ── Build trend buckets for all three ranges ──
    const dailyBuckets = buildDailyBuckets(14);
    const weeklyBuckets = buildWeeklyBuckets(12);
    const monthlyBuckets = buildMonthlyBuckets(12);
    const dailyMap = new Map(dailyBuckets.map((b) => [b.key, b]));
    const weeklyMap = new Map(weeklyBuckets.map((b) => [b.key, b]));
    const monthlyMap = new Map(monthlyBuckets.map((b) => [b.key, b]));

    // ── Collect all completedAt timestamps for velocity ──
    const completedTimestamps: number[] = [];

    // ── Task sections (active non-archived items only) ──
    const overdue: BriefingTask[] = [];
    const dueToday: BriefingTask[] = [];
    const dueTomorrow: BriefingTask[] = [];
    const dueThisWeek: BriefingTask[] = [];
    const recentlyCompleted: BriefingTask[] = [];
    let totalTasks = 0;
    let completedTasks = 0;

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

        if (!groupHealthMap.has(group.id)) {
          groupHealthMap.set(group.id, {
            id: group.id, name: group.name, pageName: row.name,
            total: 0, completed: 0, overdue: 0,
          });
        }
        const gh = groupHealthMap.get(group.id)!;

        for (const item of group.items) {
          const isArchived = !!item.archived;

          // ── Metrics: ALL items count (archived + active) ──
          totalTasks++;
          gh.total++;

          if (item.completed) {
            completedTasks++;
            gh.completed++;

            // Trend + velocity bucketing (archived completed items count here too)
            if (item.completedAt) {
              const completedDate = new Date(item.completedAt);
              const ts = completedDate.getTime();
              completedTimestamps.push(ts);

              // Daily bucket
              const dk = toDailyKey(completedDate);
              const db = dailyMap.get(dk);
              if (db) db.count++;

              // Weekly bucket
              const wk = toWeeklyKey(completedDate);
              const wb = weeklyMap.get(wk);
              if (wb) wb.count++;

              // Monthly bucket
              const mk = toMonthlyKey(completedDate);
              const mb = monthlyMap.get(mk);
              if (mb) mb.count++;
            }

            // Recently completed (include archived completed items)
            recentlyCompleted.push({ item, groupName: group.name, pageName: row.name, pageId: row.id, groupId: group.id });
            continue;
          }

          // ── Below here: non-completed items ──

          // Overdue for group health: both active and archived non-completed count
          if (item.dueDate && item.dueDate < todayStr) gh.overdue++;

          // Task sections & pinned: active (non-archived) items only
          if (isArchived) continue;

          if (item.pinned) {
            pinnedItems.push({ item, groupName: group.name, pageName: row.name, pageId: row.id });
          }

          const task: BriefingTask = { item, groupName: group.name, pageName: row.name, pageId: row.id, groupId: group.id };
          if (!item.dueDate) continue;
          if (item.dueDate < todayStr) overdue.push(task);
          else if (item.dueDate === todayStr) dueToday.push(task);
          else if (item.dueDate === tomorrowStr) dueTomorrow.push(task);
          else if (item.dueDate <= endOfWeekStr) dueThisWeek.push(task);
        }
      }
    }

    // ── Velocity ──
    const velocity = computeVelocity(completedTimestamps);

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

    // ── Upcoming milestones ──
    const msPerDay = 86_400_000;
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
      trends: { daily: dailyBuckets, weekly: weeklyBuckets, monthly: monthlyBuckets },
      velocity,
      groupHealth,
      pinnedItems,
      upcomingMilestones,
      overdue, dueToday, dueTomorrow, dueThisWeek, recentlyCompleted,
      totalTasks, completedTasks,
    });
    setIsLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, isLoading, refresh };
}
