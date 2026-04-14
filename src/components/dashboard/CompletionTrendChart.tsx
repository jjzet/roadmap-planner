import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { TrendBucket, TimeRange } from '@/hooks/useDashboardData';

interface Props {
  data: TrendBucket[];
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
}

const chartConfig = {
  count: { label: 'Tasks completed', color: 'hsl(221 83% 53%)' },
};

const rangeLabels: Record<TimeRange, { title: string; subtitle: string }> = {
  daily:   { title: 'Daily',   subtitle: 'Last 14 days' },
  weekly:  { title: 'Weekly',  subtitle: 'Last 12 weeks' },
  monthly: { title: 'Monthly', subtitle: 'Last 12 months' },
};

const ranges: TimeRange[] = ['daily', 'weekly', 'monthly'];

export function CompletionTrendChart({ data, timeRange, onTimeRangeChange }: Props) {
  const hasAnyData = data.some((d) => d.count > 0);
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);
  const { subtitle } = rangeLabels[timeRange];

  // Show every other label for daily (14 labels is crowded), all for weekly/monthly
  const tickInterval = timeRange === 'daily' ? 1 : 0;

  return (
    <div className="bg-white rounded-md border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[11px] font-mono font-semibold uppercase tracking-[0.15em] text-gray-700">Completion Trend</h3>
          <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasAnyData && (
            <span className="text-[10px] font-mono font-medium tabular-nums text-cyan-600 bg-cyan-50 border border-cyan-100 px-2 py-0.5 rounded-full">
              {total} total
            </span>
          )}
          {/* Time range toggle */}
          <div className="flex bg-gray-100 rounded-sm p-0.5">
            {ranges.map((r) => (
              <button
                key={r}
                onClick={() => onTimeRangeChange(r)}
                className={`text-[10px] font-mono font-medium uppercase tracking-wider px-2 py-1 rounded-sm border-none cursor-pointer transition-colors ${
                  timeRange === r
                    ? 'bg-white text-cyan-700 shadow-sm'
                    : 'bg-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {rangeLabels[r].title}
              </button>
            ))}
          </div>
        </div>
      </div>

      {hasAnyData ? (
        <ChartContainer config={chartConfig} className="h-48 w-full aspect-auto">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              interval={tickInterval}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              allowDecimals={false}
              domain={[0, maxCount + 1]}
            />
            <ChartTooltip
              cursor={{ fill: '#f5f5f5' }}
              content={<ChartTooltipContent hideLabel={false} labelKey="label" nameKey="count" />}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.count > 0 ? 'hsl(221 83% 53%)' : '#e5e7eb'}
                  fillOpacity={entry.count > 0 ? 0.85 + (entry.count / maxCount) * 0.15 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      ) : (
        <div className="h-48 flex flex-col items-center justify-center text-center">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
            <span className="text-lg">📈</span>
          </div>
          <p className="text-sm text-gray-400">No completions recorded yet</p>
          <p className="text-xs text-gray-300 mt-1">Complete tasks to start seeing your trend</p>
        </div>
      )}
    </div>
  );
}
