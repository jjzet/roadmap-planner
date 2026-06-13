import { useState } from 'react';
import { useTodoStore } from '@/store/todoStore';
import { useJournalStore } from '@/store/journalStore';
import { useUIStore } from '@/store/uiStore';
import { useDashboardDataContext } from '@/hooks/DashboardDataContext';
import { computeStreak } from './JournalRibbon';
import { Moon, Sun } from 'lucide-react';

function formatToplineDate(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

interface Props {
  /** Optional slot rendered at the right edge of the topline (e.g. Review). */
  actions?: React.ReactNode;
}

/** Topline (date · counters · streak · theme) + masthead (page title + pulse). */
export function PageMasthead({ actions }: Props) {
  const todoName = useTodoStore((s) => s.todoName);
  const renameTodo = useTodoStore((s) => s.renameTodo);
  const saveStatus = useTodoStore((s) => s.saveStatus);
  const entries = useJournalStore((s) => s.entries);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const { data } = useDashboardDataContext();

  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(todoName);

  const streak = computeStreak(entries);

  const weekly = data?.velocity.daily;
  const trail = data?.trends.daily.slice(-7) ?? [];
  const maxTrail = Math.max(1, ...trail.map((b) => b.count));
  const inPlay = data ? data.totalTasks - data.completedTasks : null;

  const commitName = () => {
    setIsEditing(false);
    if (nameInput.trim() && nameInput !== todoName) renameTodo(nameInput.trim());
  };

  return (
    <>
      {/* ── Topline ── */}
      <div
        className="flex items-center justify-between pb-3"
        style={{ borderBottom: '2px solid var(--ink)' }}
      >
        <span className="text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>
          {formatToplineDate()}
        </span>
        <div className="flex items-center gap-4">
          <span className="o-dot text-[12px] hidden sm:inline" style={{ color: 'var(--ink-28)' }}>
            {saveStatus === 'saving' ? 'SAVING…' : saveStatus === 'error' ? 'SAVE ERROR' : ''}
          </span>
          {data && (
            <span className="o-dot text-[12.5px]" style={{ color: 'var(--ink-65)' }}>
              {data.completedTasks} / {data.totalTasks} CLEARED ALL-TIME
            </span>
          )}
          {streak > 0 && (
            <span className="o-dot text-[12.5px]" style={{ color: 'var(--blue)' }}>
              {'▪'.repeat(Math.min(streak, 5))} {streak}-DAY STREAK
            </span>
          )}
          {actions}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-8 h-8 rounded-lg cursor-pointer transition-colors"
            style={{ background: 'var(--ink-07)', border: '1px solid var(--ink-14)', color: 'var(--ink-65)' }}
            title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Masthead ── */}
      <div className="flex items-end justify-between pt-7 pb-2 gap-8">
        {isEditing ? (
          <input
            className="o-display flex-1 min-w-0 bg-transparent border-none outline-none p-0"
            style={{ fontSize: 'clamp(44px, 7vw, 84px)', color: 'var(--ink)' }}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') { setNameInput(todoName); setIsEditing(false); }
            }}
            autoFocus
          />
        ) : (
          <h1
            className="o-display m-0 cursor-text select-none truncate"
            style={{ fontSize: 'clamp(44px, 7vw, 84px)', color: 'var(--ink)' }}
            onClick={() => { setNameInput(todoName); setIsEditing(true); }}
            title="Click to rename"
          >
            {todoName || 'Untitled'}
          </h1>
        )}

        {/* Pulse */}
        {weekly && (
          <div className="text-right pb-2.5 flex-shrink-0">
            <span className="inline-grid grid-cols-7 gap-1 mb-2">
              {trail.map((b, i) => {
                const intensity = b.count / maxTrail;
                const bg =
                  b.count === 0 ? 'var(--ink-14)' :
                  intensity < 0.4 ? 'var(--lavender)' :
                  intensity < 0.75 ? 'var(--blue-mid)' : 'var(--blue)';
                return (
                  <span
                    key={i}
                    className="w-[11px] h-[11px] rounded-[3.5px]"
                    style={{ background: bg }}
                    title={`${b.label}: ${b.count} cleared`}
                  />
                );
              })}
            </span>
            <div className="text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>
              {weekly.current} cleared this week
              {inPlay !== null && (
                <span className="font-medium" style={{ color: 'var(--ink-45)' }}> · {inPlay} in play</span>
              )}
            </div>
            {weekly.delta !== null && weekly.delta !== 0 && (
              <div className="o-dot text-[12.5px] mt-0.5" style={{ color: 'var(--blue)' }}>
                {weekly.delta > 0 ? '+' : ''}{weekly.delta}% ON LAST WEEK
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
