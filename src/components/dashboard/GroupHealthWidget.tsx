import { ProgressRing } from '@/components/todo/ProgressRing';
import type { GroupHealth } from '@/hooks/useDashboardData';

interface Props {
  groups: GroupHealth[];
}

export function GroupHealthWidget({ groups }: Props) {
  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-md border border-gray-200 p-4 shadow-sm">
        <h3 className="text-[11px] font-mono font-semibold uppercase tracking-[0.15em] text-gray-700 mb-1">Group Health</h3>
        <p className="text-xs font-mono font-light text-gray-400">No groups found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-md border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-mono font-semibold uppercase tracking-[0.15em] text-gray-700">Group Health</h3>
        <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 tabular-nums">{groups.length} groups</span>
      </div>

      <div className="space-y-3">
        {groups.map((group) => {
          const pct = group.total === 0 ? 0 : Math.round((group.completed / group.total) * 100);
          const active = group.total - group.completed;

          return (
            <div key={group.id} className="flex items-center gap-3">
              <ProgressRing completed={group.completed} total={group.total} size={28} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-mono font-light text-gray-700 truncate">{group.name}</span>
                  {group.overdue > 0 && (
                    <span className="text-[10px] font-mono font-medium tabular-nums text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      {group.overdue} overdue
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor:
                          pct === 100 ? '#10b981' : group.overdue > 0 ? '#ef4444' : 'hsl(189 94% 43%)',
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono tabular-nums flex-shrink-0">
                    {active} left
                  </span>
                </div>
              </div>

              <span className="text-xs font-mono font-semibold text-gray-400 tabular-nums flex-shrink-0">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
