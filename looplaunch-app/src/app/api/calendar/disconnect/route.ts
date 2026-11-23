/**
 * POST /api/calendar/disconnect
 *
 * Deletes the signed-in person's Google Calendar connection and asks Google to revoke our access.
 * Open to every signed-in person, team or not, so anyone can remove their data.
 */

import { NextResponse } from "next/server";
import { getSignedInClaims } from "@/lib/auth/supabase-server";
import { disconnectCalendar } from "@/lib/calendar/service";

export async function POST() {
  const claims = await getSignedInClaims();
  if (!claims) return NextResponse.json({ error: "You're not logged in." }, { status: 401 });

  if (!(await disconnectCalendar(claims.userId))) {
    return NextResponse.json({ error: "Couldn't disconnect right now. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
