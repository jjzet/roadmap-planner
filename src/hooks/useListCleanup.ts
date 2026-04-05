import { useState, useCallback } from 'react';
import Anthropic from '@anthropic-ai/sdk';
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

const SYSTEM_PROMPT = `You are a personal productivity assistant helping a senior technical leader tidy up their work todo list.

Analyse the list and suggest specific, concrete improvements. Be selective — only flag things that are clearly worthwhile. Do not pad with obvious or low-value suggestions.

Suggestion types:
- "archive": Item is completed and completedAt is more than 3 days ago (or completed with no date set). Safe to archive.
- "set_dev_status": Item text clearly implies a dev stage (e.g. "in review", "raised PR", "testing", "deployed", "merged") but the devStatus field doesn't reflect it.
- "set_due_date": Item text mentions a concrete timeframe ("this week", "by Friday", "end of month", "EOD") but has no dueDate. Suggest an ISO date (YYYY-MM-DD) based on today's date.
- "add_tags": Item clearly belongs to a topic cluster with other items. Suggest 1-2 short lowercase tags.
- "rename": Item text is vague, ambiguous, or longer than 12 words. Suggest a cleaner rewrite (max 12 words).
- "flag_stale": Item is incomplete, has no due date, no tags, no devStatus, and appears to have been sitting untouched — worth a review.

Rules:
- Write reasons in plain English, max 15 words, direct and specific.
- For set_dev_status: patch must include { "devStatus": "<dev|test|pr|merged>" }
- For add_tags: patch must include { "tags": ["tag1", "tag2"] } — merge with existing tags if present
- For rename: patch must include { "text": "<new text>" }
- For set_due_date: patch must include { "dueDate": "YYYY-MM-DD" }
- For archive: patch must be {}
- For flag_stale: patch must be {}
- displayBefore / displayAfter are plain strings for the UI to show what changes.

Return ONLY a valid JSON array. No markdown fences. No preamble. If no suggestions, return [].`;

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

      const response = await client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Today is ${today}. Analyse this todo list and return a JSON array of suggestions.

${JSON.stringify(itemList, null, 2)}

Be selective. Only suggest changes that are clearly worthwhile. Return [] if the list looks clean.

Each suggestion object must have: type, groupId, itemId, reason, patch, displayBefore (optional), displayAfter (optional).`,
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text' || !textBlock.text.trim()) {
        throw new Error('No response from AI');
      }

      const cleaned = textBlock.text
        .replace(/^```(?:json)?\n?/m, '')
        .replace(/\n?```$/m, '')
        .trim();

      const raw = JSON.parse(cleaned) as Array<{
        type: SuggestionType;
        groupId: string;
        itemId: string;
        reason: string;
        patch: Partial<TodoItem>;
        displayBefore?: string;
        displayAfter?: string;
      }>;

      const enriched: CleanupSuggestion[] = raw
        .filter((s) => {
          const group = groups.find((g) => g.id === s.groupId);
          const item = group?.items.find((it) => it.id === s.itemId);
          return !!item && !!s.type && !!s.reason;
        })
        .map((s, i) => {
          const group = groups.find((g) => g.id === s.groupId)!;
          const item = group.items.find((it) => it.id === s.itemId)!;
          return {
            ...s,
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
