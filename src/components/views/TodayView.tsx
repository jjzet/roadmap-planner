import { useState } from 'react';
import { useDashboardDataContext } from '../../hooks/DashboardDataContext';
import type { BriefingTask, TimeRange } from '../../hooks/useDashboardData';
import { useTodoStore } from '../../store/todoStore';
import { useUIStore } from '../../store/uiStore';
import { ProgressRing } from '../todo/ProgressRing';
import { CompletionTrendChart } from '../dashboard/CompletionTrendChart';
import { VelocityWidget } from '../dashboard/VelocityWidget';
import { GroupHealthWidget } from '../dashboard/GroupHealthWidget';
import { PinnedItemsWidget } from '../dashboard/PinnedItemsWidget';
import { UpcomingMilestonesWidget } from '../dashboard/UpcomingMilestonesWidget';
import { DailyInsightWidget } from '../dashboard/DailyInsightWidget';
import { TOOLBAR_HEIGHT } from '@/lib/constants';
import { stripHtml } from '@/lib/utils';
import {
  AlertTriangle,
  Sun,
  Sunrise,
  CalendarDays,
  CheckCircle2,
  RefreshCw,
  Pin,
  ArrowRight,
} from 'lucide-react';
import { formatRelativeTime } from '@/lib/dates';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// ── Task section (reused for overdue / today / tomorrow / this week / recent) ──

interface TaskSectionProps {
  title: string;
  icon: React.ReactNode;
  tasks: BriefingTask[];
  accentColor: string;
  onNavigate: (pageId: string) => void;
}

