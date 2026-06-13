import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { askClaude, type ChatTurn } from '@/lib/anthropic';
import { BOARD_PERSONAS, getPersona } from '@/components/board/personas';
import { buildBoardContext, buildPersonaSystem } from '@/lib/boardContext';
import type { DashboardData } from '@/hooks/useDashboardData';

export interface BoardMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: string; // ISO
}

interface DailyNote {
  date: string; // YYYY-MM-DD
  personaId: string;
  text: string;
}

interface BoardState {
  dailyNote: DailyNote | null;
  noteGenerating: boolean;
  noteError: string | null;

  threads: Record<string, BoardMessage[]>;
  activePersonaId: string;
  replying: boolean;
  replyError: string | null;

  setActivePersona: (id: string) => void;
  ensureDailyNote: (dashboard: DashboardData | null) => Promise<void>;
  sendToPersona: (personaId: string, text: string, dashboard: DashboardData | null) => Promise<void>;
  clearThread: (personaId: string) => void;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function uuid(): string {
  return crypto.randomUUID();
}

/** Rotate the note-writer daily so the margin voice varies through the week. */
function personaForToday(): string {
  const day = Math.floor(Date.now() / 86_400_000);
  return BOARD_PERSONAS[day % BOARD_PERSONAS.length].id;
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
      dailyNote: null,
      noteGenerating: false,
      noteError: null,

      threads: {},
      activePersonaId: BOARD_PERSONAS[0].id,
      replying: false,
      replyError: null,

      setActivePersona: (id) => set({ activePersonaId: id }),

      ensureDailyNote: async (dashboard) => {
        const { dailyNote, noteGenerating } = get();
        const today = todayKey();
        if (noteGenerating) return;
        if (dailyNote && dailyNote.date === today) return;
        // Wait until the day has data behind it.
        if (!dashboard) return;

        const personaId = personaForToday();
        const persona = getPersona(personaId)!;
        set({ noteGenerating: true, noteError: null });
        try {
          const context = buildBoardContext(dashboard);
          const system = buildPersonaSystem(persona, context);
          const text = await askClaude(
            system,
            [
              {
                role: 'user',
                content:
                  'Write your short margin note for today — the one thing you most want them to see when they open the page. 2-3 sentences, max 55 words. No greeting, no sign-off.',
              },
            ],
            220
          );
          set({ dailyNote: { date: today, personaId, text }, noteGenerating: false });
        } catch (err) {
          set({
            noteGenerating: false,
            noteError: err instanceof Error ? err.message : 'Failed to convene the board',
          });
        }
      },

      sendToPersona: async (personaId, text, dashboard) => {
        const trimmed = text.trim();
        if (!trimmed || get().replying) return;
        const persona = getPersona(personaId);
        if (!persona) return;

        const userMsg: BoardMessage = { id: uuid(), role: 'user', text: trimmed, at: new Date().toISOString() };
        set((s) => ({
          threads: { ...s.threads, [personaId]: [...(s.threads[personaId] ?? []), userMsg] },
          replying: true,
          replyError: null,
        }));

        try {
          const context = buildBoardContext(dashboard);
          const system = buildPersonaSystem(persona, context);
          const history: ChatTurn[] = (get().threads[personaId] ?? []).slice(-12).map((m) => ({
            role: m.role,
            content: m.text,
          }));
          const reply = await askClaude(system, history, 700);
          const assistantMsg: BoardMessage = { id: uuid(), role: 'assistant', text: reply, at: new Date().toISOString() };
          set((s) => ({
            threads: { ...s.threads, [personaId]: [...(s.threads[personaId] ?? []), assistantMsg] },
            replying: false,
          }));
        } catch (err) {
          set({
            replying: false,
            replyError: err instanceof Error ? err.message : 'The board member did not respond',
          });
        }
      },

      clearThread: (personaId) =>
        set((s) => {
          const threads = { ...s.threads };
          delete threads[personaId];
          return { threads };
        }),
    }),
    {
      name: 'orbit-board',
      partialize: (s) => ({ dailyNote: s.dailyNote, threads: s.threads, activePersonaId: s.activePersonaId }),
    }
  )
);
