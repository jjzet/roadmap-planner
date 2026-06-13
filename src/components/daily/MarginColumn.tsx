import { useTodoStore } from '@/store/todoStore';
import { useGoalStore } from '@/store/goalStore';
import { useJournalStore } from '@/store/journalStore';
import { useUIStore } from '@/store/uiStore';
import { JournalRibbon } from './JournalRibbon';
import { BoardNoteCard } from '../board/BoardNoteCard';

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Kicker({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div
      className="o-dot flex items-center justify-between text-[11px] pb-2 mb-3.5"
      style={{ color: 'var(--ink-45)', borderBottom: '1px solid var(--ink-14)' }}
    >
      <span>{label}</span>
      {right}
    </div>
  );
}

/** The page margin: the Board's latest note, the journal ribbon, the standing goal. */
export function MarginColumn() {
  const blocks = useTodoStore((s) => s.todo.blocks);
  const goals = useGoalStore((s) => s.goals);
  const getGoalById = useGoalStore((s) => s.getGoalById);
  const entries = useJournalStore((s) => s.entries);
  const setActiveView = useUIStore((s) => s.setActiveView);

  const entryCount = Object.keys(entries).length;
  const todayWritten = !!entries[localDateStr(new Date())];

  // Standing goal: the page's first pinned goal card, else the newest goal.
  const goalCard = blocks.find((b) => b.type === 'goal_card');
  const standingGoal =
    (goalCard && goalCard.type === 'goal_card' ? getGoalById(goalCard.data.goalId) : undefined) ??
    goals.find((g) => !g.archived);

  return (
    <aside className="w-[240px] flex-shrink-0 pt-1 hidden xl:block">
      {/* The Board */}
      <div className="mb-9">
        <Kicker
          label="The Board"
          right={<span style={{ color: 'var(--blue)' }}>● LIVE</span>}
        />
        <BoardNoteCard />
      </div>

      {/* Journal */}
      <div className="mb-9">
        <Kicker label={`Journal · ${entryCount} entries`} />
        <JournalRibbon onDayClick={() => setActiveView('journal')} />
        <p className="m-0 mt-3 text-[13px] font-medium" style={{ color: 'var(--ink-65)' }}>
          {todayWritten ? 'Tonight’s entry is written. ' : 'Tonight’s entry is unwritten. '}
          <button
            onClick={() => setActiveView('journal')}
            className="border-none bg-transparent cursor-pointer p-0 font-semibold"
            style={{ color: 'var(--blue)' }}
          >
            {todayWritten ? 'Read →' : 'Write →'}
          </button>
        </p>
      </div>

      {/* Standing goal */}
      {standingGoal && (
        <div className="mb-9">
          <Kicker label="Standing goal" />
          <button
            onClick={() => setActiveView('goals')}
            className="w-full text-left rounded-[14px] p-4 cursor-pointer border-none transition-transform hover:scale-[1.015]"
            style={{ background: 'var(--sand-soft)', border: '1px solid var(--ink-14)' }}
          >
            <p
              className="m-0 text-[16px] leading-[1.3]"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--ink)' }}
            >
              {standingGoal.title}
            </p>
            <span className="o-dot block mt-2.5 text-[10px]" style={{ color: 'var(--ink-45)' }}>
              Pinned · Goals
            </span>
          </button>
        </div>
      )}
    </aside>
  );
}
