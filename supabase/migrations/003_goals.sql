CREATE TABLE IF NOT EXISTS goals (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL DEFAULT '',
  body        text        NOT NULL DEFAULT '',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  archived    boolean     DEFAULT false
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON goals
  FOR ALL USING (true) WITH CHECK (true);
