import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { JournalEntry } from '../types';
import { supabase } from '../lib/supabase';

export type EntryDraft = { forward: string; blockers: string; tomorrow: string };

interface JournalStore {
  // All entries, keyed by date (YYYY-MM-DD).
  entries: Record<string, JournalEntry>;
  selectedDate: string;        // currently-edited date
  isLoading: boolean;
  isSaving: boolean;
  loaded: boolean;

  fetchAll: () => Promise<void>;
  setSelectedDate: (date: string) => void;
  upsertEntry: (date: string, draft: EntryDraft) => Promise<void>;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export const useJournalStore = create<JournalStore>()(
  immer((set) => ({
    entries: {},
    selectedDate: todayISO(),
    isLoading: false,
    isSaving: false,
    loaded: false,

    fetchAll: async () => {
      set({ isLoading: true });
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .order('date', { ascending: false });
      if (error) {
        console.error('Failed to fetch journal entries:', error);
        set({ isLoading: false });
        return;
      }
      const map: Record<string, JournalEntry> = {};
      for (const row of (data ?? []) as JournalEntry[]) {
        map[row.date] = row;
      }
      set((s) => {
        s.entries = map;
        s.isLoading = false;
        s.loaded = true;
      });
    },

    setSelectedDate: (date) => set({ selectedDate: date }),

    upsertEntry: async (date, draft) => {
      set({ isSaving: true });
      const isEmpty = !draft.forward.trim() && !draft.blockers.trim() && !draft.tomorrow.trim();

      // If the user blanked the whole entry, delete it (so heatmap is honest).
      if (isEmpty) {
        const { error } = await supabase.from('journal_entries').delete().eq('date', date);
        if (error) {
          console.error('Failed to delete entry:', error);
          set({ isSaving: false });
          return;
        }
        set((s) => {
          delete s.entries[date];
          s.isSaving = false;
        });
        return;
      }

      const payload = {
        date,
        forward: draft.forward,
        blockers: draft.blockers,
        tomorrow: draft.tomorrow,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('journal_entries')
        .upsert(payload, { onConflict: 'date' })
        .select()
        .single();
      if (error) {
        console.error('Failed to save journal entry:', error);
        set({ isSaving: false });
        return;
      }
      set((s) => {
        s.entries[date] = data as JournalEntry;
        s.isSaving = false;
      });
    },
  }))
);
