import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { TrendDay } from '@/hooks/useDashboardData';

interface Props {
  data: TrendDay[];
}

const chartConfig = {
  count: { label: 'Tasks completed', color: 'hsl(221 83% 53%)' },
};

export function CompletionTrendChart({ data }: Props) {
  const hasAnyData = data.some((d) => d.count > 0);
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  // Show every other label to avoid crowding on 14-day range
  const tickFormatter = (_: string, index: number) =>
    index % 2 === 0 ? data[index]?.label ?? '' : '';

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Completion Trend</h3>
          <p className="text-xs text-gray-400 mt-0.5">Tasks completed per day — last 14 days</p>
        </div>
        {hasAnyData && (
          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
            {data.reduce((s, d) => s + d.count, 0)} total
          </span>
        )}
      </div>

      {hasAnyData ? (
        <ChartContainer config={chartConfig} className="h-48 w-full aspect-auto">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              interval={1}
              tickFormatter={tickFormatter}
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
