import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { GoalRecord } from '../types';
import { supabase } from '../lib/supabase';

interface GoalStore {
  goals: GoalRecord[];
  isLoading: boolean;

  fetchGoals: () => Promise<void>;
  createGoal: (title: string) => Promise<string | null>;
  updateGoal: (id: string, patch: { title?: string; body?: string }) => Promise<void>;
  archiveGoal: (id: string) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  getGoalById: (id: string) => GoalRecord | undefined;
}

export const useGoalStore = create<GoalStore>()(
  immer((set, get) => ({
    goals: [],
    isLoading: false,

    fetchGoals: async () => {
      set({ isLoading: true });
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('archived', false)
        .order('updated_at', { ascending: false });
      if (error) {
        console.error('Failed to fetch goals:', error);
        set({ isLoading: false });
        return;
      }
      set({ goals: (data || []) as GoalRecord[], isLoading: false });
    },

    createGoal: async (title) => {
      const { data, error } = await supabase
        .from('goals')
        .insert({ title, body: '' })
        .select()
        .single();
      if (error) {
        console.error('Failed to create goal:', error);
        return null;
      }
      set((s) => {
        s.goals.unshift(data as GoalRecord);
      });
      return data.id;
    },

    updateGoal: async (id, patch) => {
      const { error } = await supabase
        .from('goals')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        console.error('Failed to update goal:', error);
        return;
      }
      set((s) => {
        const goal = s.goals.find((g) => g.id === id);
        if (goal) {
          Object.assign(goal, patch);
          goal.updated_at = new Date().toISOString();
        }
      });
    },

    archiveGoal: async (id) => {
      const { error } = await supabase
        .from('goals')
        .update({ archived: true, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        console.error('Failed to archive goal:', error);
        return;
      }
      set((s) => {
        s.goals = s.goals.filter((g) => g.id !== id);
      });
    },

    deleteGoal: async (id) => {
      const { error } = await supabase.from('goals').delete().eq('id', id);
      if (error) {
        console.error('Failed to delete goal:', error);
        return;
      }
      set((s) => {
        s.goals = s.goals.filter((g) => g.id !== id);
      });
    },

    getGoalById: (id) => {
      return get().goals.find((g) => g.id === id);
    },
  }))
);
