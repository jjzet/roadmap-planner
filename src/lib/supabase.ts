import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nebfkwfgjtqinrfiglva.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lYmZrd2ZnanRxaW5yZmlnbHZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNDIzODcsImV4cCI6MjA4NjcxODM4N30.8hx_3VfKrxMy9hXD94PgU2OAGoZ1YNJtK8HRj2PCGDA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
