/**
 * POST /api/intelligence/gather
 *
 * Main intelligence pipeline endpoint.
 * Receives onboarding data and orchestrates:
 * 1. Crawl company website
 * 2. Crawl competitor websites
 * 3. Market research (Tavily)
 * 4. Gemini structuring (company, competitors, market)
 * 5. Strategic diagnosis
 * 6. Store everything in the intelligence store
 *
 * Returns immediately with a sessionId.
 * Pipeline runs asynchronously — poll /api/intelligence/status for progress.
 */

import { NextResponse } from "next/server";
import type { OnboardingInput, GatherResponse } from "@/lib/intelligence/types";
import {
  createSession,
  updateSession,
  updateStatus,
} from "@/lib/intelligence/store";
import {
  crawlWebsite,
  crawlResultToText,
  crawlUrl,
} from "@/lib/crawler/website-crawler";
import {
  analyzeCompany,
  analyzeCompetitor,
  analyzeMarket,
  generateDiagnosis,
} from "@/lib/ai/gemini";
import { runMarketResearch } from "@/lib/research/tavily";

// ──────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────

function validateInput(body: unknown): OnboardingInput | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;

  if (!data.companyName || typeof data.companyName !== "string") return null;
  if (!data.whatTheySell || typeof data.whatTheySell !== "string") return null;

  return {
    companyName: data.companyName as string,
    nameAndRole: (data.nameAndRole as string) || "",
    whatTheySell: (data.whatTheySell as string) || "",
    website: (data.website as string) || "",
    competitors: (data.competitors as string) || "",
    painPoint: (data.painPoint as string) || "",
    whyTheyreHere: Array.isArray(data.whyTheyreHere) ? data.whyTheyreHere as string[] : [],
  };
}

// ──────────────────────────────────────────────
// Pipeline Orchestrator (runs asynchronously)
// ──────────────────────────────────────────────

async function runPipeline(sessionId: string, input: OnboardingInput) {
  try {
    // ─── STAGE 1: Crawl Company Website ───
    updateStatus(sessionId, "crawling_company", "Researching your website...");
    let companyCrawl;
    try {
      companyCrawl = await crawlWebsite(input.website);
    } catch (e) {
      console.error("[Pipeline] Company crawl failed:", e);
      companyCrawl = { pages: [], domain: "", totalPages: 0, crawledAt: new Date().toISOString() };
    }
    const companyText = crawlResultToText(companyCrawl);

    // ─── STAGE 2: Crawl Competitor Websites ───
    updateStatus(sessionId, "crawling_competitors", "Researching your competitors...");
    const competitorNames = input.competitors
      .split(/[,\n]/)
      .map((c) => c.trim())
      .filter(Boolean);

    const competitorCrawls: { name: string; text: string }[] = [];
    for (const name of competitorNames.slice(0, 5)) {
      try {
        // If the name looks like a URL, crawl it directly
        const isUrl = name.includes(".") && !name.includes(" ");
        const url = isUrl
          ? name.startsWith("http") ? name : `https://${name}`
          : null;

        if (url) {
          const crawl = await crawlWebsite(url);
          competitorCrawls.push({ name, text: crawlResultToText(crawl) });
        } else {
          competitorCrawls.push({ name, text: "" });
        }
      } catch (e) {
        console.warn(`[Pipeline] Competitor crawl failed for ${name}:`, e);
        competitorCrawls.push({ name, text: "" });
      }
    }

    // ─── STAGE 3: Market Research (Tavily) ───
    updateStatus(sessionId, "researching_market", "Analyzing your market...");
    let marketResearchText = "";
    try {
      const { summaryText } = await runMarketResearch(
        input.whatTheySell,
        input.painPoint,
        input.competitors
      );
      marketResearchText = summaryText;
    } catch (e) {
      console.warn("[Pipeline] Market research failed:", e);
    }

    // ─── STAGE 4: Gemini — Analyze Company ───
    updateStatus(sessionId, "analyzing_company", "Building company intelligence profile...");
    const companyIntel = await analyzeCompany(input, companyText);
    updateSession(sessionId, { companyIntelligence: companyIntel });

    // ─── STAGE 5: Gemini — Analyze Competitors ───
    updateStatus(sessionId, "analyzing_competitors", "Analyzing competitive landscape...");
    const companyContext = `${companyIntel.name}: ${companyIntel.description}. Value prop: ${companyIntel.valueProposition}`;
    const competitorIntels = [];
    for (const comp of competitorCrawls) {
      try {
        const intel = await analyzeCompetitor(comp.name, comp.text, companyContext);
        competitorIntels.push(intel);
      } catch (e) {
        console.warn(`[Pipeline] Competitor analysis failed for ${comp.name}:`, e);
      }
    }
    updateSession(sessionId, { competitorIntelligence: competitorIntels });

    // ─── STAGE 6: Gemini — Analyze Market ───
    updateStatus(sessionId, "analyzing_market", "Understanding market dynamics...");
    const marketIntel = await analyzeMarket(input, marketResearchText);
    updateSession(sessionId, {
      marketIntelligence: marketIntel,
    });

    // ─── STAGE 7: Gemini — Strategic Diagnosis ───
    updateStatus(sessionId, "diagnosing", "Generating strategic diagnosis...");
    const diagnosis = await generateDiagnosis(
      companyIntel,
      competitorIntels,
      marketIntel,
      input
    );
    updateSession(sessionId, { diagnosis });

    // ─── DONE ───
    updateStatus(sessionId, "ready", "Intelligence gathering complete. Ready for questions.");
    console.log(`[Pipeline] Session ${sessionId} complete.`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Pipeline] Fatal error for session ${sessionId}:`, msg);
    updateSession(sessionId, {
      status: "error",
      statusMessage: "An error occurred during intelligence gathering.",
      error: msg,
    });
  }
}

// ──────────────────────────────────────────────
// Route Handler
// ──────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = validateInput(body);

    if (!input) {
      return NextResponse.json(
        { error: "Invalid input. 'website' and 'companyDescription' are required." },
        { status: 400 }
      );
    }

    // Check Gemini is configured
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key is not configured. Set GEMINI_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    // Create session and start pipeline asynchronously
    const session = createSession(input);

    // Run pipeline in background (don't await — return immediately)
    runPipeline(session.id, input).catch((e) => {
      console.error("[Pipeline] Unhandled error:", e);
    });

    const response: GatherResponse = {
      sessionId: session.id,
      status: "crawling_company",
      message: "Intelligence gathering started. Poll /api/intelligence/status for progress.",
    };

    return NextResponse.json(response, { status: 202 }); // 202 Accepted
  } catch (error) {
    console.error("[API] /intelligence/gather error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
