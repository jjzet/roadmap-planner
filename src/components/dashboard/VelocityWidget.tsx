import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { VelocityData } from '@/hooks/useDashboardData';

interface Props {
  velocity: VelocityData;
}

export function VelocityWidget({ velocity }: Props) {
  const { current, previous, delta, currentLabel, previousLabel } = velocity;

  const deltaDisplay =
    delta === null
      ? { label: 'New this period', icon: <TrendingUp className="w-4 h-4" />, color: 'text-emerald-500' }
      : delta > 0
      ? { label: `+${delta}%`, icon: <TrendingUp className="w-4 h-4" />, color: 'text-emerald-500' }
      : delta < 0
      ? { label: `${delta}%`, icon: <TrendingDown className="w-4 h-4" />, color: 'text-red-400' }
      : { label: 'No change', icon: <Minus className="w-4 h-4" />, color: 'text-gray-400' };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col justify-between h-full">
      <div>
        <h3 className="text-sm font-semibold text-gray-800">Velocity</h3>
        <p className="text-xs text-gray-400 mt-0.5">{currentLabel} vs {previousLabel.toLowerCase()}</p>
      </div>

      <div className="mt-4 flex items-end gap-6">
        <div>
          <p className="text-3xl font-bold text-gray-900 tabular-nums">{current}</p>
          <p className="text-xs text-gray-400 mt-0.5">{currentLabel}</p>
        </div>
        <div className="mb-1">
          <p className="text-xl font-semibold text-gray-300 tabular-nums">{previous}</p>
          <p className="text-xs text-gray-400 mt-0.5">{previousLabel}</p>
        </div>
      </div>

      <div className={`flex items-center gap-1.5 mt-4 text-xs font-medium ${deltaDisplay.color}`}>
        {deltaDisplay.icon}
        {deltaDisplay.label}
      </div>

      {/* Mini comparison bar */}
      <div className="mt-3 flex items-end gap-1 h-8">
        {[previous, current].map((val, i) => {
          const maxVal = Math.max(previous, current, 1);
          const height = Math.max((val / maxVal) * 100, 8);
          return (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all"
              style={{
                height: `${height}%`,
                backgroundColor: i === 1 ? 'hsl(221 83% 53%)' : '#e5e7eb',
              }}
            />
          );
        })}
      </div>
      <div className="flex gap-1 mt-1">
        <p className="flex-1 text-center text-[10px] text-gray-300">{previousLabel}</p>
        <p className="flex-1 text-center text-[10px] text-blue-400">{currentLabel}</p>
      </div>
    </div>
  );
}
