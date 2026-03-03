import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { TodoData, TodoItem, PageBlock } from '../types';

export interface BriefingTask {
  item: TodoItem;
  groupName: string;
  pageName: string;
  pageId: string;
  groupId: string;
}

export interface TodayData {
  overdue: BriefingTask[];
  dueToday: BriefingTask[];
  dueTomorrow: BriefingTask[];
  dueThisWeek: BriefingTask[];
  recentlyCompleted: BriefingTask[];
  noDueDate: BriefingTask[];
  totalTasks: number;
  completedTasks: number;
}

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getEndOfWeek(): string {
  const d = new Date();
  const dayOfWeek = d.getDay();
  const daysUntilSunday = 7 - dayOfWeek;
  d.setDate(d.getDate() + daysUntilSunday);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useTodayData() {
  const [data, setData] = useState<TodayData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const { data: rows, error } = await supabase
      .from('todo_lists')
      .select('id, name, data')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch todos for briefing:', error);
      setIsLoading(false);
      return;
    }

    const today = getToday();
    const tomorrow = getTomorrow();
    const endOfWeek = getEndOfWeek();

    const overdue: BriefingTask[] = [];
    const dueToday: BriefingTask[] = [];
    const dueTomorrow: BriefingTask[] = [];
    const dueThisWeek: BriefingTask[] = [];
    const recentlyCompleted: BriefingTask[] = [];
    const noDueDate: BriefingTask[] = [];
    let totalTasks = 0;
    let completedTasks = 0;

    for (const row of rows || []) {
      const todoData = row.data as TodoData;
      const blocks: PageBlock[] = todoData.blocks || [];

      // Also handle legacy groups
      const legacyGroups = todoData.groups || [];
      const allGroups = [
        ...blocks.filter((b): b is Extract<PageBlock, { type: 'group' }> => b.type === 'group'),
        ...legacyGroups.map((g) => ({ type: 'group' as const, data: g })),
      ];

      for (const block of allGroups) {
        const group = block.data;
        for (const item of group.items) {
          totalTasks++;
          if (item.completed) {
            completedTasks++;
            // Show recently completed (completed items from active pages)
            if (recentlyCompleted.length < 10) {
              recentlyCompleted.push({
                item,
                groupName: group.name,
                pageName: row.name,
                pageId: row.id,
                groupId: group.id,
              });
            }
            continue;
          }

          const task: BriefingTask = {
            item,
            groupName: group.name,
            pageName: row.name,
            pageId: row.id,
            groupId: group.id,
          };

          if (!item.dueDate) {
            noDueDate.push(task);
            continue;
          }

          if (item.dueDate < today) {
            overdue.push(task);
          } else if (item.dueDate === today) {
            dueToday.push(task);
          } else if (item.dueDate === tomorrow) {
            dueTomorrow.push(task);
          } else if (item.dueDate <= endOfWeek) {
            dueThisWeek.push(task);
          }
        }
      }
    }

    // Sort overdue by date ascending (oldest first)
    overdue.sort((a, b) => (a.item.dueDate || '').localeCompare(b.item.dueDate || ''));
    // Sort pinned items to top within each category
    const sortPinned = (arr: BriefingTask[]) => {
      arr.sort((a, b) => {
        if (a.item.pinned && !b.item.pinned) return -1;
        if (!a.item.pinned && b.item.pinned) return 1;
        return 0;
      });
    };
    sortPinned(overdue);
    sortPinned(dueToday);
    sortPinned(dueTomorrow);
    sortPinned(dueThisWeek);

    setData({
      overdue,
      dueToday,
      dueTomorrow,
      dueThisWeek,
      recentlyCompleted,
      noDueDate,
      totalTasks,
      completedTasks,
    });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, isLoading, refresh };
}
