/**
 * The daily agenda put together: what Settings shows, finishing a connection, reading today's
 * events, the test send, the morning send for everyone, and disconnecting.
 */

import { getSupabase } from "@/lib/db/supabase";
import { agendaItems, agendaText, dayWindow, isDue, safeTimeZone, type Agenda } from "./agenda";
import { calendarFeatures, googleClient, manageUrl } from "./config";
import { decryptToken, encryptToken, tokenKeyFromEnv } from "./crypto";
import { deliverAgenda, type Delivery } from "./deliver";
import {
  GoogleApiError,
  emailFromIdToken,
  exchangeCode,
  fetchCalendarTimeZone,
  fetchEventsBetween,
  hasCalendarScope,
  refreshAccessToken,
  revokeToken,
} from "./google";
import {
  claimDailySend,
  deleteConnection,
  findConnection,
  findStoredConnection,
  listActiveConnections,
  markNeedsReconnect,
  recordSend,
  saveConnection,
  type StoredConnection,
} from "./store";
import type { CalendarSettingsData } from "./types";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** For the Settings page. Not available until the server has its Google keys and the table exists. */
export async function getCalendarSettings(userId: string): Promise<CalendarSettingsData> {
  const features = calendarFeatures();
  if (!features.connect) return { available: false, channels: features.channels, connection: null };
  const connection = await findConnection(userId);
  return { available: connection !== undefined, channels: features.channels, connection: connection ?? null };
}

export type ConnectResult = "connected" | "permission" | "api_disabled" | "unavailable" | "error";

/** Finish connecting: swap Google's code for tokens, check calendar access was granted, store the token encrypted. */
export async function connectWithCode(userId: string, code: string, codeVerifier: string): Promise<ConnectResult> {
  const client = googleClient();
  const key = tokenKeyFromEnv();
  if (!client || !key) return "unavailable";

  const tokens = await exchangeCode(client, code, codeVerifier);
  if (!hasCalendarScope(tokens.scope)) {
    // Calendar access was unticked on Google's page, so there's nothing worth keeping.
    await revokeToken(tokens.refreshToken ?? tokens.accessToken);
    return "permission";
  }
  if (!tokens.refreshToken) return "error";

  let timeZone: string;
  try {
    timeZone = safeTimeZone(await fetchCalendarTimeZone(tokens.accessToken));
  } catch (error) {
    if (error instanceof GoogleApiError && error.apiDisabled) {
      console.error("[Calendar] The Google Calendar API is off in the Google Cloud project:", error.message);
      return "api_disabled";
    }
    console.warn("[Calendar] Couldn't read the calendar's time zone, using UTC:", message(error));
    timeZone = "UTC";
  }

  const saved = await saveConnection({
    userId,
    googleEmail: emailFromIdToken(tokens.idToken),
    encryptedToken: encryptToken(tokens.refreshToken, key),
    scopes: tokens.scope,
    timeZone,
  });
  return saved ? "connected" : "error";
}

/** Today's agenda for one connection: a fresh access token, then the day's events in its time zone. */
export async function buildTodaysAgenda(connection: Pick<StoredConnection, "encryptedToken" | "timeZone">, now = new Date()): Promise<Agenda> {
  const client = googleClient();
  const key = tokenKeyFromEnv();
  if (!client || !key) throw new Error("Google Calendar isn't set up on this server.");

  let refreshToken: string;
  try {
    refreshToken = decryptToken(connection.encryptedToken, key);
  } catch {
    // CALENDAR_TOKEN_KEY changed since this was saved: the only way back is connecting again.
    throw new GoogleApiError("The stored token can't be decrypted with the current CALENDAR_TOKEN_KEY.", 401, "undecryptable");
  }

  const accessToken = await refreshAccessToken(client, refreshToken);
  const day = dayWindow(connection.timeZone, now);
  const events = await fetchEventsBetween(accessToken, day.timeMin, day.timeMax, connection.timeZone);
  return { date: day.date, dateLabel: day.dateLabel, items: agendaItems(events, day, connection.timeZone) };
}

export type TestSendResult =
  | { ok: true; preview: string; delivery: Delivery }
  | { ok: false; error: "not_connected" | "reconnect" | "setup" | "failed"; message: string; preview?: string };

