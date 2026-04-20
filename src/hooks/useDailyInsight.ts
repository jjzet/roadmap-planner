import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { DailyInsight } from '@/types';

export type { DailyInsight };

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

type InsightHistoryEntry = { book?: string; author?: string; concept?: string };

async function loadHistory(excludeDate: string): Promise<InsightHistoryEntry[]> {
  const { data, error } = await supabase
    .from('daily_insights')
    .select('insight_data, date')
    .neq('date', excludeDate)
    .order('date', { ascending: false })
    .limit(120);
  if (error || !data) return [];
  return data
    .map((row) => row.insight_data as DailyInsight | null)
    .filter((d): d is DailyInsight => !!d)
    .map((d) => ({ book: d.book, author: d.author, concept: d.concept }));
}

async function generate(date: string, history: InsightHistoryEntry[]): Promise<DailyInsight> {
  const { data, error } = await supabase.functions.invoke('generate-insight', {
    body: { date, history },
  });

  if (error) throw new Error(error.message ?? 'Edge function call failed');
  if (data?.error) throw new Error(data.error);

  return data as DailyInsight;
}

export function useDailyInsight() {
  const [insight, setInsight] = useState<DailyInsight | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const date = todayKey();
    setIsLoading(true);
    setError(null);

    try {
      // Check cache first
      const { data: cached } = await supabase
        .from('daily_insights')
        .select('insight_data')
        .eq('date', date)
        .maybeSingle();

      if (cached?.insight_data) {
        setInsight(cached.insight_data as DailyInsight);
        setIsLoading(false);
        return;
      }

      // Generate via edge function and cache
      const history = await loadHistory(date);
      const insightData = await generate(date, history);
      await supabase
        .from('daily_insights')
        .upsert({ date, insight_data: insightData }, { onConflict: 'date' });
      setInsight(insightData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insight');
    } finally {
      setIsLoading(false);
    }
  }

  const refresh = useCallback(async () => {
    const date = todayKey();
    setIsRefreshing(true);
    setError(null);

    try {
      // Delete cached entry so a fresh one is generated
      await supabase.from('daily_insights').delete().eq('date', date);
      const history = await loadHistory(date);
      const insightData = await generate(date, history);
      await supabase
        .from('daily_insights')
        .upsert({ date, insight_data: insightData }, { onConflict: 'date' });
      setInsight(insightData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh insight');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return { insight, isLoading, isRefreshing, error, refresh };
}
