-- ══════════════════════════════════════════════════════════════
-- Loop Launch: lock the marketing frameworks table to the server
-- ══════════════════════════════════════════════════════════════
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to run more than once.
--
-- framework_chunks (migration 002) holds the marketing frameworks Loopy reads when it writes
-- a strategy. Migration 002 never turned on row level security, so on a fresh database the
-- public (anon) key could read, add, change or delete them, and anything added there would
-- reach Loopy's prompts. The live database already has it on (set in the dashboard); this
-- records it in the migrations, so a rebuilt database is safe too.
--
-- The server reads the table with the service key, which isn't affected. With no policies,
-- the anon and authenticated roles see nothing and can change nothing.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.framework_chunks ENABLE ROW LEVEL SECURITY;

-- The search function runs with the caller's rights, so it finds nothing for those roles
-- anyway; taking away their right to call it keeps it server-only on purpose.
REVOKE EXECUTE ON FUNCTION public.match_framework_chunks(vector, INT, FLOAT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_framework_chunks(vector, INT, FLOAT, TEXT) TO service_role;
