import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useChatStore, type ChatMessage } from '@/store/chatStore';

const CHAT_URL = 'https://nebfkwfgjtqinrfiglva.supabase.co/functions/v1/chat';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lYmZrd2ZnanRxaW5yZmlnbHZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNDIzODcsImV4cCI6MjA4NjcxODM4N30.8hx_3VfKrxMy9hXD94PgU2OAGoZ1YNJtK8HRj2PCGDA';

// Extract a display-safe string from a stored message content block.
// Skips pure tool_result user turns (internal plumbing, not user prose).
function extractText(role: string, content: unknown): string | null {
  if (typeof content === 'string') return content || null;
  if (Array.isArray(content)) {
    if (role === 'user' && content.some((b: { type?: string }) => b.type === 'tool_result')) {
      return null;
    }
    const textBlock = content.find((b: { type?: string; text?: string }) => b.type === 'text');
    return (textBlock as { text?: string })?.text || null;
  }
  return null;
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

      const displayable: ChatMessage[] = [];
      for (const row of rows ?? []) {
        const text = extractText(row.role, row.content);
        if (text) {
          displayable.push({ id: row.id, role: row.role, text, created_at: row.created_at });
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

        const { text, conversation_id } = await res.json();
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
        });
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
