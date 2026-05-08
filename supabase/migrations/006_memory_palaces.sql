-- Memory Palaces — 2D grid-based mnemonic spaces.
--
-- A palace is a single map (e.g. "Architecture Concepts"). It contains rooms
-- (rectangles on the grid) and objects (sprites placed on tiles, each carrying
-- a memory note). Inspired by MemoryOS and the method of loci.
--
-- Schema is intentionally simple: rooms + objects are stored as jsonb on the
-- palace row. That keeps reads to a single query and matches the existing
-- shape used by todo_lists.
CREATE TABLE IF NOT EXISTS memory_palaces (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL DEFAULT 'Untitled palace',
  description text        NOT NULL DEFAULT '',
  theme       text        NOT NULL DEFAULT 'forest',  -- forest | dungeon | castle | beach | space
  grid_width  integer     NOT NULL DEFAULT 16,
  grid_height integer     NOT NULL DEFAULT 12,
  rooms       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- room shape: { id, name, x, y, w, h, color, note? }
  objects     jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- object shape: { id, x, y, sprite, label, note, room_id? }
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  archived    boolean     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS memory_palaces_updated_at_idx
  ON memory_palaces (updated_at DESC);

ALTER TABLE memory_palaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON memory_palaces
  FOR ALL
  USING (true)
  WITH CHECK (true);
