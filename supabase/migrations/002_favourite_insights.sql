CREATE TABLE IF NOT EXISTS favourite_insights (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  date           text        NOT NULL UNIQUE,
  insight_data   jsonb       NOT NULL,
  favourited_at  timestamptz DEFAULT now()
);

ALTER TABLE favourite_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON favourite_insights
  FOR ALL USING (true) WITH CHECK (true);
