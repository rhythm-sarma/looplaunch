/**
 * The "how to do it" part of each daily plan email. Loopy writes all seven days in one AI call
 * when the emails start (about ₹0.60 a plan), and they're stored with the steps in plan_emails.
 * Plans started before this, or whose call failed, get theirs on the morning of their next send.
 */

import { writeDayGuides } from "@/lib/ai/gemini";
import { stripDashes } from "@/lib/intelligence/humanize";
import type { IntelligenceSession } from "@/lib/intelligence/types";
import { cleanGuide, planSteps, type DayGuide } from "./plan";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
/** A morning send or the Start button shouldn't hang on a slow model. */
const TIMEOUT_MS = 45_000;

/** The strategy answer these steps came from: the newest whose day lines match them. */
function strategyFor(session: IntelligenceSession, steps: string[]): string | null {
  const messages = session.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "assistant") continue;
    const content = stripDashes(messages[i].content);
    const found = planSteps(content);
    if (found.length === steps.length && found.every((s, k) => s === steps[k])) return content;
  }
  return null;
}

/**
 * A guide for each step (null where the model left a day out), or null if none could be written.
 * Never throws: the email goes out without guides rather than not at all.
 */
export async function writeGuides(session: IntelligenceSession, steps: string[]): Promise<(DayGuide | null)[] | null> {
  const strategy = strategyFor(session, steps);
  const company = session.companyIntelligence;
  if (!strategy || steps.length === 0) return null;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const days = await Promise.race([
      writeDayGuides({
        company: company ?? { name: session.onboardingInput?.companyName || "the business", industry: "", description: "" },
        market: session.marketIntelligence?.research?.market,
        strategy,
        steps,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timed out")), TIMEOUT_MS);
      }),
    ]);
    const guides: (DayGuide | null)[] = steps.map(() => null);
    for (const day of days) guides[day.n - 1] ??= cleanGuide(day.guide);
    return guides.some(Boolean) ? guides : null;
  } catch (error) {
    console.warn("[Plan email] Couldn't write the day guides:", message(error));
    return null;
  } finally {
    clearTimeout(timer);
  }
}
