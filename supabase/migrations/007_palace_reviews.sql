-- Spaced repetition records for memory palace loci.
--
-- One row per (palace, locus object) pair. The locus id is stored as text
-- because objects live inside `memory_palaces.data->objects` (a jsonb array)
-- — there is no separate objects table to FK to. Cleanup of orphaned reviews
-- is best-effort and handled in app code when an object is deleted.
--
-- Scoring uses an SM-2-lite scheme:
--   quality 'hard'  → next_due = now + 1d,           ease -= 0.15
--   quality 'good'  → next_due = now + interval*ease, ease unchanged
--   quality 'easy'  → next_due = now + interval*ease*1.5, ease += 0.10
--
-- ease is clamped to [1.3, 3.0]. interval_days is clamped to a minimum of 1.
-- The first review of a locus starts at interval_days=1, ease=2.5.
--
-- Apply once in the Supabase SQL editor:
--   https://supabase.com/dashboard/project/nebfkwfgjtqinrfiglva/sql

CREATE TABLE IF NOT EXISTS palace_reviews (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  palace_id     uuid        NOT NULL REFERENCES memory_palaces(id) ON DELETE CASCADE,
  object_id     text        NOT NULL,
  last_seen     timestamptz NOT NULL DEFAULT now(),
  next_due      timestamptz NOT NULL DEFAULT now(),
  ease          real        NOT NULL DEFAULT 2.5,
  interval_days integer     NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (palace_id, object_id)
);

CREATE INDEX IF NOT EXISTS palace_reviews_next_due_idx
  ON palace_reviews (next_due);

CREATE INDEX IF NOT EXISTS palace_reviews_palace_idx
  ON palace_reviews (palace_id);

ALTER TABLE palace_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON palace_reviews
  FOR ALL USING (true) WITH CHECK (true);
