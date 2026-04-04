-- Daily book insights cache
-- Run this once in your Supabase SQL editor: https://supabase.com/dashboard/project/nebfkwfgjtqinrfiglva/sql

CREATE TABLE IF NOT EXISTS daily_insights (
  date         text        PRIMARY KEY,           -- "YYYY-MM-DD"
  insight_data jsonb       NOT NULL,              -- DailyInsight JSON object
  created_at   timestamptz DEFAULT now()
);

-- Allow the anon key to read and write (same pattern as todo_lists)
ALTER TABLE daily_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON daily_insights
  FOR ALL
  USING (true)
  WITH CHECK (true);
