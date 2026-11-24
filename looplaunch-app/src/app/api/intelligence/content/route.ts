/**
 * GET /api/intelligence/content?sessionId=…
 *
 * The ☰ menu's content tools (best time to post, reference videos, news hooks, caption
 * keywords) for one analysis. New analyses collect them while they're made; older ones
 * collect them here the first time the tools open (6 SerpApi searches and one Gemini call),
 * and save them, so every later open is free.
 */

import { NextResponse } from "next/server";
import { canUseSession } from "@/lib/auth/session-access";
import { getSignedInClaims } from "@/lib/auth/supabase-server";
import { rejectIfNoAccess } from "@/lib/auth/team-guard";
import { getSession, updateSession } from "@/lib/intelligence/store";
import type { ContentIntel } from "@/lib/intelligence/types";
import { runContentResearch } from "@/lib/research/content";
import { marketFromStored } from "@/lib/research/market";
import { rejectIfTooMany } from "@/lib/security/rate-limit";

/** After a run that found nothing, wait this long before searching again. */
const RETRY_AFTER_MS = 10 * 60 * 1000;

// One run per analysis at a time (a double click mustn't pay twice), shared across requests.
const state = globalThis as unknown as {
  __contentRuns?: Map<string, Promise<ContentIntel | null>>;
  __contentFailedAt?: Map<string, number>;
};
const running = (state.__contentRuns ??= new Map());
const failedAt = (state.__contentFailedAt ??= new Map());

const hasAnything = (c: ContentIntel) => Boolean(c.bestTime || c.videos.length || c.news.length || c.keywords.length);

export async function GET(request: Request) {
  const denied = await rejectIfNoAccess();
  if (denied) return denied;
  const claims = await getSignedInClaims();
  if (!claims) {
    return NextResponse.json({ error: "Log in to see the content tools.", loginRequired: true }, { status: 401 });
  }

  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

  const session = await getSession(sessionId);
  if (!session || !(await canUseSession(session))) {
    return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
  }
  const stored = session.marketIntelligence?.contentIntel;
  if (stored) return NextResponse.json({ content: stored });

  if (!session.companyIntelligence || !session.marketIntelligence) {
    return NextResponse.json({ error: "This analysis isn't finished yet." }, { status: 409 });
  }
  if (Date.now() - (failedAt.get(sessionId) ?? 0) < RETRY_AFTER_MS) {
    return NextResponse.json({ error: "Couldn't find anything just now. Try again in a few minutes." }, { status: 503 });
  }

  let run = running.get(sessionId);
  if (!run) {
    // Only a new run spends searches, so only a new run counts toward the limit.
    const limited = rejectIfTooMany(request, "content", claims.userId);
    if (limited) return limited;
    const profile = session.companyIntelligence;
    const market = marketFromStored(session.marketIntelligence.research?.market);
    run = runContentResearch({ profile, market, sessionId })
      .then(async (content) => {
        if (!hasAnything(content)) {
          failedAt.set(sessionId, Date.now());
          return null;
        }
        // Save onto the newest copy, so nothing written meanwhile (answers, quick answers) is lost.
        const fresh = (await getSession(sessionId)) ?? session;
        if (fresh.marketIntelligence) await updateSession(sessionId, { marketIntelligence: { ...fresh.marketIntelligence, contentIntel: content } });
        return content;
      })
      .catch((e) => {
        console.error("[Content] Run failed:", e instanceof Error ? e.message : e);
        failedAt.set(sessionId, Date.now());
        return null;
      })
      .finally(() => running.delete(sessionId));
    running.set(sessionId, run);
  }

  const content = await run;
  if (!content) return NextResponse.json({ error: "Couldn't find anything just now. Try again in a few minutes." }, { status: 503 });
  return NextResponse.json({ content });
}
