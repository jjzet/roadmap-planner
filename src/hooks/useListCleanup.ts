import { useState, useCallback } from 'react';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { useTodoStore } from '@/store/todoStore';
import type { TodoItem, TodoGroup } from '@/types';

export type SuggestionType =
  | 'archive'
  | 'set_dev_status'
  | 'set_due_date'
  | 'add_tags'
  | 'rename'
  | 'flag_stale';

export interface CleanupSuggestion {
  id: string;
  type: SuggestionType;
  groupId: string;
  itemId: string;
  itemText: string;
  groupName: string;
  reason: string;
  patch: Partial<TodoItem>;
  displayBefore?: string;
  displayAfter?: string;
}

// ── Zod schema — constrained decoding enforces this shape at the API level ──

const SuggestionSchema = z.object({
  type: z.enum(['archive', 'set_dev_status', 'set_due_date', 'add_tags', 'rename', 'flag_stale']),
  groupId: z.string(),
  itemId: z.string(),
  reason: z.string(),
  patch: z.record(z.string(), z.unknown()),
  displayBefore: z.string().optional(),
  displayAfter: z.string().optional(),
});

const CleanupResponseSchema = z.object({
  suggestions: z.array(SuggestionSchema),
});

// ── System prompt ──

const SYSTEM_PROMPT = `You are a personal productivity assistant helping a senior technical leader tidy up their work todo list.

Analyse the list and suggest specific, concrete improvements. Be selective — only flag things that are clearly worthwhile. Do not pad with low-value suggestions.

Suggestion types:
- "archive": Item is completed and completedAt is more than 3 days ago (or completed with no date set). Safe to archive. patch must be {}.
- "set_dev_status": Item text clearly implies a dev stage (e.g. "in review", "raised PR", "testing", "deployed", "merged") but devStatus doesn't reflect it. patch must include { "devStatus": "dev"|"test"|"pr"|"merged" }.
- "set_due_date": Item text mentions a concrete timeframe ("this week", "by Friday", "end of month", "EOD") but has no dueDate. Suggest an ISO date (YYYY-MM-DD). patch must include { "dueDate": "YYYY-MM-DD" }.
- "add_tags": Item clearly belongs to a topic cluster with other items. Suggest 1-2 short lowercase tags. patch must include { "tags": ["tag1"] }.
- "rename": Item text is vague, ambiguous, or longer than 12 words. Suggest a cleaner rewrite (max 12 words). patch must include { "text": "new text" }.
- "flag_stale": Item is incomplete, has no due date, no tags, no devStatus, and appears untouched. Worth reviewing. patch must be {}.

Rules:
- reason: plain English, max 15 words, direct and specific
- displayBefore: current value as a short string (for renames, status changes)
- displayAfter: proposed value as a short string
- Be selective. Return an empty suggestions array if the list looks clean.`;

export function useListCleanup() {
  const [suggestions, setSuggestions] = useState<CleanupSuggestion[]>([]);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const todo = useTodoStore((s) => s.todo);
  const updateItem = useTodoStore((s) => s.updateItem);
  const archiveItem = useTodoStore((s) => s.archiveItem);
  const saveTodo = useTodoStore((s) => s.saveTodo);

  const analyse = useCallback(async () => {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
    if (!apiKey) {
      setError('VITE_ANTHROPIC_API_KEY is not set — add it to your environment to enable cleanup.');
      setIsDone(true);
      return;
    }

    const groups = todo.blocks
      .filter((b) => b.type === 'group')
      .map((b) => b.data as TodoGroup);

    const itemList = groups.flatMap((g) =>
      g.items
        .filter((it) => !it.archived)
        .map((it) => ({
          groupId: g.id,
          groupName: g.name,
          itemId: it.id,
          text: it.text,
          completed: it.completed,
          completedAt: it.completedAt ?? null,
          pinned: it.pinned,
          dueDate: it.dueDate ?? null,
          tags: it.tags,
          devStatus: it.devStatus ?? null,
        }))
    );

    if (itemList.length === 0) {
      setSuggestions([]);
      setIsDone(true);
      return;
    }

    setIsAnalysing(true);
    setError(null);
    setIsDone(false);

    try {
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
      const today = new Date().toISOString().split('T')[0];

      const response = await client.messages.parse({
        model: 'claude-opus-4-6',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Today is ${today}. Analyse this todo list and return suggestions.

${JSON.stringify(itemList, null, 2)}

Be selective. Only suggest changes that are clearly worthwhile.`,
          },
        ],
        output_config: { format: zodOutputFormat(CleanupResponseSchema) },
      });

      const raw = response.parsed_output?.suggestions ?? [];

      const enriched: CleanupSuggestion[] = raw
        .filter((s) => {
          const group = groups.find((g) => g.id === s.groupId);
          const item = group?.items.find((it) => it.id === s.itemId);
          return !!item;
        })
        .map((s, i) => {
          const group = groups.find((g) => g.id === s.groupId)!;
          const item = group.items.find((it) => it.id === s.itemId)!;
          return {
            type: s.type,
            groupId: s.groupId,
            itemId: s.itemId,
            reason: s.reason,
            patch: s.patch as Partial<TodoItem>,
            displayBefore: s.displayBefore,
            displayAfter: s.displayAfter,
            id: `suggestion-${i}`,
            itemText: item.text,
            groupName: group.name,
          };
        });

      setSuggestions(enriched);
      setIsDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyse list');
      setIsDone(true);
    } finally {
      setIsAnalysing(false);
    }
  }, [todo]);

  const applySelected = useCallback(
    async (selectedIds: Set<string>) => {
      const toApply = suggestions.filter((s) => selectedIds.has(s.id));
      for (const s of toApply) {
        if (s.type === 'archive') {
          archiveItem(s.groupId, s.itemId);
        } else if (Object.keys(s.patch).length > 0) {
          updateItem(s.groupId, s.itemId, s.patch);
        }
      }
      await saveTodo();
      setSuggestions([]);
      setIsDone(false);
    },
    [suggestions, archiveItem, updateItem, saveTodo]
  );

  const dismiss = useCallback(() => {
    setSuggestions([]);
    setIsDone(false);
    setError(null);
  }, []);

  return { suggestions, isAnalysing, error, isDone, analyse, applySelected, dismiss };
}
