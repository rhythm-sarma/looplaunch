/**
 * The calendar_connections table (supabase/migrations/012_google_calendar.sql), read and written
 * with the service key only: row level security has no policies, so no browser can reach the tokens.
 */

import { getSupabase } from "@/lib/db/supabase";
import { DEFAULT_SEND_HOUR, safeTimeZone } from "./agenda";
import type { AgendaChannel, CalendarConnection, ConnectionStatus } from "./types";

const TABLE = "calendar_connections";

interface Row {
  user_id: string;
  google_email: string | null;
  refresh_token: string;
  time_zone: string;
  send_hour: number;
  channel: AgendaChannel;
  whatsapp: string | null;
  status: ConnectionStatus;
  last_sent_on: string | null;
}

const COLUMNS = "user_id, google_email, time_zone, send_hour, channel, whatsapp, status, last_sent_on";

/** A connection plus what only the server may see: whose it is and the encrypted refresh token. */
export interface StoredConnection extends CalendarConnection {
  userId: string;
  encryptedToken: string;
}

function toConnection(row: Omit<Row, "refresh_token">): CalendarConnection {
  return {
    googleEmail: row.google_email,
    timeZone: safeTimeZone(row.time_zone),
    sendHour: row.send_hour ?? DEFAULT_SEND_HOUR,
    channel: row.channel === "whatsapp" ? "whatsapp" : "email",
    whatsapp: row.whatsapp,
    status: row.status === "reconnect" ? "reconnect" : "active",
    lastSentOn: row.last_sent_on,
  };
}

function toStored(row: Row): StoredConnection {
  return { ...toConnection(row), userId: row.user_id, encryptedToken: row.refresh_token };
}

let warnedMissingTable = false;

function logError(action: string, error: { code?: string; message: string }) {
  // PGRST205 / 42P01: the table isn't there yet.
  if (error.code === "PGRST205" || error.code === "42P01") {
    if (!warnedMissingTable) {
      console.warn("[Calendar] Table calendar_connections is missing. Run supabase/migrations/012_google_calendar.sql in the Supabase SQL Editor.");
      warnedMissingTable = true;
    }
    return;
  }
  console.error(`[Calendar] ${action} failed:`, error.message);
}

/** The person's connection, null if they have none, or undefined if the database can't be read. */
export async function findConnection(userId: string): Promise<CalendarConnection | null | undefined> {
  const db = getSupabase();
  if (!db) return undefined;
  const { data, error } = await db.from(TABLE).select(COLUMNS).eq("user_id", userId).maybeSingle();
  if (error) {
    logError("Reading a connection", error);
    return undefined;
  }
  return data ? toConnection(data as Omit<Row, "refresh_token">) : null;
}

export async function findStoredConnection(userId: string): Promise<StoredConnection | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await db.from(TABLE).select(`${COLUMNS}, refresh_token`).eq("user_id", userId).maybeSingle();
  if (error) logError("Reading a connection", error);
  return data ? toStored(data as Row) : null;
}

/** Everyone whose agenda might be due. The time check happens in code, per time zone. */
export async function listActiveConnections(): Promise<StoredConnection[]> {
  const db = getSupabase();
  if (!db) return [];
  const { data, error } = await db.from(TABLE).select(`${COLUMNS}, refresh_token`).eq("status", "active");
  if (error) {
    logError("Listing connections", error);
    return [];
  }
  return (data as Row[]).map(toStored);
}

/**
 * Save a new or renewed connection. A reconnect keeps the person's send time, channel and number,
 * because only the columns given here change.
 */
export async function saveConnection(input: {
  userId: string;
  googleEmail: string | null;
  encryptedToken: string;
  scopes: string;
  timeZone: string;
}): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;
  const { error } = await db.from(TABLE).upsert(
    {
      user_id: input.userId,
      google_email: input.googleEmail,
      refresh_token: input.encryptedToken,
      scopes: input.scopes,
      time_zone: input.timeZone,
      status: "active",
      last_error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) logError("Saving a connection", error);
  return !error;
}

export async function updatePreferences(
  userId: string,
  prefs: { sendHour: number; channel: AgendaChannel; whatsapp: string | null }
): Promise<CalendarConnection | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await db
    .from(TABLE)
    .update({ send_hour: prefs.sendHour, channel: prefs.channel, whatsapp: prefs.whatsapp, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select(COLUMNS)
    .maybeSingle();
  if (error) logError("Saving preferences", error);
  return data ? toConnection(data as Omit<Row, "refresh_token">) : null;
}

export async function deleteConnection(userId: string): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;
  const { error } = await db.from(TABLE).delete().eq("user_id", userId);
  if (error) logError("Deleting a connection", error);
  return !error;
}

/**
 * Take today's send for this person, so two overlapping cron runs can't both send it.
 * True only for the run whose update changed the row.
 */
export async function claimDailySend(userId: string, date: string): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;
  const { data, error } = await db
    .from(TABLE)
    .update({ last_sent_on: date })
    .eq("user_id", userId)
    .eq("status", "active")
    .or(`last_sent_on.is.null,last_sent_on.neq.${date}`)
    .select("user_id");
  if (error) logError("Claiming a send", error);
  return Boolean(data?.length);
}

/** After a send: record success, or hand the day back so the next run tries again. */
export async function recordSend(userId: string, result: { ok: true } | { ok: false; error: string; previousDate: string | null }) {
  const db = getSupabase();
  if (!db) return;
  const now = new Date().toISOString();
  const { error } = await db
    .from(TABLE)
    .update(
      result.ok
        ? { last_sent_at: now, last_error: null, updated_at: now }
        : { last_sent_on: result.previousDate, last_error: result.error.slice(0, 500), updated_at: now }
    )
    .eq("user_id", userId);
  if (error) logError("Recording a send", error);
}

/** Google won't accept the token any more: stop sending until the person connects again. */
export async function markNeedsReconnect(userId: string, reason: string) {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db
    .from(TABLE)
    .update({ status: "reconnect", last_error: reason.slice(0, 500), updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) logError("Marking a connection for reconnect", error);
}
