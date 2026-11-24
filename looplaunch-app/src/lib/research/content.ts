/**
 * Content tools research: the ☰ menu's Best time to post, Reference videos, News hooks and
 * Caption keywords. Six SerpApi searches, run together, for one short search term (the
 * category, "smartphones"), in the analysis's market:
 *
 *   google_trends 12 months   which months people search the most, and the direction now
 *   google_trends 7 days      which hours and days of the week (hourly data, in local time)
 *   google_trends related     what else people search around the term (top and rising)
 *   youtube                   Shorts and videos already getting views
 *   google_news               this month's stories ("smartphones India"), for posts that ride the news
 *   google_autocomplete       what people type, for captions
 *
 * Then one Gemini call turns the news into post hooks and writes three example captions.
 * Every search goes through the cache and the ledger like the rest of the research; a failed
 * one leaves its tool empty with a plain note, and never blocks the others.
 * Runs during a new analysis (gather) and, for older analyses, the first time the tools open.
 */

import { writeContentIdeas } from "../ai/gemini";
import type { CompanyIntelligence, ContentBestTime, ContentIntel, ContentKeyword, ContentNewsItem, ContentVideo } from "../intelligence/types";
import { createResearchCache } from "./cache";
import { researchConfig } from "./config";
import { ResearchLedger } from "./ledger";
import { marketTimeZone, type SearchMarket } from "./market";
import { categoryOf } from "./plan";
import { canonicalQuery, createSerpApiClient, type NewsItem, type ProviderResult, type SerpApiClient, type TrendPoint, type TrendsRelated, type YouTubeVideo } from "./serpapi";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const NEWS_MAX_AGE_DAYS = 30;

// ──────────────────────────────────────────────
// The search term
// ──────────────────────────────────────────────

/**
 * A short term people actually search: Google Trends has little to say about long phrases.
 * "smartphones and electronics" → "smartphones"; "Smartphones, Computers, and Wearables" → "smartphones".
 */
export function contentTerm(profile: Pick<CompanyIntelligence, "category" | "subIndustry" | "products" | "industry" | "name">): string {
  const source = categoryOf(profile) || (profile.industry || "").toLowerCase() || (profile.name || "").toLowerCase();
  const first = source.split(/\s*(?:,|&|\/|\band\b|\bor\b)\s*/).map((p) => p.trim()).find(Boolean) || source;
  return first.split(/\s+/).slice(0, 3).join(" ").trim();
}

// ──────────────────────────────────────────────
// Best time to post
// ──────────────────────────────────────────────

/** The parts of a moment in a time zone: year, month (0-11), weekday (0 = Sunday), hour. */
function zoned(timestampSeconds: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", weekday: "short", hour: "numeric", hourCycle: "h23" })
      .formatToParts(new Date(timestampSeconds * 1000))
      .map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month) - 1,
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday),
    hour: Number(parts.hour) % 24,
  };
}

const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Weekly points for 12 months → monthly averages, the two peak months and the direction lately. */
export function summariseYear(points: TrendPoint[], timeZone: string): Pick<ContentBestTime, "months" | "peakMonths" | "trend"> | null {
  if (points.length < 8 || points.every((p) => p.value === 0)) return null;
  const byMonth = new Map<string, { label: string; values: number[] }>();
  for (const p of points) {
    const z = zoned(p.timestamp, timeZone);
    const key = `${z.year}-${String(z.month + 1).padStart(2, "0")}`;
    const entry = byMonth.get(key) ?? { label: MONTH_LABELS[z.month], values: [] };
    entry.values.push(p.value);
    byMonth.set(key, entry);
  }
  const months = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, m]) => ({ key, label: m.label, value: Math.round(average(m.values)) }));
  const peakMonths = [...months]
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .map((m) => m.label);

  // The last 13 full weeks against the 13 before them (the newest week is usually still running).
  const full = points.filter((p) => !p.partial);
  const recent = average(full.slice(-13).map((p) => p.value));
  const before = average(full.slice(-26, -13).map((p) => p.value));
  const ratio = before > 0 ? recent / before : 1;
  const trend = ratio >= 1.1 ? "rising" : ratio <= 0.9 ? "falling" : "steady";
  return { months, peakMonths, trend };
}