function TaskSection({ title, icon, tasks, accentColor, onNavigate }: TaskSectionProps) {
  if (tasks.length === 0) return null;
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <span className={accentColor}>{icon}</span>
        <h3 className="text-[11px] font-mono font-semibold text-gray-700 uppercase tracking-[0.15em]">{title}</h3>
        <span className="text-[10px] font-mono tabular-nums text-gray-400">({tasks.length})</span>
      </div>
      <div className="space-y-0.5">
        {tasks.map((task) => (
          <div
            key={`${task.pageId}-${task.groupId}-${task.item.id}`}
            className="flex items-center gap-3 py-1.5 px-3 rounded-sm hover:bg-cyan-50/40 transition-colors group/task"
          >
            {task.item.pinned && (
              <Pin className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />
            )}
            <div
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 border-2 ${
                accentColor.includes('red')
                  ? 'border-red-400'
                  : accentColor.includes('orange')
                  ? 'border-orange-400'
                  : accentColor.includes('amber')
                  ? 'border-amber-400'
                  : accentColor.includes('emerald')
                  ? 'border-emerald-400'
                  : 'border-cyan-500'
              }`}
            />
            <span className="flex-1 text-sm text-gray-700 min-w-0 truncate">
              {stripHtml(task.item.text) || 'Untitled'}
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 flex-shrink-0">
              {task.groupName}
            </span>
            {task.item.dueDate && (
              <span
                className={`text-[10px] font-mono font-medium tabular-nums flex-shrink-0 ${
                  accentColor.includes('red') ? 'text-red-500' : 'text-gray-400'
                }`}
              >
                {task.item.dueDate}
              </span>
            )}
            {task.item.completedAt && (
              <span
                className="text-[10px] font-mono uppercase tracking-wider text-gray-400 flex-shrink-0"
                title={new Date(task.item.completedAt).toLocaleString()}
              >
                {formatRelativeTime(task.item.completedAt)}
              </span>
            )}
            <button
              onClick={() => onNavigate(task.pageId)}
              className="opacity-0 group-hover/task:opacity-100 transition-opacity text-gray-400 hover:text-cyan-600 border-none bg-transparent cursor-pointer p-0 flex-shrink-0"
              title="Go to page"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────

export function TodayView() {
  const { data, isLoading, refresh } = useDashboardDataContext();
  const loadTodo = useTodoStore((s) => s.loadTodo);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const [timeRange, setTimeRange] = useState<TimeRange>('daily');

  const handleNavigate = (pageId: string) => {
    loadTodo(pageId);
    setActiveView('tasks');
  };

  const hasTaskSections =
    data &&
    (data.overdue.length > 0 ||
      data.dueToday.length > 0 ||
      data.dueTomorrow.length > 0 ||
      data.dueThisWeek.length > 0 ||
      data.recentlyCompleted.length > 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center px-6 border-b border-gray-200 bg-white flex-shrink-0"
        style={{ height: TOOLBAR_HEIGHT, minHeight: TOOLBAR_HEIGHT }}
      >
        <div className="flex items-center gap-2 flex-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 tech-glow" />
          <h1 className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-gray-700">Today</h1>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-cyan-600 border-none bg-transparent cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto bg-gray-50/60">
        {isLoading && !data ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading dashboard…</div>
        ) : data ? (
          <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

            {/* ── Daily book insight ── */}
            <DailyInsightWidget />

            {/* ── Greeting + summary stats ── */}
            <div className="bg-white rounded-md border border-gray-200 p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{getGreeting()}</h2>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-gray-400 mt-1">{formatDate()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <ProgressRing completed={data.completedTasks} total={data.totalTasks} size={36} />
                    <div>
                      <p className="text-sm font-mono font-semibold tabular-nums text-gray-700">
                        {data.completedTasks}/{data.totalTasks}
                      </p>
                      <p className="text-xs text-gray-400">tasks done</p>
                    </div>
                  </div>
                  {data.overdue.length > 0 && (
                    <div className="flex items-center gap-1.5 text-red-500 bg-red-50 px-3 py-1.5 rounded-full">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="text-xs font-mono font-medium tabular-nums">{data.overdue.length} overdue</span>
                    </div>
                  )}
                  {data.dueToday.length > 0 && (
                    <div className="flex items-center gap-1.5 text-orange-500 bg-orange-50 px-3 py-1.5 rounded-full">
                      <Sun className="w-3.5 h-3.5" />
                      <span className="text-xs font-mono font-medium tabular-nums">{data.dueToday.length} due today</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Row 1: Trend (2/3) + Velocity (1/3) ── */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <CompletionTrendChart
                  data={data.trends[timeRange]}
                  timeRange={timeRange}
                  onTimeRangeChange={setTimeRange}
                />
              </div>
              <div>
                <VelocityWidget velocity={data.velocity[timeRange]} />
              </div>
            </div>

            {/* ── Row 2: Group Health (1/2) + Pinned Items (1/2) ── */}
            <div className="grid grid-cols-2 gap-4">
              <GroupHealthWidget groups={data.groupHealth} />
              <PinnedItemsWidget items={data.pinnedItems} />
            </div>

            {/* ── Row 3: Upcoming Milestones (full width, only if any) ── */}
            {data.upcomingMilestones.length > 0 && (
              <UpcomingMilestonesWidget milestones={data.upcomingMilestones} />
            )}

            {/* ── Divider ── */}
            {hasTaskSections && (
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-gray-200" />
                <span className="text-[10px] font-mono text-gray-500 font-semibold uppercase tracking-[0.2em]">Due dates</span>
                <div className="flex-1 border-t border-gray-200" />
              </div>
            )}

            {/* ── Task sections ── */}
            {hasTaskSections && (
              <div className="bg-white rounded-md border border-gray-200 p-5 shadow-sm">
                <TaskSection
                  title="Overdue"
                  icon={<AlertTriangle className="w-3.5 h-3.5" />}
                  tasks={data.overdue}
                  accentColor="text-red-500"
                  onNavigate={handleNavigate}
                />
                <TaskSection
                  title="Due Today"
                  icon={<Sun className="w-3.5 h-3.5" />}
                  tasks={data.dueToday}
                  accentColor="text-orange-500"
                  onNavigate={handleNavigate}
                />
                <TaskSection
                  title="Due Tomorrow"
                  icon={<Sunrise className="w-3.5 h-3.5" />}
                  tasks={data.dueTomorrow}
                  accentColor="text-amber-500"
                  onNavigate={handleNavigate}
                />
                <TaskSection
                  title="This Week"
                  icon={<CalendarDays className="w-3.5 h-3.5" />}
                  tasks={data.dueThisWeek}
                  accentColor="text-cyan-600"
                  onNavigate={handleNavigate}
                />
                {data.recentlyCompleted.length > 0 && (
                  <TaskSection
                    title="Recently Completed"
                    icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    tasks={data.recentlyCompleted}
                    accentColor="text-emerald-500"
                    onNavigate={handleNavigate}
                  />
                )}
              </div>
            )}

            {/* ── Empty state ── */}
            {!hasTaskSections && data.overdue.length === 0 && data.dueToday.length === 0 && (
              <div className="text-center py-6">
                <p className="text-sm text-gray-400">No tasks with due dates coming up.</p>
                <p className="text-xs text-gray-300 mt-1">Add due dates to tasks and they'll appear here.</p>
              </div>
            )}

          </div>
        ) : null}
      </div>
    </div>
  );
}
