-- Sub-page support: parent_id and order_index for todo_lists
-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/nebfkwfgjtqinrfiglva/sql

ALTER TABLE todo_lists
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES todo_lists(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_todo_lists_parent_id ON todo_lists(parent_id);
