/**
 * Runs once when a Next.js server starts. Starts the morning emails (src/lib/email/scheduler.ts)
 * on the Node.js server only, and not while `next build` is prerendering pages.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { startDailyEmails } = await import("./lib/email/scheduler");
  startDailyEmails();
}
