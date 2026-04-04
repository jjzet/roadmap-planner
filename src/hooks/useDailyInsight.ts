import { useState, useEffect, useCallback } from 'react';
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

const SYSTEM_PROMPT = `You are a personal learning advisor to a senior technical leader and strategist working at the intersection of software engineering, financial systems, and strategic product delivery. They lead high-performing teams, make consequential decisions under pressure, and are already well-read and high-functioning.

Your job is to surface insights from great books that are genuinely NON-OBVIOUS — things a sharp, well-read professional would not already know or have encountered.

NEVER produce:
- Surface-level advice any professional already knows ("sleep more", "delegate effectively", "listen actively", "set clear goals")
- The headline takeaway that appears on the back cover or in every summary
- Generic productivity or wellness clichés
- Insights the reader would know just from hearing the book's title

ALWAYS produce:
- A specific mechanism, psychological finding, or counterintuitive result buried deeper in the book
- Something with a "I never would have guessed that" quality
- Insights backed by a specific study, percentage, named framework, or concrete experiment from the book
- The 20% of the book's knowledge that 80% of readers miss because they stop at the headline

The insight must be specific enough that someone could immediately act on it or test it. Vague inspiration is useless — precise, surprising, and actionable is the target.

Return only valid JSON. No markdown fences. No preamble.`;

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function categoryForDate(dateStr: string): string {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / 86_400_000);
  return CATEGORIES[dayOfYear % CATEGORIES.length];
}

async function generate(date: string): Promise<DailyInsight> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY is not set');

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const category = categoryForDate(date);

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Today is ${date}. Generate a daily book insight in the category: ${category}.

The insight MUST be non-obvious. Here is the bar to clear:
- If a professional could have guessed this without reading the book → rejected
- If it appears in the book's introduction or Amazon summary → rejected
- If it's a well-known concept just attributed to a book → rejected

Good examples of the depth and specificity I want:
- Not "Kahneman shows we have cognitive biases" → but "Kahneman's research shows that experts in fields with rapid, clear feedback loops (chess, firefighting) develop genuine intuition, while experts in low-feedback fields (clinical psychology, stock picking) develop confidence without accuracy — and the two are indistinguishable from the inside"
- Not "Sleep is important for performance" → but "Walker's data shows that 17 hours of continuous wakefulness produces cognitive impairment equivalent to 0.05% blood alcohol — the legal driving limit in most countries — yet most professionals never track this accumulation across a work week"

Return a single JSON object:
{
  "book": "exact published title",
  "author": "First Last",
  "category": "${category}",
  "concept": "the specific non-obvious idea in 8-14 words",
  "lesson": "one precise actionable sentence — include a specific number, mechanism, or named technique from the book (max 40 words)",
  "why_it_matters": "2 sentences on the specific mechanism or research finding that makes this surprising — explain WHY it works, not just THAT it works",
  "long_summary": "3-4 sentences: the specific technique or finding, its underlying mechanism, a concrete example from the book, and one implementation step a senior professional can try this week"
}`,
      },
    ],
  });

  // Extract text block (thinking blocks are separate)
  const textBlock = response.content.find((b) => b.type === 'text');
  const raw = textBlock?.type === 'text' ? textBlock.text : '{}';
  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  return JSON.parse(cleaned) as DailyInsight;
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

      // Generate and cache
      const insightData = await generate(date);
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
      const insightData = await generate(date);
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
