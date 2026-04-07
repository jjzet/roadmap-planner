import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
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

interface RawSuggestion {
  type: SuggestionType;
  groupId: string;
  itemId: string;
  reason: string;
  newText?: string;
  newDevStatus?: 'dev' | 'test' | 'pr' | 'merged';
  newDueDate?: string;
  newTags?: string[];
  displayBefore?: string;
  displayAfter?: string;
}

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
      const today = new Date().toISOString().split('T')[0];

      const { data, error: fnError } = await supabase.functions.invoke('list-cleanup', {
        body: { items: itemList, today },
      });

      if (fnError) throw new Error(fnError.message ?? 'Edge function call failed');
      if (data?.error) throw new Error(data.error);

      const raw: RawSuggestion[] = data?.suggestions ?? [];

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
