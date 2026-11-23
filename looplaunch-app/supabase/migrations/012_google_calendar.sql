-- ══════════════════════════════════════════════════════════════
-- Loop Launch: Google Calendar connections for the daily agenda
-- ══════════════════════════════════════════════════════════════
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to run more than once.
--
-- One row per person who connected Google Calendar in Settings → Daily agenda. Every hour the
-- server checks who's due, reads that day's events with the refresh token, and sends the agenda
-- by email or WhatsApp. Events themselves are never stored, only the token and preferences.
--
-- refresh_token is encrypted by the app (AES-256-GCM with CALENDAR_TOKEN_KEY) before it gets here,
-- so this table alone can't be used to read anyone's calendar.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.calendar_connections (
  user_id        UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  -- The Google account that was connected (can differ from the Loop Launch login)
  google_email   TEXT,
  -- Encrypted: "v1:…"
  refresh_token  TEXT NOT NULL,
  -- What Google granted, space-separated
  scopes         TEXT NOT NULL DEFAULT '',
  -- The calendar's own time zone, e.g. Asia/Kolkata: "today" and the send hour are in it
  time_zone      TEXT NOT NULL DEFAULT 'UTC',
  send_hour      SMALLINT NOT NULL DEFAULT 7 CHECK (send_hour BETWEEN 0 AND 23),
  channel        TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'whatsapp')),
  whatsapp       TEXT CHECK (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  -- reconnect: Google stopped accepting the token (revoked, expired), so sending is paused
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'reconnect')),
  -- Local date of the last daily send, so each person gets one a day
  last_sent_on   DATE,
  last_sent_at   TIMESTAMPTZ,
  last_error     TEXT,
  connected_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_connections_status ON public.calendar_connections (status);

-- Row level security with no policies: only the server's service key can read or write.
-- No browser can ever see a token.
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

-- Let the Supabase API see the new table straight away.
NOTIFY pgrst, 'reload schema';

-- ─── Where to look ─────────────────────────────────────────────
-- Table Editor → calendar_connections: who's connected, their send hour and channel, last send.
-- Or in the SQL Editor:
--   SELECT google_email, time_zone, send_hour, channel, status, last_sent_on, last_error
--   FROM calendar_connections ORDER BY connected_at DESC;
