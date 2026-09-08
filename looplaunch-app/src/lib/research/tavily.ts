/**
 * Tavily Search API Service
 *
 * Market research via Tavily's search API.
 * Currently STUBBED — will be activated when the API key is provided.
 *
 * Includes caching to avoid duplicate searches ("Research Once, Answer Many Times").
 */

import type { TavilySearchResult } from "../intelligence/types";

// ──────────────────────────────────────────────
// Search Cache (in-memory, simple dedup)
// ──────────────────────────────────────────────

const searchCache = new Map<string, { results: TavilySearchResult[]; cachedAt: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function getCacheKey(query: string): string {
  return query.toLowerCase().trim();
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Check if Tavily is configured and available.
 */
export function isTavilyAvailable(): boolean {
  return !!process.env.TAVILY_API_KEY;
}

/**
 * Search the web for market intelligence.
 * Returns cached results if available.
 */
export async function searchMarket(query: string): Promise<TavilySearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    console.log("[Tavily] API key not configured, returning empty results");
    return [];
  }

  // Check cache
  const cacheKey = getCacheKey(query);
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    console.log(`[Tavily] Cache hit for: "${query}"`);
    return cached.results;
  }

  try {
    console.log(`[Tavily] Searching: "${query}"`);
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        max_results: 10,
        include_answer: true,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(20000), // 20s timeout
    });

    if (!response.ok) {
      console.warn(`[Tavily] Search failed with status ${response.status}`);
      return [];
    }

    const data = await response.json();
    const results: TavilySearchResult[] = (data.results || []).map(
      (r: { title: string; url: string; content: string; score: number }) => ({
        title: r.title || "",
        url: r.url || "",
        content: r.content || "",
        score: r.score || 0,
      })
    );

    // Cache results
    searchCache.set(cacheKey, { results, cachedAt: Date.now() });
    console.log(`[Tavily] Found ${results.length} results for: "${query}"`);

    return results;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[Tavily] Search error: ${msg}`);
    return [];
  }
}

/**
 * Run multiple market research searches and combine results.
 * Builds queries from onboarding data to cover different angles.
 */
export async function runMarketResearch(
  industry: string,
  targetAudience: string,
  competitors: string
): Promise<{ allResults: TavilySearchResult[]; summaryText: string }> {
  if (!isTavilyAvailable()) {
    console.log("[Tavily] Skipping market research — API key not configured");
    return { allResults: [], summaryText: "" };
  }

  // Build diverse search queries
  const queries = [
    `${industry} market trends 2024 2025`,
    `${industry} ${targetAudience} market size growth`,
    `${industry} competitive landscape analysis`,
  ];

  // Add competitor-specific queries if provided
  if (competitors) {
    const competitorNames = competitors
      .split(/[,\n]/)
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 3); // Max 3 competitor searches

    for (const name of competitorNames) {
      queries.push(`${name} company marketing strategy`);
    }
  }

  // Run all searches in parallel
  const results = await Promise.allSettled(queries.map((q) => searchMarket(q)));

  const allResults: TavilySearchResult[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allResults.push(...result.value);
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const deduped = allResults.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  // Build summary text for Gemini
  const summaryText = deduped
    .map((r) => `[${r.title}]\n${r.content}\nSource: ${r.url}\n`)
    .join("\n---\n");

  console.log(
    `[Tavily] Market research complete: ${deduped.length} unique results from ${queries.length} queries`
  );

  return { allResults: deduped, summaryText };
}
