import { useMemo } from 'react';
import { ChevronUp, ChevronDown, AlertTriangle, Sun, CheckCircle2, ListChecks, Activity, RefreshCw } from 'lucide-react';
import { useDashboardDataContext } from '@/hooks/DashboardDataContext';
import { useUIStore } from '@/store/uiStore';
import { StatBadge } from '@/components/shared/StatBadge';

type DotKind = 'completed' | 'overdue' | 'today' | 'upcoming' | 'empty';

interface DayDot {
  date: string;       // yyyy-mm-dd
  label: string;      // tooltip label
  kind: DotKind;
  count: number;      // size signal
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DOT_COLORS: Record<DotKind, string> = {
  completed: 'bg-emerald-500',
  overdue:   'bg-red-500',
  today:     'bg-orange-500',
  upcoming:  'bg-cyan-500',
  empty:     'bg-gray-200',
};

export function BottomStatsStrip() {
  const { data, isLoading, refresh } = useDashboardDataContext();
  const dashboardPanelOpen = useUIStore((s) => s.dashboardPanelOpen);
  const toggleDashboardPanel = useUIStore((s) => s.toggleDashboardPanel);

  // Build a 14-day window: past 7 days + today + next 6 days
  const dots: DayDot[] = useMemo(() => {
    if (!data) return [];
    const todayStr = toLocalDateStr(new Date());
    const dailyCompletionMap = new Map(data.trends.daily.map((b) => [b.key, b.count]));

    // Bucket non-completed-with-due-date items by day for upcoming + overdue
    const dueByDay = new Map<string, number>();
    const allDueTasks = [...data.overdue, ...data.dueToday, ...data.dueTomorrow, ...data.dueThisWeek];
    for (const t of allDueTasks) {
      if (!t.item.dueDate) continue;
      dueByDay.set(t.item.dueDate, (dueByDay.get(t.item.dueDate) || 0) + 1);
    }

    const out: DayDot[] = [];
    // 7 days ago → 6 days ahead = 14 days total
    for (let offset = -7; offset <= 6; offset++) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + offset);
      const key = toLocalDateStr(d);
      const completedCount = dailyCompletionMap.get(key) || 0;
      const dueCount = dueByDay.get(key) || 0;

      let kind: DotKind = 'empty';
      let count = 0;
      let label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

      if (key === todayStr) {
        // Today: orange if anything due today, else completed/empty
        if (data.dueToday.length > 0) {
          kind = 'today';
          count = data.dueToday.length;
          label += ` — ${count} due today`;
        } else if (completedCount > 0) {
          kind = 'completed';
          count = completedCount;
          label += ` — ${count} completed`;
        } else {
          kind = 'empty';
          label += ' — today';
        }
      } else if (offset < 0) {
        // Past day: green if completed, red if overdue items left, else empty
        if (completedCount > 0) {
          kind = 'completed';
          count = completedCount;
          label += ` — ${count} completed`;
        } else if (dueCount > 0) {
          kind = 'overdue';
          count = dueCount;
          label += ` — ${count} overdue`;
        }
      } else {
        // Future day: cyan if upcoming due
        if (dueCount > 0) {
          kind = 'upcoming';
          count = dueCount;
          label += ` — ${count} upcoming`;
        }
      }
      out.push({ date: key, label, kind, count });
    }
    return out;
  }, [data]);

  return (
    <div
      className="absolute bottom-0 left-0 right-0 h-10 bg-white/95 backdrop-blur border-t border-gray-200 flex items-center px-4 gap-4 z-30"
      style={{ boxShadow: '0 -1px 3px rgba(0,0,0,0.04)' }}
    >
      {/* ── Left: stat badges ── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {data ? (
          <>
            <StatBadge
              label="tasks"
              value={data.totalTasks}
              variant="neutral"
              icon={<ListChecks className="w-3 h-3" />}
            />
            <StatBadge
              label="done"
              value={data.completedTasks}
              variant="success"
              icon={<CheckCircle2 className="w-3 h-3" />}
            />
            {data.overdue.length > 0 && (
              <StatBadge
                label="overdue"
                value={data.overdue.length}
                variant="danger"
                icon={<AlertTriangle className="w-3 h-3" />}
              />
            )}
            {data.dueToday.length > 0 && (
              <StatBadge
                label="today"
                value={data.dueToday.length}
                variant="warning"
                icon={<Sun className="w-3 h-3" />}
              />
            )}
          </>
        ) : (
          <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider">
            {isLoading ? 'loading…' : 'no data'}
          </span>
        )}
      </div>

      {/* ── Centre: activity timeline ── */}
      <div className="flex-1 flex items-center justify-center min-w-0">
        {dots.length > 0 && (
          <div className="flex items-center gap-3">
            <Activity className="w-3 h-3 text-gray-300" />
            <div className="relative flex items-center">
              {/* baseline */}
              <div className="absolute left-0 right-0 top-1/2 h-px bg-gray-200" />
              <div className="relative flex items-center gap-2">
                {dots.map((dot, i) => {
                  const size = dot.count > 0 ? Math.min(4 + dot.count, 9) : 4;
                  return (
                    <div
                      key={dot.date}
                      className="relative group/dot"
                      style={{ width: 10, height: 10 }}
                      title={dot.label}
                    >
                      <span
                        className={`block rounded-full ${DOT_COLORS[dot.kind]} ${
                          dot.kind === 'empty' ? 'opacity-50' : ''
                        } ${i === 7 ? 'ring-2 ring-cyan-300/40' : ''}`}
                        style={{
                          width: size,
                          height: size,
                          marginLeft: (10 - size) / 2,
                          marginTop: (10 - size) / 2,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider ml-1">14d</span>
          </div>
        )}
      </div>

      {/* ── Right: refresh + expand chevron ── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={refresh}
          className="text-gray-300 hover:text-cyan-500 border-none bg-transparent cursor-pointer p-1 rounded transition-colors"
          title="Refresh stats"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={toggleDashboardPanel}
          className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-gray-500 hover:text-cyan-600 border border-gray-200 hover:border-cyan-300 bg-white hover:bg-cyan-50/50 cursor-pointer px-2 py-1 rounded transition-colors"
          title={dashboardPanelOpen ? 'Hide dashboard' : 'Show dashboard'}
        >
          dashboard
          {dashboardPanelOpen ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronUp className="w-3 h-3" />
          )}
        </button>
      </div>
    </div>
  );
}