/**
 * Hourly points for 7 days → interest by local hour, the busiest 3-hour window and the two
 * busiest weekdays. Null when the data is too thin to say (mostly zeros), rather than guessing.
 */
export function summariseWeek(points: TrendPoint[], timeZone: string): Pick<ContentBestTime, "hours" | "bestWindow" | "bestDays"> | null {
  if (points.length < 48) return null;
  const zeros = points.filter((p) => p.value === 0).length;
  if (zeros / points.length > 0.4) return null;

  const byHour: number[][] = Array.from({ length: 24 }, () => []);
  const byDay: number[][] = Array.from({ length: 7 }, () => []);
  for (const p of points) {
    const z = zoned(p.timestamp, timeZone);
    byHour[z.hour].push(p.value);
    if (z.weekday >= 0) byDay[z.weekday].push(p.value);
  }
  const hourly = byHour.map(average);
  const top = Math.max(...hourly);
  if (top <= 0) return null;
  const hours = hourly.map((v) => Math.round((v / top) * 100));

  // The 3 hours in a row (around the clock) with the most interest.
  let start = 0;
  let best = -1;
  for (let h = 0; h < 24; h++) {
    const sum = hours[h] + hours[(h + 1) % 24] + hours[(h + 2) % 24];
    if (sum > best) {
      best = sum;
      start = h;
    }
  }
  // A weekday needs most of its hours to count: the 7-day range starts and ends mid-day.
  const bestDays = byDay
    .map((values, day) => ({ day, value: values.length >= 12 ? average(values) : -1 }))
    .filter((d) => d.value >= 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .map((d) => DAY_NAMES[d.day]);

  return { hours, bestWindow: { start, end: (start + 3) % 24 }, bestDays };
}

// ──────────────────────────────────────────────
// Videos, news, keywords
// ──────────────────────────────────────────────

/** Three Shorts and three longer videos, most viewed first (fewer of one kind: more of the other). */
export function pickVideos(videos: YouTubeVideo[], max = 6): ContentVideo[] {
  const seen = new Set<string>();
  const unique = videos.filter((v) => {
    const key = v.videoId || v.link;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const byViews = (a: YouTubeVideo, b: YouTubeVideo) => (b.views ?? 0) - (a.views ?? 0);
  const shorts = unique.filter((v) => v.isShort).sort(byViews);
  const long = unique.filter((v) => !v.isShort).sort(byViews);
  const half = Math.ceil(max / 2);
  const takeShorts = Math.min(shorts.length, Math.max(half, max - long.length));
  return [...shorts.slice(0, takeShorts), ...long.slice(0, max - takeShorts)].map((v) => ({
    title: v.title,
    link: v.link,
    channel: v.channel,
    views: v.views,
    length: v.length,
    published: v.published,
    thumbnail: v.thumbnail,
    isShort: v.isShort,
  }));
}

const STOP_WORDS = new Set(["the", "a", "an", "of", "in", "on", "for", "to", "and", "as", "by", "with", "at", "is", "are", "its", "it", "from", "after", "this", "that", "new"]);

/**
 * Two headlines about the same story. The search term's own words don't count (nearly every
 * headline has them). Same story: most of the shorter headline's words are in the other, or both
 * lead with the same name ("Xiaomi…") and share a good part of the rest.
 */
export function sameStory(a: string, b: string, term = ""): boolean {
  const skip = new Set([...STOP_WORDS, ...canonicalQuery(term).split(" ")]);
  // "launching", "launched" and "launch" count as one word
  const stem = (w: string) => (w.length > 5 ? w.replace(/(ing|ed)$/, "") : w);
  const words = (title: string) =>
    canonicalQuery(title.replace(/[’']s\b/g, ""))
      .split(" ")
      .filter((w) => w.length > 1 && !skip.has(w))
      .map(stem);
  const lead = (title: string) => {
    const first = canonicalQuery(title.split(/\s+/)[0].replace(/[’']s$/, ""));
    return first.length > 1 && !skip.has(first) ? first : null;
  };
  const wa = new Set(words(a));
  const wb = new Set(words(b));
  const small = wa.size <= wb.size ? wa : wb;
  const large = small === wa ? wb : wa;
  if (small.size === 0) return false;
  let shared = 0;
  for (const w of small) if (large.has(w)) shared++;
  const overlap = shared / small.size;
  const la = lead(a);
  return overlap >= 0.6 || (la !== null && la === lead(b) && overlap >= 0.4);
}

/** The newest stories from the last 30 days, one headline per story (the same news from several outlets counts once). */
export function pickNews(items: NewsItem[], now: Date, max = 6, term = ""): ContentNewsItem[] {
  const cutoff = now.getTime() - NEWS_MAX_AGE_DAYS * 86_400_000;
  const kept: NewsItem[] = [];
  for (const n of items
    .filter((n) => n.publishedAt && new Date(n.publishedAt).getTime() >= cutoff && new Date(n.publishedAt).getTime() <= now.getTime() + 86_400_000)
    .sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime())) {
    if (!kept.some((k) => sameStory(k.title, n.title, term))) kept.push(n);
  }
  return kept
    .slice(0, max)
    .map((n) => ({ title: n.title, link: n.link, source: n.source, publishedAt: n.publishedAt }));
}

/**
 * Search phrases worth putting in captions. Google Trends' related searches lead (rising ones
 * first), then autocomplete. Only phrases that contain the term itself are kept: the related
 * lists carry unrelated spam ("binance promo code"), and brand names alone make poor captions.
 * Autocomplete's near-identical variants ("under 10000", "under 20000"…) are cut to two.
 */
export function pickKeywords(term: string, related: TrendsRelated | null, suggestions: string[], max = 12): ContentKeyword[] {
  const termWords = canonicalQuery(term).split(" ").filter(Boolean);
  const about = (phrase: string) => {
    const words = new Set(canonicalQuery(phrase).split(" "));
    return termWords.every((w) => words.has(w));
  };
  const seen = new Set([canonicalQuery(term)]);
  const shapes = new Map<string, number>();
  const out: ContentKeyword[] = [];
  const add = (phrase: string, rising?: string) => {
    const clean = phrase.toLowerCase().replace(/\s+/g, " ").trim();
    const key = canonicalQuery(clean);
    if (!clean || seen.has(key) || !about(clean) || out.length >= max) return;
    const shape = clean.replace(/\d+k?\b/g, "#");
    if (shape !== clean) {
      const n = shapes.get(shape) ?? 0;
      if (n >= 2) return;
      shapes.set(shape, n + 1);
    }
    seen.add(key);
    out.push(rising ? { phrase: clean, rising } : { phrase: clean });
  };
  for (const r of related?.rising ?? []) add(r.query, r.label === "Breakout" ? "Breakout" : r.label || undefined);
  for (const r of related?.top ?? []) add(r.query);
  for (const s of suggestions) add(s);
  return out;
}

/** Hashtags from the term and the keywords: lowercase, no spaces, nothing over 24 letters. */
export function hashtagsOf(term: string, keywords: ContentKeyword[], max = 8): string[] {
  const tags = [term, ...keywords.map((k) => k.phrase)]
    .map((p) => `#${p.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")}`)
    .filter((t) => t.length > 2 && t.length <= 25);
  return [...new Set(tags)].slice(0, max);
}

// ──────────────────────────────────────────────
// The run
// ──────────────────────────────────────────────

export interface ContentResearchDeps {
  serp: SerpApiClient;
  writeIdeas: typeof writeContentIdeas;
  now: () => Date;
}

function defaultDeps(): ContentResearchDeps {
  const config = researchConfig();
  return {
    serp: createSerpApiClient({ apiKey: process.env.SERPAPI_API_KEY, cache: createResearchCache(), config }),
    writeIdeas: writeContentIdeas,
    now: () => new Date(),
  };
}

const failNote = (r: ProviderResult<unknown>) => (r.ok ? "" : r.kind === "quota" ? "out of monthly searches" : r.kind === "not_configured" ? "not set up" : "failed");

export async function runContentResearch(input: {
  profile: CompanyIntelligence;
  market: SearchMarket;
  sessionId?: string;
  deps?: Partial<ContentResearchDeps>;
}): Promise<ContentIntel> {
  const deps: ContentResearchDeps = { ...defaultDeps(), ...input.deps };
  const { market } = input;
  const term = contentTerm(input.profile);
  const timeZone = marketTimeZone(market);
  const ledger = new ResearchLedger(input.sessionId, { content_signals: 6 });
  // Google News leans global even on Google India; naming the country brings its own outlets
  // and launches forward ("smartphones India": News18, Gadgets 360, The Hindu).
  const newsQuery = canonicalQuery(term).includes(canonicalQuery(market.country)) ? term : `${term} ${market.country}`;
  const ctx = { ledger, purpose: "content_signals" as const };
  const limitations: string[] = [];

  const [year, week, related, youtube, news, autocomplete] = await Promise.all([
    deps.serp.trends(term, market, "today 12-m", ctx),
    deps.serp.trends(term, market, "now 7-d", ctx),
    deps.serp.trendsRelated(term, market, ctx),
    deps.serp.youtube(term, market, ctx),
    deps.serp.news(newsQuery, market, ctx),
    deps.serp.autocomplete(term, market, ctx),
  ]);

  // Best time to post
  const yearly = year.ok ? summariseYear(year.data.points, timeZone) : null;
  const weekly = week.ok ? summariseWeek(week.data.points, timeZone) : null;
  if (!year.ok) limitations.push(`Google Trends for the year ${failNote(year)}.`);
  else if (!yearly) limitations.push(`Google Trends has too little data on "${term}" in ${market.country} for a yearly pattern.`);
  if (week.ok && !weekly) limitations.push(`Too few searches for "${term}" in the last 7 days to tell the best hours.`);
  const bestTime: ContentBestTime | undefined = yearly ? { ...yearly, ...(weekly ?? {}) } : undefined;

  // Videos, news, keywords
  const videos = youtube.ok ? pickVideos(youtube.data.videos) : [];
  if (!youtube.ok) limitations.push(`YouTube search ${failNote(youtube)}.`);
  const now = deps.now();
  // The term and the country are in nearly every headline, so they don't count when spotting repeats.
  const stories = news.ok ? pickNews(news.data.items, now, 6, newsQuery) : [];
  if (!news.ok) limitations.push(`Google News search ${failNote(news)}.`);
  else if (stories.length === 0) limitations.push(`No news about "${term}" in the last ${NEWS_MAX_AGE_DAYS} days.`);
  const keywords = pickKeywords(term, related.ok ? related.data : null, autocomplete.ok ? autocomplete.data.suggestions : []);
  if (!related.ok && !autocomplete.ok) limitations.push(`Keyword searches ${failNote(autocomplete)}.`);

  // Loopy: a post hook per story, and example captions with the keywords
  let captions: string[] = [];
  if (stories.length || keywords.length) {
    try {
      const ideas = await deps.writeIdeas({
        company: input.profile,
        market: { scope: market.scope, country: market.country, searchLocation: market.location, city: market.city, assumed: market.assumed },
        headlines: stories.map((s) => ({ title: s.title, source: s.source })),
        keywords: keywords.map((k) => k.phrase),
      });
      for (const h of ideas.hooks) if (stories[h.n - 1]) stories[h.n - 1].hook = h.hook;
      captions = ideas.captions;
    } catch (e) {
      console.warn("[Content] Couldn't write hooks and captions:", e instanceof Error ? e.message : e);
      limitations.push("Loopy couldn't write the post hooks and captions this time.");
    }
  }

  await ledger.persist();
  const counts = ledger.counts("serpapi");
  console.log(`[Content] "${term}" in ${market.country}: ${counts.network} searches, ${counts.cached} from cache, ${counts.failed} failed.`);

  return {
    term,
    country: market.country,
    timeZone,
    collectedAt: now.toISOString(),
    bestTime,
    videos,
    news: stories,
    keywords,
    hashtags: hashtagsOf(term, keywords),
    captions,
    limitations,
  };
}
