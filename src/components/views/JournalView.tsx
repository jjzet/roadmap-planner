import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Target } from 'lucide-react';
import { useGoalStore } from '@/store/goalStore';
import { useJournalStore } from '@/store/journalStore';
import { JournalHeatmap } from '@/components/journal/JournalHeatmap';

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

  // Hydrate local state when the entry or selected date changes.
  useEffect(() => {
    setForward(entry?.forward ?? '');
    setBlockers(entry?.blockers ?? '');
    setTomorrow(entry?.tomorrow ?? '');
  }, [selectedDate, entry?.id]);

  // Debounced autosave on any field change.
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

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-cyan-600 font-semibold">Journal</p>
          <h1 className="text-2xl font-mono font-light text-gray-800 tracking-tight mt-1">
            Reflect on goal progress
          </h1>
        </div>

        {/* Active goals strip */}
        {goals.length > 0 && (
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-2">
              Today's active goals
            </p>
            <div className="flex flex-wrap gap-2">
              {goals.map((g) => (
                <div
                  key={g.id}
                  className="flex items-start gap-2 bg-white border border-gray-200 rounded-md px-3 py-2 max-w-xs"
                >
                  <Target className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0 mt-0.5" />
                  <span className="text-[12px] font-mono text-gray-700 leading-snug">{g.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Date navigator */}
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-md px-3 py-2">
          <button
            onClick={() => setSelectedDate(shiftDay(selectedDate, -1))}
            className="p-1 text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer transition-colors"
            title="Previous day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-baseline gap-2">
            <span className="text-[14px] font-mono font-medium text-gray-800">
              {formatDateHeader(selectedDate)}
            </span>
            <span className="text-[10px] font-mono text-gray-400">{selectedDate}</span>
            {!isToday && (
              <button
                onClick={() => setSelectedDate(todayISO())}
                className="text-[10px] font-mono uppercase tracking-wider text-cyan-600 hover:text-cyan-700 ml-2 bg-transparent border-none cursor-pointer p-0"
              >
                jump to today
              </button>
            )}
          </div>
          <button
            onClick={() => setSelectedDate(shiftDay(selectedDate, 1))}
            disabled={isToday}
            className="p-1 text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Next day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Entry form */}
        {!isFuture && (
          <div className="space-y-4">
            <Prompt
              label="How did I move forward?"
              hint="One or two sentences on a goal you advanced today."
              value={forward}
              onChange={setForward}
              accentColor="cyan"
            />
            <Prompt
              label="What got in the way?"
              hint="Be honest — what blocked you, distracted you, or pulled focus."
              value={blockers}
              onChange={setBlockers}
              accentColor="amber"
            />
            <Prompt
              label="Tomorrow's one thing"
              hint="The single most important step toward a goal tomorrow."
              value={tomorrow}
              onChange={setTomorrow}
              accentColor="green"
            />
            <div className="flex items-center justify-end gap-3 text-[10px] font-mono uppercase tracking-wider text-gray-400">
              <span>{wordCount} words</span>
              <span className="text-gray-300">·</span>
              <span className={isSaving ? 'text-cyan-500' : 'text-gray-400'}>
                {isSaving ? 'saving…' : dirty ? 'unsaved' : 'saved'}
              </span>
            </div>
          </div>
        )}

        {isFuture && (
          <div className="text-center text-[12px] font-mono text-gray-400 py-12">
            Can't journal in the future yet — check back tomorrow.
          </div>
        )}

        {/* Heatmap */}
        <div className="bg-white border border-gray-200 rounded-md px-4 py-4">
          <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-3">
            Habit
          </p>
          <JournalHeatmap entries={entries} selectedDate={selectedDate} onSelect={setSelectedDate} />
        </div>
      </div>
    </div>
  );
}

function Prompt({
  label,
  hint,
  value,
  onChange,
  accentColor,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  accentColor: 'cyan' | 'amber' | 'green';
}) {
  const dotColors: Record<string, string> = {
    cyan: 'bg-cyan-500',
    amber: 'bg-amber-500',
    green: 'bg-green-500',
  };
  return (
    <div className="bg-white border border-gray-200 rounded-md p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[accentColor]}`} />
        <p className="text-[12px] font-mono font-medium text-gray-700">{label}</p>
      </div>
      <p className="text-[10px] font-mono font-light text-gray-400 mb-2">{hint}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder="…"
        className="w-full bg-transparent border-none outline-none resize-none text-[13px] font-mono font-light text-gray-700 placeholder-gray-300 leading-relaxed focus:outline-none"
        style={{ minHeight: '2.5rem' }}
        onInput={(e) => {
          const t = e.currentTarget;
          t.style.height = 'auto';
          t.style.height = t.scrollHeight + 'px';
        }}
      />
    </div>
  );
}
