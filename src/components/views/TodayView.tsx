import { useTodayData, type BriefingTask } from '../../hooks/useTodayData';
import { useTodoStore } from '../../store/todoStore';
import { useUIStore } from '../../store/uiStore';
import { ProgressRing } from '../todo/ProgressRing';
import { TOOLBAR_HEIGHT } from '@/lib/constants';
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
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className={accentColor}>{icon}</span>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          {title}
        </h3>
        <span className="text-xs text-gray-400 ml-1">({tasks.length})</span>
      </div>
      <div className="space-y-1">
        {tasks.map((task) => (
          <div
            key={`${task.pageId}-${task.groupId}-${task.item.id}`}
            className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/80 transition-colors group/task"
          >
            {task.item.pinned && (
              <Pin className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />
            )}
            <div
              className={`w-3 h-3 rounded-full flex-shrink-0 border-2 ${
                accentColor.includes('red')
                  ? 'border-red-400'
                  : accentColor.includes('orange')
                  ? 'border-orange-400'
                  : accentColor.includes('amber')
                  ? 'border-amber-400'
                  : 'border-blue-400'
              }`}
            />
            <span className="flex-1 text-sm text-gray-700 min-w-0 truncate">
              {task.item.text || 'Untitled'}
            </span>
            <span className="text-[10px] text-gray-400 flex-shrink-0">
              {task.pageName} &middot; {task.groupName}
            </span>
            {task.item.dueDate && (
              <span
                className={`text-[10px] font-medium flex-shrink-0 ${
                  accentColor.includes('red') ? 'text-red-500' : 'text-gray-400'
                }`}
              >
                {task.item.dueDate}
              </span>
            )}
            <button
              onClick={() => onNavigate(task.pageId)}
              className="opacity-0 group-hover/task:opacity-100 transition-opacity text-gray-400 hover:text-blue-500 border-none bg-transparent cursor-pointer p-0 flex-shrink-0"
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

export function TodayView() {
  const { data, isLoading, refresh } = useTodayData();
  const loadTodo = useTodoStore((s) => s.loadTodo);
  const setActiveView = useUIStore((s) => s.setActiveView);

  const handleNavigate = (pageId: string) => {
    loadTodo(pageId);
    setActiveView('tasks');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header bar aligned with toolbar height */}
      <div
        className="flex items-center px-6 border-b border-gray-200 bg-white flex-shrink-0"
        style={{ height: TOOLBAR_HEIGHT, minHeight: TOOLBAR_HEIGHT }}
      >
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-800">Today</h1>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-blue-500 border-none bg-transparent cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl px-8 py-8">
          {isLoading && !data ? (
            <div className="py-16 text-center text-gray-400 text-sm">Loading briefing...</div>
          ) : data ? (
            <>
              {/* Greeting & Summary */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-1">
                  {getGreeting()} &#x1f44b;
                </h2>
                <p className="text-sm text-gray-500">{formatDate()}</p>
                <div className="flex items-center gap-4 mt-4">
                  <div className="flex items-center gap-2">
                    <ProgressRing
                      completed={data.completedTasks}
                      total={data.totalTasks}
                      size={32}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {data.completedTasks}/{data.totalTasks} tasks done
                      </p>
                      <p className="text-xs text-gray-400">across all pages</p>
                    </div>
                  </div>
                  {data.overdue.length > 0 && (
                    <div className="flex items-center gap-1.5 text-red-500 bg-red-50 px-3 py-1.5 rounded-full">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">{data.overdue.length} overdue</span>
                    </div>
                  )}
                  {data.dueToday.length > 0 && (
                    <div className="flex items-center gap-1.5 text-orange-500 bg-orange-50 px-3 py-1.5 rounded-full">
                      <Sun className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">{data.dueToday.length} due today</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Task Sections */}
              <TaskSection
                title="Overdue"
                icon={<AlertTriangle className="w-4 h-4" />}
                tasks={data.overdue}
                accentColor="text-red-500"
                onNavigate={handleNavigate}
              />

              <TaskSection
                title="Due Today"
                icon={<Sun className="w-4 h-4" />}
                tasks={data.dueToday}
                accentColor="text-orange-500"
                onNavigate={handleNavigate}
              />

              <TaskSection
                title="Due Tomorrow"
                icon={<Sunrise className="w-4 h-4" />}
                tasks={data.dueTomorrow}
                accentColor="text-amber-500"
                onNavigate={handleNavigate}
              />

              <TaskSection
                title="This Week"
                icon={<CalendarDays className="w-4 h-4" />}
                tasks={data.dueThisWeek}
                accentColor="text-blue-500"
                onNavigate={handleNavigate}
              />

              {data.recentlyCompleted.length > 0 && (
                <TaskSection
                  title="Recently Completed"
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  tasks={data.recentlyCompleted}
                  accentColor="text-emerald-500"
                  onNavigate={handleNavigate}
                />
              )}

              {/* Empty state */}
              {data.overdue.length === 0 &&
                data.dueToday.length === 0 &&
                data.dueTomorrow.length === 0 &&
                data.dueThisWeek.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-gray-400 text-sm mb-1">
                    No upcoming tasks with due dates.
                  </p>
                  <p className="text-gray-300 text-xs">
                    Add due dates to your tasks and they'll appear here.
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
