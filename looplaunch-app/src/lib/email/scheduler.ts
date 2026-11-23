/**
 * The morning emails, sent without an outside cron service: the app's own server checks every
 * 10 minutes who's due (started from src/instrumentation.ts), for
 *   - daily plan emails (src/lib/plan-email): needs email (Brevo) only;
 *   - the Google Calendar agenda (src/lib/calendar): needs the Google keys too.
 *
 * Safe alongside more servers, or a cron job also calling /api/cron/daily-agenda, because each
 * person's daily send is claimed in the database before it goes out. A send missed while the
 * server was restarting still goes out within SEND_WINDOW_HOURS of the chosen hour.
 */

import { calendarFeatures } from "@/lib/calendar/config";
import { runDailyAgendas } from "@/lib/calendar/service";
import { runPlanEmails } from "@/lib/plan-email/service";
import { emailSender } from "./brevo";

export const CHECK_EVERY_MS = 10 * 60 * 1000;

/** On in production unless AGENDA_SCHEDULER=off. In development only with AGENDA_SCHEDULER=on, so a local server never sends real emails by accident. */
export function schedulerEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const flag = env.AGENDA_SCHEDULER?.trim().toLowerCase();
  if (flag === "off") return false;
  if (flag === "on") return true;
  return env.NODE_ENV === "production";
}

/** Milliseconds until the next 10-minute mark on the clock (7:00, 7:10, …). */
export function msToNextCheck(now: number = Date.now()): number {
  return CHECK_EVERY_MS - (now % CHECK_EVERY_MS);
}

/** A check still going after this long is treated as stuck (a request that never answered), so the next one may start. */
export const STUCK_AFTER_MS = 30 * 60 * 1000;

/** Which morning emails this server can send. */
function whatRuns() {
  const calendar = calendarFeatures();
  return {
    plan: Boolean(emailSender()),
    agenda: calendar.connect && (calendar.channels.email || calendar.channels.whatsapp),
  };
}

// One scheduler per server process, even if this module is loaded twice.
const state = globalThis as unknown as { __dailyEmails?: { runningSince: number | null } };

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function check() {
  const scheduler = state.__dailyEmails;
  if (!scheduler) return;
  // Still busy with the last check: skip this one. Overlaps couldn't double-send (each send is claimed first), they'd only waste calls.
  if (scheduler.runningSince !== null && Date.now() - scheduler.runningSince < STUCK_AFTER_MS) return;

  const startedAt = Date.now();
  scheduler.runningSince = startedAt;
  const runs = whatRuns();
  try {
    // Each kind on its own, so a problem with one never holds up the other.
    if (runs.plan) {
      try {
        const summary = await runPlanEmails();
        if (summary.due) console.info("[Daily emails] Plan emails:", JSON.stringify(summary));
      } catch (error) {
        console.error("[Daily emails] Plan email run failed:", errorText(error));
      }
    }
    if (runs.agenda) {
      try {
        const summary = await runDailyAgendas();
        if (summary.due) console.info("[Daily emails] Calendar agendas:", JSON.stringify(summary));
      } catch (error) {
        console.error("[Daily emails] Calendar agenda run failed:", errorText(error));
      }
    }
  } finally {
    // A stuck check that finally finishes mustn't clear a newer one's mark.
    if (scheduler.runningSince === startedAt) scheduler.runningSince = null;
  }
}

/** The next check is booked before this one runs, so a slow or stuck check can never stop the schedule. */
function scheduleNext() {
  const timer = setTimeout(() => {
    scheduleNext();
    void check();
  }, msToNextCheck());
  // The web server keeps the process alive; this timer shouldn't on its own.
  timer.unref?.();
}

export function startDailyEmails(): void {
  if (state.__dailyEmails || !schedulerEnabled()) return;

  const runs = whatRuns();
  if (!runs.plan && !runs.agenda) {
    console.info("[Daily emails] Scheduler is off: email isn't set up (set BREVO_API_KEY and AGENDA_EMAIL_FROM).");
    return;
  }

  state.__dailyEmails = { runningSince: null };
  const agenda = runs.agenda ? "on" : "off, the Google Calendar keys aren't set";
  console.info(`[Daily emails] Scheduler is on: checking every 10 minutes. Plan emails: ${runs.plan ? "on" : "off"}. Calendar agenda: ${agenda}.`);
  scheduleNext();
}
