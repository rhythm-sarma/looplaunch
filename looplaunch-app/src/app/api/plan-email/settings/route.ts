/**
 * POST /api/plan-email/settings
 *
 * Body: { sendHour: number }
 * Changes when the signed-in person's daily plan email arrives (Settings → Daily plan email).
 */

import { NextResponse } from "next/server";
import { getSignedInClaims } from "@/lib/auth/supabase-server";
import { rejectIfNoAccess } from "@/lib/auth/team-guard";
import { changePlanHour } from "@/lib/plan-email/service";

export async function POST(request: Request) {
  const claims = await getSignedInClaims();
  if (!claims) return NextResponse.json({ error: "You're not logged in." }, { status: 401 });
  const denied = await rejectIfNoAccess();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { sendHour?: unknown };
  const sendHour = Number(body.sendHour);
  if (!Number.isInteger(sendHour) || sendHour < 0 || sendHour > 23) {
    return NextResponse.json({ error: "Pick a time for your daily email." }, { status: 400 });
  }

  const subscription = await changePlanHour(claims.userId, sendHour);
  if (!subscription) return NextResponse.json({ error: "Couldn't save. Turn on daily emails from an analysis first." }, { status: 404 });
  return NextResponse.json({ ok: true, subscription });
}
