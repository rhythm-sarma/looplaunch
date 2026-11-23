/**
 * POST /api/plan-email/stop
 *
 * Stops the signed-in person's daily plan emails (from the analysis menu or Settings).
 */

import { NextResponse } from "next/server";
import { getSignedInClaims } from "@/lib/auth/supabase-server";
import { rejectIfNoAccess } from "@/lib/auth/team-guard";
import { stopPlanEmails } from "@/lib/plan-email/service";

export async function POST() {
  const claims = await getSignedInClaims();
  if (!claims) return NextResponse.json({ error: "You're not logged in." }, { status: 401 });
  const denied = await rejectIfNoAccess();
  if (denied) return denied;

  if (!(await stopPlanEmails(claims.userId))) {
    return NextResponse.json({ error: "Couldn't stop them just now. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
