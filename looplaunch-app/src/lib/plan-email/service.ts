/**
 * Daily plan emails: "Email me each day's step" in an analysis's menu. Day 1 goes out at once,
 * then one step each morning at the chosen hour (sent by src/lib/email/scheduler.ts).
 */

import { isDue, safeTimeZone, zonedParts } from "@/lib/calendar/agenda";
import { accountEmail, emailSender, sendEmail } from "@/lib/email/brevo";
import { getSession } from "@/lib/intelligence/store";
import { displayDomain } from "@/lib/intelligence/summary";
import { getSiteUrl } from "@/lib/seo";
import { DEFAULT_PLAN_HOUR, latestPlan, planEmailHtml, planEmailSubject, planEmailText, type PlanEmailData, type PlanEmailStatus } from "./plan";
import {
  claimPlanSend,
  deletePlanEmail,
  findPlanEmail,
  listActivePlanEmails,
  recordPlanFailed,
  recordPlanSent,
  savePlanEmail,
  toStatus,
  updatePlanHour,
  type StoredPlanEmail,
} from "./store";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const pad = (n: number) => String(n).padStart(2, "0");

function localDate(timeZone: string, now: Date): string {
  const p = zonedParts(timeZone, now);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** For the analysis menu and Settings. */
export async function getPlanEmail(userId: string): Promise<PlanEmailData> {
  if (!emailSender()) return { available: false, subscription: null };
  const stored = await findPlanEmail(userId);
  return { available: stored !== undefined, subscription: stored ? toStatus(stored) : null };
}

/** Send one step of someone's plan to them. */
async function sendStep(plan: Pick<StoredPlanEmail, "sessionId" | "company" | "steps">, stepIndex: number, to: string): Promise<boolean> {
  const site = getSiteUrl();
  const input = {
    company: plan.company,
    steps: plan.steps,
    stepIndex,
    planUrl: `${site}/intelligence?session=${encodeURIComponent(plan.sessionId)}`,
    manageUrl: `${site}/profile#settings-plan-email`,
  };
  return sendEmail({ to, subject: planEmailSubject(input), html: planEmailHtml(input), text: planEmailText(input), tag: "daily-plan" });
}

export type StartResult =
  | { ok: true; subscription: PlanEmailStatus }
  | { ok: false; error: "unavailable" | "not_found" | "no_plan" | "failed"; message: string };

/**
 * Turn on plan emails for one of the person's own analyses, using its newest day-by-day plan.
 * Day 1 goes out now, so they see straight away what the emails look like.
 */
export async function startPlanEmails(
  user: { id: string; email: string },
  sessionId: string,
  options: { sendHour?: number; timeZone?: string },
  now = new Date()
): Promise<StartResult> {
  if (!emailSender()) return { ok: false, error: "unavailable", message: "Daily emails aren't switched on yet." };

  const session = await getSession(sessionId);
  if (!session || session.userId !== user.id) return { ok: false, error: "not_found", message: "That analysis isn't in your account." };

  const plan = latestPlan(session.messages ?? []);
  if (!plan) return { ok: false, error: "no_plan", message: "This analysis doesn't have a day-by-day plan yet." };

  const sendHour = Number.isInteger(options.sendHour) && options.sendHour! >= 0 && options.sendHour! <= 23 ? options.sendHour! : DEFAULT_PLAN_HOUR;
  const timeZone = safeTimeZone(options.timeZone);
  const company =
    session.onboardingInput?.companyName?.trim() || session.companyIntelligence?.name?.trim() || displayDomain(session.onboardingInput?.website) || "your business";

  const saved = await savePlanEmail({ userId: user.id, sessionId, company, steps: plan.steps, timeZone, sendHour });
  if (!saved) return { ok: false, error: "unavailable", message: "Daily emails aren't set up on the server yet." };

  try {
    if (!(await sendStep(saved, 0, user.email))) throw new Error("Email isn't set up.");
  } catch (error) {
    console.error("[Plan email] Sending day 1 failed:", message(error));
    // Start clean next time rather than leaving a plan that never sent.
    await deletePlanEmail(user.id);
    return { ok: false, error: "failed", message: "Couldn't send the first email just now. Please try again in a minute." };
  }

  const done = saved.steps.length <= 1;
  await recordPlanSent(user.id, { nextStep: 1, done, date: localDate(timeZone, now) });
  return { ok: true, subscription: toStatus({ ...saved, nextStep: 1, status: done ? "done" : "active" }) };
}

export async function stopPlanEmails(userId: string): Promise<boolean> {
  return deletePlanEmail(userId);
}

export async function changePlanHour(userId: string, sendHour: number): Promise<PlanEmailStatus | null> {
  const stored = await updatePlanHour(userId, sendHour);
  return stored ? toStatus(stored) : null;
}

export interface PlanRunSummary {
  active: number;
  due: number;
  sent: number;
  failed: number;
  finished: number;
}

/** The morning send: each person whose hour has come in their time zone gets their next step, once a day. */
export async function runPlanEmails(now = new Date()): Promise<PlanRunSummary> {
  const plans = await listActivePlanEmails();
  const summary: PlanRunSummary = { active: plans.length, due: 0, sent: 0, failed: 0, finished: 0 };

  for (const plan of plans) {
    const { due, date } = isDue({ timeZone: plan.timeZone, sendHour: plan.sendHour, lastSentOn: plan.lastSentOn, status: "active" }, now);
    if (!due) continue;
    summary.due++;

    if (plan.nextStep >= plan.steps.length) {
      // Every step is out already (shouldn't happen, but never send past the end).
      await recordPlanSent(plan.userId, { nextStep: plan.nextStep, done: true, date: plan.lastSentOn ?? date });
      summary.finished++;
      continue;
    }
    if (!(await claimPlanSend(plan.userId, date))) continue;

    try {
      const to = await accountEmail(plan.userId);
      if (!to) throw new Error("The account has no email address.");
      if (!(await sendStep(plan, plan.nextStep, to))) throw new Error("Email isn't set up on this server.");
      const nextStep = plan.nextStep + 1;
      const done = nextStep >= plan.steps.length;
      await recordPlanSent(plan.userId, { nextStep, done, date });
      summary.sent++;
      if (done) summary.finished++;
    } catch (error) {
      console.error("[Plan email] Morning send failed for one person:", message(error));
      await recordPlanFailed(plan.userId, message(error), plan.lastSentOn);
      summary.failed++;
    }
  }
  return summary;
}
