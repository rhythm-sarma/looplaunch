-- ══════════════════════════════════════════════════════════════
-- Loop Launch: Waitlist, the WhatsApp number each person gave
-- ══════════════════════════════════════════════════════════════
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to run more than once. Needs migration 006 first.
--
-- The join form asks for a WhatsApp number. It's optional, so it can be empty.
-- Stored as "+" and digits, e.g. +919876543210 (the server cleans what was typed).
-- Until this is run, people still join; their number just isn't saved.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS whatsapp TEXT CHECK (whatsapp ~ '^\+[1-9][0-9]{7,14}$');
