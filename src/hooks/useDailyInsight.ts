import { useState, useEffect } from 'react';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/supabase';

export interface DailyInsight {
  book: string;
  author: string;
  category: string;
  concept: string;
  lesson: string;
  why_it_matters: string;
  long_summary: string;
}

// Rotate through categories by day of year for predictable variety
const CATEGORIES = [
  'leadership',
  'communication',
  'design thinking',
  'performance',
  'decision making',
  'negotiation',
  'biohacking',
  'systems thinking',
  'habits',
  'creativity',
  'organisational culture',
];

function todayKey(): string {
  return new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
}

function categoryForDate(dateStr: string): string {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / 86_400_000);
  return CATEGORIES[dayOfYear % CATEGORIES.length];
}

export function useDailyInsight() {
  const [insight, setInsight] = useState<DailyInsight | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const date = todayKey();

    try {
      // ── 1. Check Supabase cache ──
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

      // ── 2. Generate with Claude ──
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
      if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY is not set');

      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
      const category = categoryForDate(date);

      const response = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system: `You select great books and extract genuinely useful, specific takeaways for busy professionals. Be concrete and actionable — never generic or platitudinous. Return only valid JSON, no markdown fences, no preamble.

Draw from a wide range of titles including well-known classics and lesser-known gems across: leadership, communication, design thinking, performance coaching, decision making, negotiation, biohacking, systems thinking, habits & behaviour, creativity, and organisational culture. Avoid repeating the same handful of famous books. Vary authors, regions, eras, and perspectives.`,
        messages: [
          {
            role: 'user',
            content: `Today is ${date}. Generate a daily book insight focused on the category: ${category}.

Return a single JSON object with exactly these fields:
{
  "book": "exact published title",
  "author": "First Last",
  "category": "${category}",
  "concept": "the core idea in 6-10 words",
  "lesson": "one concrete actionable sentence, max 30 words",
  "why_it_matters": "1-2 sentences on why this is relevant for a professional leading technical or strategic work",
  "long_summary": "3-4 sentences expanding the concept — include a specific technique, framework, or example from the book"
}`,
          },
        ],
      });

      const raw = response.content[0].type === 'text' ? response.content[0].text : '{}';
      // Strip any accidental markdown code fences
      const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
      const insightData = JSON.parse(cleaned) as DailyInsight;

      // ── 3. Cache in Supabase ──
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

  return { insight, isLoading, error };
}
