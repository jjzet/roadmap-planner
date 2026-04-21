-- AI chat: singleton-per-user conversation with persisted message history.
-- Run this once in your Supabase SQL editor: https://supabase.com/dashboard/project/nebfkwfgjtqinrfiglva/sql

-- ─── Conversations ─────────────────────────────────────────────────────
-- Single-user app for now: one conversation per user_id (defaulted to 'default').
-- The unique index makes the "singleton" semantics explicit and upsert-safe.
CREATE TABLE IF NOT EXISTS ai_conversations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text        NOT NULL    DEFAULT 'default',
  title      text,
  created_at timestamptz NOT NULL    DEFAULT now(),
  updated_at timestamptz NOT NULL    DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_conversations_user_id_unique
  ON ai_conversations (user_id);

-- ─── Messages ──────────────────────────────────────────────────────────
-- `content` stores the raw Anthropic content blocks array (text / tool_use / tool_result)
-- as jsonb, so we can replay a conversation verbatim without lossy flattening.
--
-- `role` is 'user' | 'assistant' (Anthropic roles). Tool results are role='user'
-- with tool_result content blocks, per the Messages API spec.
CREATE TABLE IF NOT EXISTS ai_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL    REFERENCES ai_conversations(id) ON DELETE CASCADE,
  sequence        integer     NOT NULL,
  role            text        NOT NULL    CHECK (role IN ('user', 'assistant')),
  content         jsonb       NOT NULL,
  created_at      timestamptz NOT NULL    DEFAULT now(),
  UNIQUE (conversation_id, sequence)
);

CREATE INDEX IF NOT EXISTS ai_messages_conversation_sequence
  ON ai_messages (conversation_id, sequence);

-- ─── RLS ───────────────────────────────────────────────────────────────
-- Same permissive anon policy as the rest of the app (no auth layer yet).
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON ai_conversations
  FOR ALL
  USING (true)
  WITH CHECK (true);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON ai_messages
  FOR ALL
  USING (true)
  WITH CHECK (true);
