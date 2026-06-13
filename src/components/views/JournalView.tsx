import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useGoalStore } from '@/store/goalStore';
import { useJournalStore } from '@/store/journalStore';
import { useUIStore } from '@/store/uiStore';
import { JournalHeatmap } from '@/components/journal/JournalHeatmap';
import { computeStreak } from '@/lib/journal';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function shiftDay(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr);
  const today = todayISO();
  const yest = shiftDay(today, -1);
  if (dateStr === today) return 'Today';
  if (dateStr === yest) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export function JournalView() {
  const goals = useGoalStore((s) => s.goals);
  const fetchGoals = useGoalStore((s) => s.fetchGoals);
  const setActiveView = useUIStore((s) => s.setActiveView);

  const entries = useJournalStore((s) => s.entries);
  const selectedDate = useJournalStore((s) => s.selectedDate);
  const setSelectedDate = useJournalStore((s) => s.setSelectedDate);
  const upsertEntry = useJournalStore((s) => s.upsertEntry);
  const isSaving = useJournalStore((s) => s.isSaving);

  useEffect(() => {
    if (goals.length === 0) fetchGoals();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const entry = entries[selectedDate];
  const [forward, setForward] = useState('');
  const [blockers, setBlockers] = useState('');
  const [tomorrow, setTomorrow] = useState('');

  useEffect(() => {
    setForward(entry?.forward ?? '');
    setBlockers(entry?.blockers ?? '');
    setTomorrow(entry?.tomorrow ?? '');
  }, [selectedDate, entry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty =
    forward !== (entry?.forward ?? '') ||
    blockers !== (entry?.blockers ?? '') ||
    tomorrow !== (entry?.tomorrow ?? '');

  useEffect(() => {
    if (!dirty) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      upsertEntry(selectedDate, { forward, blockers, tomorrow });
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [forward, blockers, tomorrow, dirty, selectedDate, upsertEntry]);

  const isToday = selectedDate === todayISO();
  const isFuture = selectedDate > todayISO();

  const wordCount = useMemo(() => {
    return [forward, blockers, tomorrow]
      .join(' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }, [forward, blockers, tomorrow]);

  const streak = computeStreak(entries);
  const entryCount = Object.keys(entries).length;

  return (
    <div className="o-scroll flex-1 overflow-y-auto">
      <div className="max-w-[1060px] mx-auto px-10 pt-9 pb-44 w-full">

        {/* Topline */}
        <div className="flex items-center justify-between pb-3" style={{ borderBottom: '2px solid var(--ink)' }}>
          <span className="text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <div className="flex items-center gap-4">
            <span className="o-dot text-[12.5px]" style={{ color: 'var(--ink-65)' }}>
              {entryCount} ENTRIES
            </span>
            {streak > 0 && (
              <span className="o-dot text-[12.5px]" style={{ color: 'var(--blue)' }}>
                {'▪'.repeat(Math.min(streak, 5))} {streak}-DAY STREAK
              </span>
            )}
          </div>
        </div>

        {/* Masthead */}
        <h1 className="o-display m-0 pt-7 pb-6" style={{ fontSize: 'clamp(44px, 7vw, 84px)', color: 'var(--ink)' }}>
          Journal
        </h1>

        {/* Tracker — front and centre, never hidden to the side */}
        <div
          className="rounded-[18px] p-5 mb-8"
          style={{ background: 'var(--paper-raise)', border: '1px solid var(--ink-14)' }}
        >
          <JournalHeatmap entries={entries} selectedDate={selectedDate} onSelect={setSelectedDate} />
        </div>

        {/* Date navigator */}
        <div className="flex items-center justify-between pb-2.5 mb-6" style={{ borderBottom: '2px solid var(--ink)' }}>
          <button
            onClick={() => setSelectedDate(shiftDay(selectedDate, -1))}
            className="flex items-center justify-center w-8 h-8 rounded-lg cursor-pointer transition-colors"
            style={{ background: 'var(--ink-07)', border: '1px solid var(--ink-14)', color: 'var(--ink-65)' }}
            title="Previous day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-baseline gap-3">
            <span className="o-head text-[18px]" style={{ color: 'var(--ink)' }}>
              {formatDateHeader(selectedDate)}
            </span>
            <span className="o-dot text-[11px]" style={{ color: 'var(--ink-45)' }}>{selectedDate}</span>
            {!isToday && (
              <button
                onClick={() => setSelectedDate(todayISO())}
                className="o-dot text-[10.5px] border-none bg-transparent cursor-pointer p-0"
                style={{ color: 'var(--blue)' }}
              >
                JUMP TO TODAY
              </button>
            )}
          </div>
          <button
            onClick={() => setSelectedDate(shiftDay(selectedDate, 1))}
            disabled={isToday}
            className="flex items-center justify-center w-8 h-8 rounded-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            style={{ background: 'var(--ink-07)', border: '1px solid var(--ink-14)', color: 'var(--ink-65)' }}
            title="Next day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Entry form */}
        {!isFuture && (
          <div>
            <Prompt
              ordinal="01"
              label="How did I move forward?"
              hint="One or two sentences on a goal you advanced today."
              value={forward}
              onChange={setForward}
            />
            <Prompt
              ordinal="02"
              label="What got in the way?"
              hint="Be honest — what blocked you, distracted you, or pulled focus."
              value={blockers}
              onChange={setBlockers}
            />
            <Prompt
              ordinal="03"
              label="Tomorrow’s one thing"
              hint="The single most important step toward a goal tomorrow."
              value={tomorrow}
              onChange={setTomorrow}
            />
            <div className="o-dot flex items-center justify-end gap-3 text-[10.5px] pt-1" style={{ color: 'var(--ink-45)' }}>
              <span>{wordCount} WORDS</span>
              <span style={{ color: 'var(--ink-28)' }}>·</span>
              <span style={{ color: isSaving || dirty ? 'var(--blue)' : 'var(--ink-45)' }}>
                {isSaving ? 'SAVING…' : dirty ? 'UNSAVED' : 'SAVED'}
              </span>
            </div>
          </div>
        )}

        {isFuture && (
          <p className="text-center text-[14px] py-12" style={{ color: 'var(--ink-45)' }}>
            Can’t journal in the future yet — check back tomorrow.
          </p>
        )}

        {/* Goals in sight while writing */}
        {goals.length > 0 && (
          <div className="mt-10">
            <div
              className="o-dot text-[11px] pb-2 mb-3.5"
              style={{ color: 'var(--ink-45)', borderBottom: '1px solid var(--ink-14)' }}
            >
              Goals in sight
            </div>
            <div className="flex flex-wrap gap-2">
              {goals.filter((g) => !g.archived).map((g) => (
                <button
                  key={g.id}
                  onClick={() => setActiveView('goals')}
                  className="text-left rounded-[12px] px-3.5 py-2.5 max-w-xs cursor-pointer transition-transform hover:scale-[1.02]"
                  style={{ background: 'var(--sand-soft)', border: '1px solid var(--ink-14)' }}
                >
                  <span className="block text-[12.5px] font-bold leading-snug" style={{ color: 'var(--ink)' }}>
                    {g.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function Prompt({
  ordinal,
  label,
  hint,
  value,
  onChange,
}: {
  ordinal: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-7">
      <div className="flex items-center gap-3 mb-1">
        <span
          className="o-dot text-[12px] rounded-[6px] px-1.5 pt-1 pb-0.5"
          style={{ background: 'var(--sand)', color: 'var(--on-sand)', fontWeight: 900 }}
        >
          {ordinal}
        </span>
        <p className="o-head m-0 text-[14px]" style={{ color: 'var(--ink)' }}>{label}</p>
      </div>
      <p className="m-0 mb-2 text-[12.5px] font-medium" style={{ color: 'var(--ink-45)' }}>{hint}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder="…"
        className="w-full bg-transparent border-none outline-none resize-none text-[15px] font-medium leading-relaxed"
        style={{ color: 'var(--ink)', borderLeft: '2.5px solid var(--ink-14)', paddingLeft: 14, minHeight: '2.6rem' }}
        onInput={(e) => {
          const t = e.currentTarget;
          t.style.height = 'auto';
          t.style.height = t.scrollHeight + 'px';
        }}
        onFocus={(e) => { e.currentTarget.style.borderLeftColor = 'var(--blue)'; }}
        onBlur={(e) => { e.currentTarget.style.borderLeftColor = 'var(--ink-14)'; }}
      />
    </div>
  );
}
