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
  // Explicit patch fields — no dynamic record casting
  newText?: string;
  newDevStatus?: 'dev' | 'test' | 'pr' | 'merged';
  newDueDate?: string;
  newTags?: string[];
  displayBefore?: string;
  displayAfter?: string;
}

// ── Zod schema — explicit fields per suggestion type, no z.record ──

const SuggestionSchema = z.object({
  type: z.enum(['archive', 'set_dev_status', 'set_due_date', 'add_tags', 'rename', 'flag_stale']),
  groupId: z.string(),
  itemId: z.string(),
  reason: z.string(),
  newText: z.string().optional(),
  newDevStatus: z.enum(['dev', 'test', 'pr', 'merged']).optional(),
  newDueDate: z.string().optional(),
  newTags: z.array(z.string()).optional(),
  displayBefore: z.string().optional(),
  displayAfter: z.string().optional(),
});

const CleanupResponseSchema = z.object({
  suggestions: z.array(SuggestionSchema),
});

// ── System prompt ──

const SYSTEM_PROMPT = `You are a personal productivity assistant helping a senior technical leader tidy up their work todo list.

Analyse the list and suggest specific, concrete improvements. Be selective — only flag things that are clearly worthwhile.

Suggestion types and required fields:
- "archive": Item is completed and completedAt is more than 3 days ago, or completed with no date. No extra fields needed.
- "set_dev_status": Item text clearly implies a dev stage ("in review", "raised PR", "testing", "deployed", "merged") but devStatus doesn't match. Set newDevStatus to one of: dev, test, pr, merged.
- "set_due_date": Item mentions a concrete timeframe ("this week", "by Friday", "end of month") but has no dueDate. Set newDueDate as YYYY-MM-DD based on today's date.
- "add_tags": Item belongs to a clear topic cluster with other items. Set newTags as an array of 1-2 short lowercase strings.
- "rename": Item text is vague, ambiguous, or longer than 12 words. Set newText to a cleaner rewrite (max 12 words).
- "flag_stale": Item is incomplete, has no due date, no tags, no devStatus, and appears untouched for a long time. No extra fields needed.

Rules:
- reason: plain English, max 15 words, direct and specific
- displayBefore: current value as a short string (e.g. current text, current devStatus)
- displayAfter: proposed value as a short string (e.g. new text, new devStatus)
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
            id: `suggestion-${i}`,
            type: s.type,
            groupId: s.groupId,
            itemId: s.itemId,
            itemText: item.text,
            groupName: group.name,
            reason: s.reason,
            newText: s.newText,
            newDevStatus: s.newDevStatus,
            newDueDate: s.newDueDate,
            newTags: s.newTags,
            displayBefore: s.displayBefore,
            displayAfter: s.displayAfter,
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
        console.log('[cleanup] applying:', s.type, {
          newText: s.newText,
          newDevStatus: s.newDevStatus,
          newDueDate: s.newDueDate,
          newTags: s.newTags,
          displayBefore: s.displayBefore,
          displayAfter: s.displayAfter,
        });

        if (s.type === 'archive') {
          archiveItem(s.groupId, s.itemId);
        } else {
          const patch: Partial<TodoItem> = {};

          if (s.type === 'rename') {
            // Fall back to displayAfter if newText wasn't populated by the model
            const text = s.newText || s.displayAfter;
            if (text) patch.text = text;
          }

          if (s.type === 'set_dev_status') {
            // Fall back to displayAfter if newDevStatus wasn't populated
            const status = (s.newDevStatus || s.displayAfter) as TodoItem['devStatus'];
            if (status) patch.devStatus = status;
          }

          if (s.type === 'set_due_date') {
            const date = s.newDueDate || s.displayAfter;
            if (date) patch.dueDate = date;
          }

          if (s.type === 'add_tags' && s.newTags?.length) {
            patch.tags = s.newTags;
          }

          if (Object.keys(patch).length > 0) {
            updateItem(s.groupId, s.itemId, patch);
          } else {
            console.warn('[cleanup] no patch built for suggestion:', s.type, s.id);
          }
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
