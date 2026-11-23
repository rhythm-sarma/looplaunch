/**
 * The daily plan email: the day-by-day steps of a strategy, and the email for one step.
 * No I/O, so the browser (the analysis menu) and the server share it.
 *
 * Strategies start with a "7 DAYS" section, one line per day (src/lib/ai/prompts.ts):
 *   ## 7 DAYS
 *   **MON:** Audit your product lineup…
 *   **TUE:** …
 */

export const PLAN_SEND_HOURS = [6, 7, 8, 9, 10, 11];
export const DEFAULT_PLAN_HOUR = 8;
/** Fewer than this and it isn't a day-by-day plan worth a week of emails. */
export const MIN_PLAN_STEPS = 3;
const MAX_STEP_LENGTH = 320;

/** One person's plan email, as the menu and Settings show it. */
export interface PlanEmailStatus {
  sessionId: string;
  company: string;
  totalSteps: number;
  /** How many steps have been sent */
  sentSteps: number;
  sendHour: number;
  timeZone: string;
  status: "active" | "done";
}

export interface PlanEmailData {
  /** False until the server can send email and the plan_emails table exists */
  available: boolean;
  subscription: PlanEmailStatus | null;
}

// ─── Finding the steps ───

const DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/** "**MON:** Post a reel", "- Monday: Post a reel", "**Tue** - Post a reel" → the day and what to do. */
const DAY_LINE =
  /^\s*(?:[-*•]\s+|\d+[.)]\s+)?(?:\*\*|__)?\s*(MON(?:DAY)?|TUE(?:S|SDAY)?|WED(?:NESDAY)?|THU(?:RS?|RSDAY)?|FRI(?:DAY)?|SAT(?:URDAY)?|SUN(?:DAY)?)\b\.?\s*(?:\*\*|__)?\s*[:\-–—]\s*(?:\*\*|__)?\s*(.+)$/i;

/** Markdown out, so the step reads cleanly in an email subject and body. */
function plainText(markdown: string): string {
  const text = markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|__|`/g, "")
    .replace(/(^|\s)\*(\S)/g, "$1$2")
    .replace(/(\S)\*(\s|$)/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > MAX_STEP_LENGTH ? `${text.slice(0, MAX_STEP_LENGTH - 1).trimEnd()}…` : text;
}

/**
 * The plan's steps in day order (Monday's first). Reads the "7 DAYS" section when there is one,
 * so a later line that happens to start with "Sun-" can't sneak in.
 */
export function planSteps(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const heading = lines.findIndex((line) => /^\s*#{1,6}\s*.*\b7[\s-]*DAYS?\b/i.test(line));
  const byDay = new Map<string, string>();

  for (let i = heading >= 0 ? heading + 1 : 0; i < lines.length; i++) {
    // The section ends at the next heading, once it has started.
    if (heading >= 0 && byDay.size > 0 && /^\s*#{1,6}\s/.test(lines[i])) break;
    const match = DAY_LINE.exec(lines[i]);
    if (!match) continue;
    const day = match[1].slice(0, 3).toUpperCase();
    const step = plainText(match[2]);
    if (step && !byDay.has(day)) byDay.set(day, step);
  }

  return DAY_ORDER.filter((day) => byDay.has(day)).map((day) => byDay.get(day)!);
}

/** The newest answer that has a day-by-day plan, if any. */
export function latestPlan(messages: { role: string; content: string }[]): { index: number; steps: string[] } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "assistant") continue;
    const steps = planSteps(messages[i].content);
    if (steps.length >= MIN_PLAN_STEPS) return { index: i, steps };
  }
  return null;
}

export function hourLabel(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${hour < 12 ? "AM" : "PM"}`;
}

// ─── The email ───

export interface PlanEmailInput {
  company: string;
  steps: string[];
  /** Which step this email is about (0 = day 1) */
  stepIndex: number;
  /** The analysis, with the whole plan */
  planUrl: string;
  /** Where to change the time or stop */
  manageUrl: string;
}

const shorten = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

export function planEmailSubject({ steps, stepIndex }: Pick<PlanEmailInput, "steps" | "stepIndex">): string {
  return `Day ${stepIndex + 1} of ${steps.length}: ${shorten(steps[stepIndex], 70)}`;
}

function closingLine(input: PlanEmailInput): { label: string; text: string } {
  const next = input.steps[input.stepIndex + 1];
  return next
    ? { label: "Tomorrow", text: next }
    : { label: "That's the plan", text: "This was the last step. Open Loop Launch for your next plan when you're ready." };
}

export function planEmailText(input: PlanEmailInput): string {
  const { company, steps, stepIndex, planUrl, manageUrl } = input;
  const closing = closingLine(input);
  return [
    `Day ${stepIndex + 1} of ${steps.length} of your plan for ${company}.`,
    "",
    `Today: ${steps[stepIndex]}`,
    "",
    `${closing.label}: ${closing.text}`,
    "",
    `See the whole plan: ${planUrl}`,
    `Change the time or stop these emails: ${manageUrl}`,
  ].join("\n");
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** A plain, light email that reads well in any client. The step text comes from the AI, so it's escaped. */
export function planEmailHtml(input: PlanEmailInput): string {
  const { company, steps, stepIndex, planUrl, manageUrl } = input;
  const closing = closingLine(input);
  // One small bar per day: filled up to today.
  const progress = steps
    .map(
      (_, i) =>
        `<td style="padding:0 3px 0 0"><div style="width:28px;height:4px;border-radius:2px;background:${i <= stepIndex ? "#7C3AED" : "#E4E4E7"}"></div></td>`
    )
    .join("");

  return `<!DOCTYPE html><html><body style="margin:0;background:#FAFAFA">
<div style="max-width:520px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181B">
<p style="margin:0 0 6px;font-size:13px;color:#71717A">Loop Launch · Your plan for ${escapeHtml(company)}</p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:28px;font-weight:600">Day ${stepIndex + 1} of ${steps.length}</h1>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr>${progress}</tr></table>
<div style="padding:18px 20px;border-radius:12px;background:#FFFFFF;border:1px solid #E4E4E7">
<p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#6D28D9">Today</p>
<p style="margin:0;font-size:17px;line-height:26px;color:#18181B">${escapeHtml(steps[stepIndex])}</p>
</div>
<p style="margin:18px 0 0;font-size:14px;line-height:21px;color:#52525B"><strong style="color:#3F3F46">${escapeHtml(closing.label)}:</strong> ${escapeHtml(closing.text)}</p>
<p style="margin:24px 0 0"><a href="${escapeHtml(planUrl)}" style="display:inline-block;padding:11px 20px;border-radius:999px;background:#18181B;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none">See the whole plan</a></p>
<p style="margin:28px 0 0;font-size:13px;line-height:20px;color:#71717A">You get this because you turned on daily plan emails in Loop Launch. <a href="${escapeHtml(manageUrl)}" style="color:#71717A">Change the time or stop these emails</a>.</p>
</div></body></html>`;
}