/** "Send a test now" in Settings: today's agenda, sent by the person's chosen channel, plus a preview of it. */
export async function sendTestAgenda(userId: string, accountEmail: string | null): Promise<TestSendResult> {
  const stored = await findStoredConnection(userId);
  if (!stored) return { ok: false, error: "not_connected", message: "Connect Google Calendar first." };

  let agenda: Agenda;
  try {
    agenda = await buildTodaysAgenda(stored);
  } catch (error) {
    if (error instanceof GoogleApiError && error.needsReconnect) {
      await markNeedsReconnect(userId, error.message);
      return { ok: false, error: "reconnect", message: "Google isn't letting Loop Launch read your calendar any more. Please connect it again." };
    }
    if (error instanceof GoogleApiError && error.apiDisabled) {
      console.error("[Calendar] The Google Calendar API is off in the Google Cloud project:", error.message);
      return { ok: false, error: "setup", message: "The Google Calendar API is switched off for this app in Google Cloud." };
    }
    console.error("[Calendar] Reading today's events failed:", message(error));
    return { ok: false, error: "failed", message: "Couldn't read your calendar just now. Please try again in a minute." };
  }

  const preview = agendaText(agenda, manageUrl());
  try {
    const delivery = await deliverAgenda({ channel: stored.channel, email: accountEmail, whatsapp: stored.whatsapp }, agenda);
    return { ok: true, preview, delivery };
  } catch (error) {
    console.error(`[Calendar] Sending a test by ${stored.channel} failed:`, message(error));
    return { ok: false, error: "failed", message: `Your agenda is ready, but sending it by ${stored.channel} failed.`, preview };
  }
}

async function accountEmail(userId: string): Promise<string | null> {
  const { data, error } = (await getSupabase()?.auth.admin.getUserById(userId)) ?? { data: null, error: null };
  if (error) console.warn("[Calendar] Looking up an account email failed:", error.message);
  return data?.user?.email ?? null;
}

export interface DailyRunSummary {
  connections: number;
  due: number;
  sent: number;
  notSent: number;
  failed: number;
  reconnect: number;
}

/**
 * The morning send, run every hour by a scheduler: each person whose chosen hour has come in their
 * own time zone gets today's agenda once.
 */
export async function runDailyAgendas(now = new Date()): Promise<DailyRunSummary> {
  const connections = await listActiveConnections();
  const summary: DailyRunSummary = { connections: connections.length, due: 0, sent: 0, notSent: 0, failed: 0, reconnect: 0 };

  for (const connection of connections) {
    const { due, date } = isDue(connection, now);
    if (!due) continue;
    summary.due++;
    // Another run may have taken it a moment ago.
    if (!(await claimDailySend(connection.userId, date))) continue;

    try {
      const agenda = await buildTodaysAgenda(connection, now);
      const email = connection.channel === "email" ? await accountEmail(connection.userId) : null;
      const delivery = await deliverAgenda({ channel: connection.channel, email, whatsapp: connection.whatsapp }, agenda);
      if (delivery.delivered) {
        await recordSend(connection.userId, { ok: true });
        summary.sent++;
      } else {
        await recordSend(connection.userId, { ok: false, error: delivery.reason, previousDate: connection.lastSentOn });
        summary.notSent++;
      }
    } catch (error) {
      if (error instanceof GoogleApiError && error.needsReconnect) {
        await markNeedsReconnect(connection.userId, error.message);
        summary.reconnect++;
      } else {
        console.error("[Calendar] Daily agenda failed for one person:", message(error));
        await recordSend(connection.userId, { ok: false, error: message(error), previousDate: connection.lastSentOn });
        summary.failed++;
      }
    }
  }
  return summary;
}

/** Disconnect: forget the token here, then ask Google to revoke it. Also used when an account is deleted. */
export async function disconnectCalendar(userId: string): Promise<boolean> {
  const stored = await findStoredConnection(userId);
  if (!stored) return true;
  if (!(await deleteConnection(userId))) return false;

  const key = tokenKeyFromEnv();
  if (key) {
    try {
      await revokeToken(decryptToken(stored.encryptedToken, key));
    } catch {
      // The row is gone either way; the person can also remove access at myaccount.google.com/permissions.
    }
  }
  return true;
}
