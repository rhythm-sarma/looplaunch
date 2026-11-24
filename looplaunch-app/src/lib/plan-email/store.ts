/**
 * The plan_emails table (supabase/migrations/013_plan_emails.sql), read and written with the
 * service key only: row level security has no policies.
 */

import { getSupabase } from "@/lib/db/supabase";
import { safeTimeZone } from "@/lib/calendar/agenda";
import { DEFAULT_PLAN_HOUR, cleanGuide, type DayGuide, type PlanEmailStatus } from "./plan";

const TABLE = "plan_emails";
const COLUMNS = "user_id, session_id, company, steps, next_step, time_zone, send_hour, status, last_sent_on";

interface Row {
  user_id: string;
  session_id: string;
  company: string;
  steps: unknown;
  next_step: number;
  time_zone: string;
  send_hour: number;
  status: string;
  last_sent_on: string | null;
}

export interface StoredPlanEmail {
  userId: string;
  sessionId: string;
  company: string;
  steps: string[];
  /** How to do each step (same order as steps); null where there isn't one yet */
  guides: (DayGuide | null)[];
  /** Index of the next step to send */
  nextStep: number;
  timeZone: string;
  sendHour: number;
  status: "active" | "done";
  lastSentOn: string | null;
}

/**
 * The steps column: one item per day, { text, guide } since the day guides, or just the text
 * for plans started before them.
 */
function readSteps(value: unknown): { steps: string[]; guides: (DayGuide | null)[] } {
  const steps: string[] = [];
  const guides: (DayGuide | null)[] = [];
  for (const item of Array.isArray(value) ? value : []) {
    if (typeof item === "string") {
      steps.push(item);
      guides.push(null);
    } else if (item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string") {
      steps.push((item as { text: string }).text);
      guides.push(cleanGuide((item as { guide?: unknown }).guide));
    }
  }
  return { steps, guides };
}

const writeSteps = (steps: string[], guides?: (DayGuide | null)[]) => steps.map((text, i) => ({ text, guide: guides?.[i] ?? null }));

function toStored(row: Row): StoredPlanEmail {
  return {
    userId: row.user_id,
    sessionId: row.session_id,
    company: row.company,
    ...readSteps(row.steps),
    nextStep: row.next_step ?? 0,
    timeZone: safeTimeZone(row.time_zone),
    sendHour: row.send_hour ?? DEFAULT_PLAN_HOUR,
    status: row.status === "done" ? "done" : "active",
    lastSentOn: row.last_sent_on,
  };
}

export function toStatus(stored: StoredPlanEmail): PlanEmailStatus {
  return {
    sessionId: stored.sessionId,
    company: stored.company,
    totalSteps: stored.steps.length,
    sentSteps: Math.min(stored.nextStep, stored.steps.length),
    sendHour: stored.sendHour,
    timeZone: stored.timeZone,
    status: stored.status,
  };
}

let warnedMissingTable = false;

function logError(action: string, error: { code?: string; message: string }) {
  // PGRST205 / 42P01: the table isn't there yet.
  if (error.code === "PGRST205" || error.code === "42P01") {
    if (!warnedMissingTable) {
      console.warn("[Plan email] Table plan_emails is missing. Run supabase/migrations/013_plan_emails.sql in the Supabase SQL Editor.");
      warnedMissingTable = true;
    }
    return;
  }
  console.error(`[Plan email] ${action} failed:`, error.message);
}

/** The person's plan email, null if they have none, or undefined if the table can't be read. */
export async function findPlanEmail(userId: string): Promise<StoredPlanEmail | null | undefined> {
  const db = getSupabase();
  if (!db) return undefined;
  const { data, error } = await db.from(TABLE).select(COLUMNS).eq("user_id", userId).maybeSingle();
  if (error) {
    logError("Reading a plan email", error);
    return undefined;
  }
  return data ? toStored(data as Row) : null;
}

/** Start (or restart, from another analysis) one person's plan emails at step 1. */
export async function savePlanEmail(input: {
  userId: string;
  sessionId: string;
  company: string;
  steps: string[];
  guides?: (DayGuide | null)[] | null;
  timeZone: string;
  sendHour: number;
}): Promise<StoredPlanEmail | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await db
    .from(TABLE)
    .upsert(
      {
        user_id: input.userId,
        session_id: input.sessionId,
        company: input.company,
        steps: writeSteps(input.steps, input.guides ?? undefined),
        next_step: 0,
        time_zone: input.timeZone,
        send_hour: input.sendHour,
        status: "active",
        last_sent_on: null,
        last_sent_at: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select(COLUMNS)
    .single();
  if (error) logError("Saving a plan email", error);
  return data ? toStored(data as Row) : null;
}

/** Day guides written after the plan started. Only lands if it's still the same plan. */
export async function saveGuides(userId: string, sessionId: string, steps: string[], guides: (DayGuide | null)[]) {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db
    .from(TABLE)
    .update({ steps: writeSteps(steps, guides), updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("session_id", sessionId);
  if (error) logError("Saving day guides", error);
}

export async function listActivePlanEmails(): Promise<StoredPlanEmail[]> {
  const db = getSupabase();
  if (!db) return [];
  const { data, error } = await db.from(TABLE).select(COLUMNS).eq("status", "active");
  if (error) {
    logError("Listing plan emails", error);
    return [];
  }
  return (data as Row[]).map(toStored);
}

/** Take today's send for this person, so two overlapping runs can't both send it. */
export async function claimPlanSend(userId: string, date: string): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;
  const { data, error } = await db
    .from(TABLE)
    .update({ last_sent_on: date })
    .eq("user_id", userId)
    .eq("status", "active")
    .or(`last_sent_on.is.null,last_sent_on.neq.${date}`)
    .select("user_id");
  if (error) logError("Claiming a send", error);
  return Boolean(data?.length);
}

/** After a step went out: move to the next one, or finish. */
export async function recordPlanSent(userId: string, result: { nextStep: number; done: boolean; date: string }) {
  const db = getSupabase();
  if (!db) return;
  const now = new Date().toISOString();
  const { error } = await db
    .from(TABLE)
    .update({
      next_step: result.nextStep,
      status: result.done ? "done" : "active",
      last_sent_on: result.date,
      last_sent_at: now,
      last_error: null,
      updated_at: now,
    })
    .eq("user_id", userId);
  if (error) logError("Recording a send", error);
}

/** A send failed: hand the day back so the next check tries again. */
export async function recordPlanFailed(userId: string, message: string, previousDate: string | null) {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db
    .from(TABLE)
    .update({ last_sent_on: previousDate, last_error: message.slice(0, 500), updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) logError("Recording a failed send", error);
}

/** A new send time. Null if they have no plan email (or the table can't be reached). */
export async function updatePlanHour(userId: string, sendHour: number): Promise<StoredPlanEmail | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await db
    .from(TABLE)
    .update({ send_hour: sendHour, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select(COLUMNS)
    .maybeSingle();
  if (error) logError("Changing the send time", error);
  return data ? toStored(data as Row) : null;
}

export async function deletePlanEmail(userId: string): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;
  const { error } = await db.from(TABLE).delete().eq("user_id", userId);
  if (error) logError("Stopping plan emails", error);
  return !error;
}
