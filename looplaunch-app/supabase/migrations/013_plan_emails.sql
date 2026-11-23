-- ══════════════════════════════════════════════════════════════
-- Loop Launch: daily plan emails ("Email me each day's step")
-- ══════════════════════════════════════════════════════════════
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to run more than once.
--
-- One row per person who turned on daily plan emails from an analysis's menu. The steps of
-- that analysis's 7-day plan are copied here when the emails start. Day 1 is sent straight
-- away, then one step each morning at the chosen hour until the plan's last step.
-- Starting from another analysis replaces the row (one plan email at a time).
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.plan_emails (
  user_id       UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  -- The analysis the plan came from, for the "See the whole plan" link
  session_id    TEXT NOT NULL,
  company       TEXT NOT NULL DEFAULT '',
  -- The plan's daily steps, in order: ["Audit your product lineup…", …]
  steps         JSONB NOT NULL CHECK (jsonb_typeof(steps) = 'array'),
  -- Index into steps of the next one to send
  next_step     SMALLINT NOT NULL DEFAULT 0 CHECK (next_step >= 0),
  -- The browser's time zone when the emails started, e.g. Asia/Kolkata
  time_zone     TEXT NOT NULL DEFAULT 'UTC',
  send_hour     SMALLINT NOT NULL DEFAULT 8 CHECK (send_hour BETWEEN 0 AND 23),
  -- done: every step has been sent
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done')),
  -- Local date of the last send, so it's one step a day
  last_sent_on  DATE,
  last_sent_at  TIMESTAMPTZ,
  last_error    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_emails_status ON public.plan_emails (status);

-- Row level security with no policies: only the server's service key can read or write.
ALTER TABLE public.plan_emails ENABLE ROW LEVEL SECURITY;

-- Let the Supabase API see the new table straight away.
NOTIFY pgrst, 'reload schema';

-- ─── Where to look ─────────────────────────────────────────────
--   SELECT company, next_step, jsonb_array_length(steps) AS steps, send_hour, time_zone, status, last_sent_on, last_error
--   FROM plan_emails ORDER BY created_at DESC;
