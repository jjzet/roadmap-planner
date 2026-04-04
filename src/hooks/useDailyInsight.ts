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

const SYSTEM_PROMPT = `You are a personal learning advisor to a senior technical leader and strategist. Your job is to surface genuinely surprising, non-obvious insights from great books — things a sharp, well-read professional would not already know.

DEPTH BAR — the insight must pass this test:
- Could a professional guess this without reading the book? → rejected
- Is it the headline takeaway on the back cover or Amazon summary? → rejected
- Is it a well-known idea just attributed to a book? → rejected
The insight should make the reader think "I never would have guessed that."

WRITING STYLE — this is equally important:
- Write like a brilliant friend explaining something over coffee, not a scientist writing a paper
- No jargon. If a mechanism is involved, explain it in one plain sentence a non-expert immediately understands
- The practical "so what" must be front and centre — not buried at the end of technical detail
- Every sentence should feel like it's talking to the reader, not at them
- If you catch yourself writing words like "cytochrome", "upregulation", "transcription factor", "ROS", or similar — stop and rewrite in plain English

The reader leads technical teams, makes high-stakes decisions, manages stakeholders, and wants to perform at their best. Insights that connect to leadership, decision quality, communication, energy, or execution are especially valuable.

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
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Today is ${date}. Generate a daily book insight in the category: ${category}.

Pick a surprising, non-obvious finding from the book — something buried past the headline that most readers miss. Then explain it in plain, direct language.

Good examples of the tone and depth I want:
- "Kahneman found that experts who get fast, clear feedback (chess players, firefighters) build real intuition — but experts in slow-feedback fields (fund managers, therapists) build confidence without accuracy. The two feel identical from the inside, which means high confidence is not evidence of expertise."
- "Walker measured that after 17 hours awake your decision-making is as impaired as if you were legally drunk — yet most professionals don't track this the way they track other performance inputs."

Both are specific and surprising, but a teenager could understand them.

Return a single JSON object:
{
  "book": "exact published title",
  "author": "First Last",
  "category": "${category}",
  "concept": "the surprising idea in plain English, 8-12 words — no jargon",
  "lesson": "one sentence: what to do differently starting tomorrow, written plainly (max 35 words)",
  "why_it_matters": "2 plain-English sentences: what's surprising about this and why it changes how you should think or act at work",
  "long_summary": "3-4 sentences in plain English: the finding, why it's counterintuitive, a concrete example from the book, and one specific thing to try this week"
}`,
      },
    ],
  });

  // Find the text block (skip any thinking blocks)
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text' || !textBlock.text.trim()) {
    throw new Error(`No text content in response (blocks: ${response.content.map((b) => b.type).join(', ')})`);
  }

  const cleaned = textBlock.text
    .replace(/^```(?:json)?\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim();

  const parsed = JSON.parse(cleaned) as Partial<DailyInsight>;

  // Fill in category from our computed value if the model omitted it
  // (the model sometimes skips it since it's told the value in the prompt)
  if (!parsed.category) parsed.category = category;

  // Only hard-fail on fields that are essential to display
  const required: (keyof DailyInsight)[] = ['book', 'concept', 'lesson'];
  const missing = required.filter((k) => !parsed[k]);
  if (missing.length > 0) {
    throw new Error(`Insight missing required fields: ${missing.join(', ')}`);
  }

  return parsed as DailyInsight;
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
