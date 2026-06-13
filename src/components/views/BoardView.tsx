import { useEffect, useRef, useState } from 'react';
import { useBoardStore } from '@/store/boardStore';
import { useDashboardDataContext } from '@/hooks/DashboardDataContext';
import { BOARD_PERSONAS, getPersona } from '@/components/board/personas';
import { ArrowUp, Trash2 } from 'lucide-react';

/**
 * The Board room: pick a member, talk it through. Every member reads the same
 * live context pack (goals, work state, journal) and answers through their lens.
 */
export function BoardView() {
  const activePersonaId = useBoardStore((s) => s.activePersonaId);
  const setActivePersona = useBoardStore((s) => s.setActivePersona);
  const threads = useBoardStore((s) => s.threads);
  const replying = useBoardStore((s) => s.replying);
  const replyError = useBoardStore((s) => s.replyError);
  const sendToPersona = useBoardStore((s) => s.sendToPersona);
  const clearThread = useBoardStore((s) => s.clearThread);
  const { data } = useDashboardDataContext();

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const persona = getPersona(activePersonaId) ?? BOARD_PERSONAS[0];
  const thread = threads[persona.id] ?? [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread.length, replying]);

  const send = () => {
    if (!input.trim() || replying) return;
    sendToPersona(persona.id, input, data);
    setInput('');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="o-scroll flex-1 overflow-y-auto">
        <div className="max-w-[1060px] mx-auto px-10 pt-9 pb-44 w-full">

          {/* Masthead */}
          <div className="pb-3" style={{ borderBottom: '2px solid var(--ink)' }}>
            <span className="text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          <h1 className="o-display m-0 pt-7 pb-6" style={{ fontSize: 'clamp(44px, 7vw, 84px)', color: 'var(--ink)' }}>
            The Board
          </h1>

          {/* Member rail */}
          <div className="flex gap-2.5 flex-wrap pb-8">
            {BOARD_PERSONAS.map((p, i) => {
              const on = p.id === persona.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePersona(p.id)}
                  className="text-left rounded-[14px] px-4 py-3.5 cursor-pointer transition-all"
                  style={{
                    background: on ? 'var(--ink)' : 'var(--paper-raise)',
                    border: `1px solid ${on ? 'var(--ink)' : 'var(--ink-14)'}`,
                    minWidth: 168,
                  }}
                >
                  <span className="o-dot block text-[10px] mb-1" style={{ color: on ? 'var(--sand)' : 'var(--blue)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="block text-[15px] font-bold" style={{ color: on ? 'var(--paper)' : 'var(--ink)' }}>
                    {p.name}
                  </span>
                  <span className="block text-[12px] font-medium mt-0.5" style={{ color: on ? 'rgba(242,239,232,.65)' : 'var(--ink-45)' }}>
                    {p.role}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Thread */}
          <div ref={scrollRef} className="min-h-[200px]">
            {thread.length === 0 && (
              <div className="py-10">
                <p className="o-kicker m-0 mb-2">{persona.name}</p>
                <p className="m-0 text-[15px] max-w-[560px] leading-[1.55]" style={{ color: 'var(--ink-65)' }}>
                  {persona.charter.split('.').slice(0, 2).join('.')}.
                  {' '}Ask anything — they’ve already read your goals, your lists, and your journal.
                </p>
              </div>
            )}

            {thread.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
                <div
                  className="max-w-[640px] rounded-[16px] px-4.5 py-3 px-5"
                  style={
                    m.role === 'user'
                      ? { background: 'var(--ink)', color: 'var(--paper)' }
                      : { background: 'var(--paper-raise)', border: '1px solid var(--ink-14)', color: 'var(--ink)' }
                  }
                >
                  {m.role === 'assistant' && (
                    <span className="o-dot block text-[9.5px] mb-1.5" style={{ color: 'var(--blue)' }}>
                      {persona.name}
                    </span>
                  )}
                  <p className="m-0 text-[14.5px] leading-[1.55] font-medium whitespace-pre-wrap">{m.text}</p>
                </div>
              </div>
            ))}

            {replying && (
              <div className="flex justify-start mb-4">
                <div
                  className="rounded-[16px] px-5 py-3"
                  style={{ background: 'var(--paper-raise)', border: '1px solid var(--ink-14)' }}
                >
                  <span className="o-dot text-[10.5px]" style={{ color: 'var(--ink-45)' }}>
                    {persona.name.toUpperCase()} IS THINKING…
                  </span>
                </div>
              </div>
            )}

            {replyError && (
              <p className="text-[13px]" style={{ color: 'var(--blue)' }}>{replyError}</p>
            )}
          </div>

          {thread.length > 0 && (
            <button
              onClick={() => clearThread(persona.id)}
              className="o-dot flex items-center gap-1.5 text-[10px] text-o-ink-28 hover:text-o-ink-65 border-none bg-transparent cursor-pointer p-0 mt-2"
            >
              <Trash2 className="w-3 h-3" />
              Clear thread
            </button>
          )}
        </div>
      </div>

      {/* Composer — floats above the dock */}
      <div className="fixed left-0 right-0 bottom-[104px] z-40 flex justify-center pointer-events-none px-6">
        <div
          className="pointer-events-auto w-[720px] max-w-full rounded-[18px] p-2 flex items-center gap-2"
          style={{
            background: 'var(--paper-raise)',
            border: '1px solid var(--ink-14)',
            boxShadow: '0 24px 60px -16px rgba(0,0,0,.25)',
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            placeholder={`Talk to ${persona.name}…`}
            className="flex-1 bg-transparent border-none outline-none px-3 py-2.5 text-[14.5px] font-medium"
            style={{ color: 'var(--ink)' }}
          />
          <button
            onClick={send}
            disabled={replying || !input.trim()}
            className="flex items-center justify-center w-10 h-10 rounded-[12px] border-none cursor-pointer disabled:opacity-40"
            style={{ background: 'var(--blue)', color: 'var(--on-blue)' }}
            title="Send"
          >
            <ArrowUp className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
