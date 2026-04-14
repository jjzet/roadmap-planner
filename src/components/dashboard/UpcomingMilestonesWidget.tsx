import { Flag } from 'lucide-react';
import type { UpcomingMilestone } from '@/hooks/useDashboardData';

interface Props {
  milestones: UpcomingMilestone[];
}

function urgencyStyle(daysUntil: number): string {
  if (daysUntil === 0) return 'text-orange-500 bg-orange-50';
  if (daysUntil <= 3) return 'text-red-500 bg-red-50';
  if (daysUntil <= 7) return 'text-amber-500 bg-amber-50';
  return 'text-blue-500 bg-blue-50';
}

function daysLabel(daysUntil: number): string {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  return `${daysUntil}d`;
}

export function UpcomingMilestonesWidget({ milestones }: Props) {
  return (
    <div className="bg-white rounded-md border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Flag className="w-3.5 h-3.5 text-indigo-500" />
        <h3 className="text-[11px] font-mono font-semibold uppercase tracking-[0.15em] text-gray-700">Upcoming Milestones</h3>
        <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 ml-1">next 30 days</span>
      </div>

      {milestones.length === 0 ? (
        <p className="text-xs text-gray-400">No milestones in the next 30 days</p>
      ) : (
        <div className="space-y-2">
          {milestones.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-1">
              <span
                className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full flex-shrink-0 tabular-nums ${urgencyStyle(m.daysUntil)}`}
              >
                {daysLabel(m.daysUntil)}
              </span>
              <span className="flex-1 text-sm text-gray-700 truncate">{m.name}</span>
              <span className="text-[10px] text-gray-400 flex-shrink-0">{m.roadmapName}</span>
              <span className="text-[10px] font-mono text-gray-300 flex-shrink-0 tabular-nums">
                {new Date(m.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
