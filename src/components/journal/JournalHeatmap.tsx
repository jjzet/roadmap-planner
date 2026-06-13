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
      <div className="flex items-center gap-7 mb-4">
        <Stat value={currentStreak} label="day streak" highlight />
        <Stat value={longestStreak} label="longest" />
        <Stat value={totalEntries} label="entries" />
      </div>

      {/* Heatmap grid */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {/* Weekday labels column */}
        <div className="flex flex-col gap-[4px] mr-1.5 pt-[18px]">
          {WEEKDAY_LABELS.map((wd, i) => (
            <div key={i} className="o-dot h-[11px] text-[8.5px] leading-[11px]" style={{ color: 'var(--ink-28)' }}>
              {wd}
            </div>
          ))}
        </div>

        <div>
          {/* Month labels row */}
          <div className="flex gap-[4px] mb-1.5 h-3">
            {weeks.map((_, wIdx) => {
              const marker = monthMarkers.find((m) => m.weekIdx === wIdx);
              return (
                <div key={wIdx} className="o-dot w-[11px] text-[8.5px] overflow-visible whitespace-nowrap" style={{ color: 'var(--ink-45)' }}>
                  {marker?.label ?? ''}
                </div>
              );
            })}
          </div>
          {/* Cells */}
          <div className="flex gap-[4px]">
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-[4px]">
                {week.map((cell) => {
                  const isSelected = cell.date === selectedDate;
                  const style: React.CSSProperties = cell.isFuture
                    ? { background: 'transparent', border: '1px solid var(--ink-07)', cursor: 'default' }
                    : cell.filled
                    ? { background: 'var(--blue)', cursor: 'pointer' }
                    : { background: 'var(--ink-07)', cursor: 'pointer' };
                  if (isSelected) style.boxShadow = '0 0 0 1.5px var(--paper), 0 0 0 3px var(--blue)';
                  else if (cell.isToday) style.boxShadow = '0 0 0 1.5px var(--paper), 0 0 0 3px var(--ink-28)';
                  return (
                    <button
                      key={cell.date}
                      type="button"
                      title={`${cell.date}${cell.filled ? ' — entry written' : cell.isFuture ? '' : ' — no entry'}`}
                      disabled={cell.isFuture}
                      onClick={() => !cell.isFuture && onSelect(cell.date)}
                      className="w-[11px] h-[11px] rounded-[3px] border-0 p-0 transition-transform hover:scale-125"
                      style={style}
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
    <div className="flex items-baseline gap-2">
      <span
        className="o-dot text-[22px]"
        style={{ color: highlight ? 'var(--blue)' : 'var(--ink)', fontWeight: 900 }}
      >
        {value}
      </span>
      <span className="o-dot text-[10px]" style={{ color: 'var(--ink-45)' }}>{label}</span>
    </div>
  );
}
