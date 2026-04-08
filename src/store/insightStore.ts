import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { DailyInsight, FavouriteInsight } from '../types';
import { supabase } from '../lib/supabase';

interface InsightRecord {
  date: string;
  insight_data: DailyInsight;
  created_at: string;
}

interface InsightStore {
  favourites: FavouriteInsight[];
  allInsights: InsightRecord[];
  isLoading: boolean;

  fetchFavourites: () => Promise<void>;
  fetchAllInsights: () => Promise<void>;
  toggleFavourite: (date: string, insightData: DailyInsight) => Promise<void>;
  isFavourited: (date: string) => boolean;
}

export const useInsightStore = create<InsightStore>()(
  immer((set, get) => ({
    favourites: [],
    allInsights: [],
    isLoading: false,

    fetchFavourites: async () => {
      const { data, error } = await supabase
        .from('favourite_insights')
        .select('*')
        .order('favourited_at', { ascending: false });
      if (error) {
        console.error('Failed to fetch favourites:', error);
        return;
      }
      set({ favourites: (data || []) as FavouriteInsight[] });
    },

    fetchAllInsights: async () => {
      set({ isLoading: true });
      const { data, error } = await supabase
        .from('daily_insights')
        .select('*')
        .order('date', { ascending: false });
      if (error) {
        console.error('Failed to fetch insights:', error);
        set({ isLoading: false });
        return;
      }
      set({ allInsights: (data || []) as InsightRecord[], isLoading: false });
    },

    toggleFavourite: async (date, insightData) => {
      const existing = get().favourites.find((f) => f.date === date);
      if (existing) {
        await supabase.from('favourite_insights').delete().eq('id', existing.id);
        set((s) => {
          s.favourites = s.favourites.filter((f) => f.id !== existing.id);
        });
      } else {
        const { data, error } = await supabase
          .from('favourite_insights')
          .insert({ date, insight_data: insightData })
          .select()
          .single();
        if (!error && data) {
          set((s) => {
            s.favourites.unshift(data as FavouriteInsight);
          });
        }
      }
    },

    isFavourited: (date) => {
      return get().favourites.some((f) => f.date === date);
    },
  }))
);
