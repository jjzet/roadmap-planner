import { useEffect } from 'react';
import { useBoardStore } from '@/store/boardStore';
import { useUIStore } from '@/store/uiStore';
import { useDashboardDataContext } from '@/hooks/DashboardDataContext';
import { getPersona } from './personas';

/** Today's note from the Board, in the page margin. */
export function BoardNoteCard() {
  const dailyNote = useBoardStore((s) => s.dailyNote);
  const generating = useBoardStore((s) => s.noteGenerating);
  const error = useBoardStore((s) => s.noteError);
  const ensureDailyNote = useBoardStore((s) => s.ensureDailyNote);
  const setActivePersona = useBoardStore((s) => s.setActivePersona);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const { data } = useDashboardDataContext();

  useEffect(() => {
    ensureDailyNote(data);
  }, [data, ensureDailyNote]);

  const persona = dailyNote ? getPersona(dailyNote.personaId) : undefined;

  return (
    <div
      className="rounded-[14px] p-4"
      style={{ background: 'var(--paper-raise)', border: '1px solid var(--ink-14)' }}
    >
      {generating && !dailyNote ? (
        <p className="o-dot m-0 text-[10.5px]" style={{ color: 'var(--ink-45)' }}>
          THE BOARD IS CONVENING…
        </p>
      ) : error && !dailyNote ? (
        <p className="m-0 text-[13px]" style={{ color: 'var(--ink-45)' }}>
          The board couldn’t convene. {' '}
          <button
            onClick={() => ensureDailyNote(data)}
            className="border-none bg-transparent cursor-pointer p-0 font-semibold"
            style={{ color: 'var(--blue)' }}
          >
            Retry →
          </button>
        </p>
      ) : dailyNote ? (
        <>
          <p className="m-0 text-[14px] leading-[1.5] font-medium" style={{ color: 'var(--ink)' }}>
            {dailyNote.text}
          </p>
          {persona && (
            <span
              className="o-dot inline-block mt-3 text-[10px] rounded-[6px] px-2 py-1"
              style={{ background: 'var(--blue)', color: 'var(--on-blue)' }}
            >
              {persona.name}
            </span>
          )}
          <button
            onClick={() => {
              if (dailyNote) setActivePersona(dailyNote.personaId);
              setActiveView('board');
            }}
            className="block mt-3 border-none bg-transparent cursor-pointer p-0 text-[12.5px] font-semibold hover:opacity-70 transition-opacity"
            style={{ color: 'var(--blue)' }}
          >
            Reply →
          </button>
        </>
      ) : (
        <p className="o-dot m-0 text-[10.5px]" style={{ color: 'var(--ink-28)' }}>
          WAITING FOR THE DAY’S DATA…
        </p>
      )}
    </div>
  );
}
