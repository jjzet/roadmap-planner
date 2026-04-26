import { useMemo } from 'react';
import type { JournalEntry } from '@/types';

// Github-style heatmap: 53 weeks × 7 days, each cell binary (entry exists or not).
// Cells are colored cyan when an entry exists, gray otherwise.
// Click a cell to select that date.

function dateISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

function startOfWeekMonday(d: Date): Date {
  const out = new Date(d);
  const day = (out.getDay() + 6) % 7; // Mon=0..Sun=6
  out.setDate(out.getDate() - day);
  out.setHours(0, 0, 0, 0);
  return out;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

export function JournalHeatmap({
  entries,
  selectedDate,
  onSelect,
}: {
  entries: Record<string, JournalEntry>;
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const { weeks, monthMarkers, currentStreak, longestStreak, totalEntries } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Show ~53 weeks ending this week.
    const end = startOfWeekMonday(today);
    end.setDate(end.getDate() + 7); // exclusive end (next Monday)
    const start = new Date(end);
    start.setDate(start.getDate() - 53 * 7);

    const weeks: Array<Array<{ date: string; filled: boolean; isFuture: boolean; isToday: boolean }>> = [];
    const monthMarkers: Array<{ weekIdx: number; label: string }> = [];
    let lastMonth = -1;

    let cursor = new Date(start);
    let weekIdx = 0;
    while (cursor < end) {
      const week: Array<{ date: string; filled: boolean; isFuture: boolean; isToday: boolean }> = [];
      for (let day = 0; day < 7; day++) {
        const dStr = dateISO(cursor);
        const isFuture = cursor > today;
        const isToday = cursor.getTime() === today.getTime();
        week.push({
          date: dStr,
          filled: !isFuture && !!entries[dStr],
          isFuture,
          isToday,
        });
        if (day === 0) {
          const m = cursor.getMonth();
          if (m !== lastMonth) {
            monthMarkers.push({ weekIdx, label: MONTH_LABELS[m] });
            lastMonth = m;
          }
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(week);
      weekIdx++;
    }

    // Streaks (over all dates, not just visible window).
    const allDates = Object.keys(entries).sort();
    const set = new Set(allDates);
    let longest = 0;
    let run = 0;
    for (let i = 0; i < allDates.length; i++) {
      run++;
      const d = new Date(allDates[i]);
      d.setDate(d.getDate() + 1);
      if (!set.has(dateISO(d))) {
        if (run > longest) longest = run;
        run = 0;
      }
    }
    let current = 0;
    const cur = new Date(today);
    // Allow today to be empty without breaking streak — start checking yesterday if today is empty.
    if (!set.has(dateISO(cur))) cur.setDate(cur.getDate() - 1);
    while (set.has(dateISO(cur))) {
      current++;
      cur.setDate(cur.getDate() - 1);
    }

    return {
      weeks,
      monthMarkers,
      currentStreak: current,
      longestStreak: longest,
      totalEntries: allDates.length,
    };
  }, [entries]);

  return (
    <div className="select-none">
      {/* Stats row */}
      <div className="flex items-center gap-6 mb-3">
        <Stat value={currentStreak} label="day streak" highlight />
        <Stat value={longestStreak} label="longest" />
        <Stat value={totalEntries} label="entries" />
      </div>

      {/* Heatmap grid */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {/* Weekday labels column */}
        <div className="flex flex-col gap-[3px] mr-1 pt-4">
          {WEEKDAY_LABELS.map((wd, i) => (
            <div key={i} className="h-[10px] text-[9px] font-mono text-gray-300 leading-[10px]">
              {wd}
            </div>
          ))}
        </div>

        <div>
          {/* Month labels row */}
          <div className="flex gap-[3px] mb-1 h-3">
            {weeks.map((_, wIdx) => {
              const marker = monthMarkers.find((m) => m.weekIdx === wIdx);
              return (
                <div key={wIdx} className="w-[10px] text-[9px] font-mono text-gray-400">
                  {marker?.label ?? ''}
                </div>
              );
            })}
          </div>
          {/* Cells */}
          <div className="flex gap-[3px]">
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-[3px]">
                {week.map((cell) => {
                  const isSelected = cell.date === selectedDate;
                  let cls = 'w-[10px] h-[10px] rounded-[2px] transition-colors ';
                  if (cell.isFuture) {
                    cls += 'bg-transparent border border-gray-100 cursor-default';
                  } else if (cell.filled) {
                    cls += 'bg-cyan-500 hover:bg-cyan-400 cursor-pointer';
                  } else {
                    cls += 'bg-gray-100 hover:bg-gray-200 cursor-pointer';
                  }
                  if (isSelected) cls += ' ring-1 ring-cyan-600 ring-offset-1';
                  if (cell.isToday) cls += ' outline outline-1 outline-gray-400';
                  return (
                    <button
                      key={cell.date}
                      type="button"
                      title={`${cell.date}${cell.filled ? ' — entry written' : cell.isFuture ? '' : ' — no entry'}`}
                      disabled={cell.isFuture}
                      onClick={() => !cell.isFuture && onSelect(cell.date)}
                      className={`${cls} border-0 p-0`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className={`text-lg font-mono font-light tabular-nums ${
          highlight ? 'text-cyan-600' : 'text-gray-700'
        }`}
      >
        {value}
      </span>
      <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400">{label}</span>
    </div>
  );
}
