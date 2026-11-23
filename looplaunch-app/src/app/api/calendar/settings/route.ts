/**
 * POST /api/calendar/settings
 *
 * Body: { sendHour: number, channel: "email" | "whatsapp", whatsapp?: string }
 * Saves when and how the signed-in person gets their daily agenda.
 */

import { NextResponse } from "next/server";
import { getSignedInClaims } from "@/lib/auth/supabase-server";
import { rejectIfNoAccess } from "@/lib/auth/team-guard";
import { calendarFeatures } from "@/lib/calendar/config";
import { updatePreferences } from "@/lib/calendar/store";
import { cleanWhatsapp } from "@/lib/waitlist/details";

export async function POST(request: Request) {
  const claims = await getSignedInClaims();
  if (!claims) return NextResponse.json({ error: "You're not logged in." }, { status: 401 });
  const denied = await rejectIfNoAccess();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { sendHour?: unknown; channel?: unknown; whatsapp?: unknown };
  const sendHour = Number(body.sendHour);
  if (!Number.isInteger(sendHour) || sendHour < 0 || sendHour > 23) {
    return NextResponse.json({ error: "Pick a time to get your agenda." }, { status: 400 });
  }

  const channel = body.channel === "whatsapp" ? "whatsapp" : "email";
  if (channel === "whatsapp" && !calendarFeatures().channels.whatsapp) {
    return NextResponse.json({ error: "WhatsApp isn't available yet. Please choose email." }, { status: 400 });
  }

  // A number only matters for WhatsApp; with email, an unfinished one is just dropped.
  const whatsapp = cleanWhatsapp(body.whatsapp) || null;
  if (channel === "whatsapp" && !whatsapp) {
    return NextResponse.json({ error: "Enter your WhatsApp number with the country code, like +91 98765 43210." }, { status: 400 });
  }

  const connection = await updatePreferences(claims.userId, { sendHour, channel, whatsapp });
  if (!connection) return NextResponse.json({ error: "Couldn't save. Connect Google Calendar first, then try again." }, { status: 404 });
  return NextResponse.json({ ok: true, connection });
}
