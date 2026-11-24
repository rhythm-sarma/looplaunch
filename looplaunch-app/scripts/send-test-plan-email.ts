/**
 * Send one day of an analysis's daily plan email, with Loopy's "how to do it" guide, through
 * Brevo, using the same code the app uses. Nothing is saved; it costs one AI call (about ₹0.60).
 *
 *   npm run plan:test-email -- <sessionId> you@example.com [day, 1 to 7]
 */

import fs from "fs";
import os from "os";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const [sessionId, to, dayArg] = process.argv.slice(2).map((a) => a?.trim());
  if (!sessionId || !to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error("Usage: npm run plan:test-email -- <sessionId> you@example.com [day]");
    process.exit(1);
  }

  // Imported after the environment is loaded, since they read it.
  const { emailSender, sendEmail } = await import("../src/lib/email/brevo");
  const { getSession } = await import("../src/lib/intelligence/store");
  const { stripDashes } = await import("../src/lib/intelligence/humanize");
  const { latestPlan, planEmailHtml, planEmailSubject, planEmailText } = await import("../src/lib/plan-email/plan");
  const { writeGuides } = await import("../src/lib/plan-email/guides");
  const { getSiteUrl } = await import("../src/lib/seo");

  if (!emailSender()) {
    console.error("BREVO_API_KEY or AGENDA_EMAIL_FROM isn't set in .env.local, so email can't be sent.");
    process.exit(1);
  }
  const session = await getSession(sessionId);
  if (!session) throw new Error(`No analysis ${sessionId}`);
  const plan = latestPlan((session.messages ?? []).map((m) => ({ ...m, content: stripDashes(m.content) })));
  if (!plan) throw new Error("That analysis has no day-by-day plan.");

  const day = Math.min(Math.max(Number(dayArg) || 1, 1), plan.steps.length);
  console.log(`Writing the day guides for ${plan.steps.length} days…`);
  const started = Date.now();
  const guides = await writeGuides(session, plan.steps);
  console.log(guides ? `Done in ${((Date.now() - started) / 1000).toFixed(1)} s` : "No guides; sending the plain step only.");

  const site = getSiteUrl();
  const input = {
    company: session.onboardingInput?.companyName || session.companyIntelligence?.name || "your business",
    steps: plan.steps,
    stepIndex: day - 1,
    guide: guides?.[day - 1] ?? null,
    planUrl: `${site}/intelligence?session=${encodeURIComponent(sessionId)}`,
    manageUrl: `${site}/profile#settings-plan-email`,
  };
  const html = planEmailHtml(input);
  const out = path.join(os.tmpdir(), `plan-email-day-${day}.html`);
  fs.writeFileSync(out, html);
  fs.writeFileSync(out.replace(/\.html$/, ".json"), JSON.stringify(guides, null, 2));
  console.log(`Saved a copy: ${out}`);

  const ok = await sendEmail({ to, subject: `[Test] ${planEmailSubject(input)}`, html, text: planEmailText(input), tag: "daily-plan-test" });
  console.log(ok ? `Sent day ${day} to ${to}.` : "Sending failed.");
  // The database client keeps the process alive otherwise.
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
