/**
 * The morning send without an outside cron service: the app's own server checks every 10 minutes
 * who's due (started from src/instrumentation.ts).
 *
 * Safe alongside more servers, or a cron job also calling /api/cron/daily-agenda, because each
 * person's daily send is claimed in the database before it goes out (claimDailySend). A send missed
 * while the server was restarting still goes out within SEND_WINDOW_HOURS of the chosen hour.
 */

import { calendarFeatures } from "./config";
import { runDailyAgendas } from "./service";

export const CHECK_EVERY_MS = 10 * 60 * 1000;

/** On in production unless AGENDA_SCHEDULER=off. In development only with AGENDA_SCHEDULER=on, so a local server never sends real agendas by accident. */
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

// One scheduler per server process, even if this module is loaded twice.
const state = globalThis as unknown as { __agendaScheduler?: { runningSince: number | null } };

async function check() {
  const scheduler = state.__agendaScheduler;
  if (!scheduler) return;
  // Still busy with the last check: skip this one. Overlaps couldn't double-send (each send is claimed first), they'd only waste calls.
  if (scheduler.runningSince !== null && Date.now() - scheduler.runningSince < STUCK_AFTER_MS) return;

  const startedAt = Date.now();
  scheduler.runningSince = startedAt;
  try {
    const summary = await runDailyAgendas();
    if (summary.due) console.info("[Calendar] Daily agenda run:", JSON.stringify(summary));
  } catch (error) {
    console.error("[Calendar] Daily agenda run failed:", error instanceof Error ? error.message : String(error));
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

export function startAgendaScheduler(): void {
  if (state.__agendaScheduler || !schedulerEnabled()) return;

  const features = calendarFeatures();
  if (!features.connect) {
    console.info("[Calendar] Daily agenda scheduler is off: the Google Calendar keys aren't set.");
    return;
  }
  if (!features.channels.email && !features.channels.whatsapp) {
    console.info("[Calendar] Daily agenda scheduler is off: no way to send yet (set BREVO_API_KEY and AGENDA_EMAIL_FROM).");
    return;
  }

  state.__agendaScheduler = { runningSince: null };
  console.info("[Calendar] Daily agenda scheduler is on: checking every 10 minutes.");
  scheduleNext();
}
