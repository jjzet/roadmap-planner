-- Memory palaces — 8-bit-style spatial memory anchors.
--
-- Each palace is a 2D tile-based map that holds rooms (zones) and objects
-- (memory anchors). Objects carry a name and free-form content (the thing
-- being memorised). The map dimensions, theme, rooms, and objects all live
-- in `data` jsonb so the schema stays tight and the AI agent can mutate the
-- whole shape with one upsert.
--
-- Apply once in the Supabase SQL editor:
--   https://supabase.com/dashboard/project/nebfkwfgjtqinrfiglva/sql

CREATE TABLE IF NOT EXISTS memory_palaces (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL DEFAULT 'New Palace',
  theme       text        NOT NULL DEFAULT 'overworld',
  description text        NOT NULL DEFAULT '',
  data        jsonb       NOT NULL DEFAULT '{"width":24,"height":16,"rooms":[],"objects":[]}'::jsonb,
  archived    boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_palaces_updated_idx
  ON memory_palaces (updated_at DESC);

ALTER TABLE memory_palaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON memory_palaces
  FOR ALL USING (true) WITH CHECK (true);
