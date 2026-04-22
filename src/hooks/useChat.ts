import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useChatStore, type ChatMessage, type ToolCallSummary } from '@/store/chatStore';
import { useTodoStore } from '@/store/todoStore';

const CHAT_URL = 'https://nebfkwfgjtqinrfiglva.supabase.co/functions/v1/chat';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lYmZrd2ZnanRxaW5yZmlnbHZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNDIzODcsImV4cCI6MjA4NjcxODM4N30.8hx_3VfKrxMy9hXD94PgU2OAGoZ1YNJtK8HRj2PCGDA';

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

function isToolResultTurn(role: string, content: unknown): boolean {
  return (
    role === 'user' &&
    Array.isArray(content) &&
    (content as ContentBlock[]).some((b) => b.type === 'tool_result')
  );
}

function extractText(role: string, content: unknown): string | null {
  if (typeof content === 'string') return content || null;
  if (Array.isArray(content)) {
    if (isToolResultTurn(role, content)) return null;
    const textBlock = (content as ContentBlock[]).find((b) => b.type === 'text');
    return textBlock?.type === 'text' ? textBlock.text || null : null;
  }
  return null;
}

function extractToolUses(content: unknown): Array<{ id: string; name: string; input: Record<string, unknown> }> {
  if (!Array.isArray(content)) return [];
  return (content as ContentBlock[])
    .filter((b): b is Extract<ContentBlock, { type: 'tool_use' }> => b.type === 'tool_use')
    .map((b) => ({ id: b.id, name: b.name, input: b.input }));
}

function extractToolResultErrors(content: unknown): Map<string, string | undefined> {
  const out = new Map<string, string | undefined>();
  if (!Array.isArray(content)) return out;
  for (const b of content as ContentBlock[]) {
    if (b.type !== 'tool_result') continue;
    let err: string | undefined;
    try {
      const parsed = JSON.parse(b.content);
      if (parsed && typeof parsed === 'object' && 'error' in parsed) {
        err = String(parsed.error);
      }
    } catch {
      // non-JSON result = success
    }
    out.set(b.tool_use_id, err);
  }
  return out;
}

export function useChat() {
  const {
    messages,
    isLoading,
    error,
    historyLoaded,
    setConversationId,
    setMessages,
    appendMessage,
    replaceMessage,
    removeMessage,
    setLoading,
    setError,
    setHistoryLoaded,
  } = useChatStore();

  useEffect(() => {
    if (historyLoaded) return;
    loadHistory();
  }, [historyLoaded]);

  async function loadHistory() {
    try {
      const { data: conv } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('user_id', 'default')
        .maybeSingle();

      if (!conv?.id) {
        setHistoryLoaded(true);
        return;
      }

      setConversationId(conv.id);

      const { data: rows } = await supabase
        .from('ai_messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', conv.id)
        .order('sequence', { ascending: true });

      // Walk messages in order. Tool-use blocks from assistant turns accumulate in
      // a buffer; tool_result blocks from subsequent user turns annotate those
      // entries with ok/error; the buffer attaches to the next assistant TEXT turn.
      const displayable: ChatMessage[] = [];
      const pending: ToolCallSummary[] = [];
      const pendingIds: string[] = [];
      const allRows = rows ?? [];
      for (const row of allRows) {
        if (row.role === 'assistant') {
          const uses = extractToolUses(row.content);
          for (const u of uses) {
            pending.push({ name: u.name, ok: true, input: u.input });
            pendingIds.push(u.id);
          }
          const text = extractText(row.role, row.content);
          if (text) {
            const attached = pending.length > 0 ? [...pending] : undefined;
            displayable.push({
              id: row.id,
              role: 'assistant',
              text,
              created_at: row.created_at,
              toolCalls: attached,
            });
            pending.length = 0;
            pendingIds.length = 0;
          }
        } else if (row.role === 'user') {
          if (isToolResultTurn(row.role, row.content)) {
            const errs = extractToolResultErrors(row.content);
            pendingIds.forEach((id, idx) => {
              const err = errs.get(id);
              if (err) {
                pending[idx].ok = false;
                pending[idx].error = err;
              }
            });
          } else {
            const text = extractText(row.role, row.content);
            if (text) {
              displayable.push({ id: row.id, role: 'user', text, created_at: row.created_at });
            }
          }
        }
      }
      setMessages(displayable);
    } finally {
      setHistoryLoaded(true);
    }
  }

  const sendMessage = useCallback(
    async (userText: string, activePageId: string | null) => {
      if (!userText.trim() || isLoading) return;

      setLoading(true);
      setError(null);

      const tempId = `pending-${Date.now()}`;
      appendMessage({ id: tempId, role: 'user', text: userText.trim(), created_at: new Date().toISOString() });

      try {
        const res = await fetch(CHAT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({ user_message: userText.trim(), active_page_id: activePageId }),
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`HTTP ${res.status}: ${body}`);
        }

        const { text, conversation_id, tool_calls, mutated } = await res.json();
        if (conversation_id) setConversationId(conversation_id);

        // Replace the temp user message with a stable one (no real ID from server for user turn)
        replaceMessage(tempId, {
          id: `user-${Date.now()}`,
          role: 'user',
          text: userText.trim(),
          created_at: new Date().toISOString(),
        });

        appendMessage({
          id: `assist-${Date.now()}`,
          role: 'assistant',
          text,
          created_at: new Date().toISOString(),
          toolCalls: Array.isArray(tool_calls) && tool_calls.length > 0 ? tool_calls : undefined,
        });

        if (mutated) {
          const { fetchTodoList, loadTodo, currentTodoId } = useTodoStore.getState();
          await fetchTodoList();
          if (currentTodoId) await loadTodo(currentTodoId);
        }
      } catch (err) {
        removeMessage(tempId);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    [isLoading, appendMessage, replaceMessage, removeMessage, setLoading, setError, setConversationId]
  );

  return { messages, isLoading, error, sendMessage };
}
