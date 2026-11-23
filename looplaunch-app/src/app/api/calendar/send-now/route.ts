/**
 * POST /api/calendar/send-now
 *
 * "Send a test now" in Settings: builds today's agenda from the person's Google Calendar, sends it
 * by their chosen channel (if that's set up on the server) and returns a preview of the text.
 * Doesn't count as the day's send: the morning one still goes out.
 */

import { NextResponse } from "next/server";
import { getSignedInClaims } from "@/lib/auth/supabase-server";
import { rejectIfNoAccess } from "@/lib/auth/team-guard";
import { sendTestAgenda } from "@/lib/calendar/service";

/** One test per person every 30 seconds, so a held-down button can't flood an inbox. */
const lastTest = new Map<string, number>();
const COOLDOWN_MS = 30_000;

export async function POST() {
  const claims = await getSignedInClaims();
  if (!claims) return NextResponse.json({ error: "You're not logged in." }, { status: 401 });
  const denied = await rejectIfNoAccess();
  if (denied) return denied;

  const now = Date.now();
  if (now - (lastTest.get(claims.userId) ?? 0) < COOLDOWN_MS) {
    return NextResponse.json({ error: "You just sent one. Try again in half a minute." }, { status: 429 });
  }
  lastTest.set(claims.userId, now);

  const result = await sendTestAgenda(claims.userId, claims.email ?? null);
  if (result.ok) return NextResponse.json(result);
  const status = result.error === "not_connected" ? 404 : result.error === "reconnect" ? 409 : 502;
  return NextResponse.json(result, { status });
}
