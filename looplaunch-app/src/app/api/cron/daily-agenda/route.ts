/**
 * GET or POST /api/cron/daily-agenda   (header: Authorization: Bearer <CRON_SECRET>)
 *
 * Optional: the app already sends the morning emails itself every 10 minutes (src/lib/email/scheduler.ts).
 * Use this route only for an outside scheduler (a Render cron job, cron-job.org…), e.g. with AGENDA_SCHEDULER=off.
 * Each person whose chosen hour has come in their own time zone gets their plan step and calendar agenda, once a day.
 * Off (503) until CRON_SECRET is set.
 */

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { calendarFeatures } from "@/lib/calendar/config";
import { runDailyAgendas } from "@/lib/calendar/service";
import { emailSender } from "@/lib/email/brevo";
import { runPlanEmails } from "@/lib/plan-email/service";

function authorized(request: Request, secret: string): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "CRON_SECRET isn't set." }, { status: 503 });
  if (!authorized(request, secret)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const plans = emailSender() ? await runPlanEmails() : null;
  const agendas = calendarFeatures().connect ? await runDailyAgendas() : null;
  if (plans?.due || agendas?.due) console.info("[Daily emails] Cron run:", JSON.stringify({ plans, agendas }));
  return NextResponse.json({ ok: true, plans, agendas });
}

export const GET = run;
export const POST = run;
