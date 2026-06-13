import { useJournalStore } from '@/store/journalStore';

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Entry "weight" → ribbon intensity. Longer reflections burn brighter. */
function entryLevel(forward: string, blockers: string, tomorrow: string): 0 | 1 | 2 | 3 {
  const len = (forward + blockers + tomorrow).trim().length;
  if (len === 0) return 0;
  if (len < 80) return 1;
  if (len < 240) return 2;
  return 3;
}

const LEVEL_STYLE: Record<number, React.CSSProperties> = {
  0: { background: 'var(--ink-07)' },
  1: { background: 'var(--lavender)' },
  2: { background: 'var(--blue-mid)' },
  3: { background: 'var(--blue)' },
};

export function computeStreak(entries: Record<string, { forward: string; blockers: string; tomorrow: string }>): number {
  let streak = 0;
  const cursor = new Date();
  // A streak survives until you miss a full day — today being unwritten yet doesn't break it.
  if (!entries[localDateStr(cursor)]) cursor.setDate(cursor.getDate() - 1);
  while (entries[localDateStr(cursor)]) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

interface Props {
  days?: number;
  onDayClick?: (date: string) => void;
}

/** The journal tracker as a soft-square ribbon — last N days, oldest first. */
export function JournalRibbon({ days = 13, onDayClick }: Props) {
  const entries = useJournalStore((s) => s.entries);

  const cells: { date: string; level: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localDateStr(d);
    const e = entries[key];
    cells.push({ date: key, level: e ? entryLevel(e.forward, e.blockers, e.tomorrow) : 0 });
  }

  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${days}, 1fr)` }}>
      {cells.map((c) => (
        <button
          key={c.date}
          onClick={onDayClick ? () => onDayClick(c.date) : undefined}
          className={`aspect-square rounded-[3px] border-none p-0 ${onDayClick ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
          style={LEVEL_STYLE[c.level]}
          title={c.date}
        />
      ))}
    </div>
  );
}
