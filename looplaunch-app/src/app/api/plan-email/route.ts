/**
 * GET  /api/plan-email   The signed-in person's daily plan email: { available, subscription }.
 * POST /api/plan-email   Body: { sessionId, sendHour?, timeZone? }
 *                        "Email me each day's step" in an analysis's menu: starts the emails for that
 *                        analysis's newest day-by-day plan and sends day 1 straight away.
 */

import { NextResponse } from "next/server";
import { getSignedInClaims } from "@/lib/auth/supabase-server";
import { rejectIfNoAccess } from "@/lib/auth/team-guard";
import { getPlanEmail, startPlanEmails } from "@/lib/plan-email/service";

/** One start per person every 30 seconds, so a double click can't send day 1 twice. */
const lastStart = new Map<string, number>();
const COOLDOWN_MS = 30_000;

export async function GET() {
  const claims = await getSignedInClaims();
  if (!claims) return NextResponse.json({ error: "You're not logged in." }, { status: 401 });
  const denied = await rejectIfNoAccess();
  if (denied) return denied;
  return NextResponse.json(await getPlanEmail(claims.userId));
}

export async function POST(request: Request) {
  const claims = await getSignedInClaims();
  if (!claims) return NextResponse.json({ error: "Log in to get daily emails." }, { status: 401 });
  const denied = await rejectIfNoAccess();
  if (denied) return denied;
  if (!claims.email) return NextResponse.json({ error: "Your account has no email address." }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { sessionId?: unknown; sendHour?: unknown; timeZone?: unknown };
  if (typeof body.sessionId !== "string" || !body.sessionId) {
    return NextResponse.json({ error: "Which analysis? Open one and try again." }, { status: 400 });
  }

  const now = Date.now();
  if (now - (lastStart.get(claims.userId) ?? 0) < COOLDOWN_MS) {
    return NextResponse.json({ error: "Your first email is on its way. Check your inbox in a moment." }, { status: 429 });
  }
  lastStart.set(claims.userId, now);

  const result = await startPlanEmails({ id: claims.userId, email: claims.email }, body.sessionId, {
    sendHour: typeof body.sendHour === "number" ? body.sendHour : undefined,
    timeZone: typeof body.timeZone === "string" ? body.timeZone : undefined,
  });
  if (result.ok) return NextResponse.json(result);

  // Let them try again straight away after a refusal.
  lastStart.delete(claims.userId);
  const status = result.error === "not_found" ? 404 : result.error === "no_plan" ? 422 : result.error === "unavailable" ? 503 : 502;
  return NextResponse.json({ error: result.message, code: result.error }, { status });
}
