-- Daily journal entries — one per date.
-- Three short prompts framed around goal progress:
--   forward:  "How did I move forward?"
--   blockers: "What got in the way?"
--   tomorrow: "Tomorrow's one thing"
CREATE TABLE IF NOT EXISTS journal_entries (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  date        date        NOT NULL UNIQUE,
  forward     text        NOT NULL DEFAULT '',
  blockers    text        NOT NULL DEFAULT '',
  tomorrow    text        NOT NULL DEFAULT '',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS journal_entries_date_idx ON journal_entries (date DESC);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON journal_entries
  FOR ALL USING (true) WITH CHECK (true);
