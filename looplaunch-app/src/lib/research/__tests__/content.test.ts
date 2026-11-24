import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { contentTerm, hashtagsOf, pickKeywords, pickNews, pickVideos, runContentResearch, sameStory, summariseWeek, summariseYear } from "../content";
import { marketFromStored, marketTimeZone } from "../market";
import { parseAutocomplete, parseNews, parseTrends, parseTrendsRelated, parseYouTube, type ProviderResult, type SerpApiClient } from "../serpapi";
import { profile } from "./helpers";

// Real SerpApi responses for "smartphones" on Google India (24 Nov 2026), trimmed.
const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", `serpapi-${name}.json`), "utf8"));
const IST = "Asia/Kolkata";
const NOW = new Date("2026-11-24T12:00:00Z");

describe("content parsers (real responses)", () => {
  test("Trends: 12 months of weekly points, the newest marked partial", () => {
    const { points } = parseTrends(fixture("trends-12m"));
    assert.equal(points.length, 53);
    assert.equal(points[0].timestamp, 1763856000);
    assert.equal(points[0].value, 61);
    assert.equal(points.at(-1)?.partial, true);
  });

  test("Trends: 7 days of hourly points", () => {
    const { points } = parseTrends(fixture("trends-7d"));
    assert.equal(points.length, 169);
    assert.ok(points.every((p) => p.value >= 0 && p.value <= 100));
  });

  test("Trends related searches: top and rising, with Google's labels", () => {
    const related = parseTrendsRelated(fixture("trends-related"));
    assert.equal(related.top[0].query, "best smartphones");
    assert.equal(related.top[0].value, 100);
    assert.ok(related.rising.some((r) => r.label === "Breakout"));
  });

  test("YouTube: Shorts and videos, with views and thumbnails", () => {
    const { videos } = parseYouTube(fixture("youtube"));
    const shorts = videos.filter((v) => v.isShort);
    assert.ok(shorts.length > 0);
    assert.ok(videos.some((v) => !v.isShort && v.channel && v.length));
    assert.ok(videos.every((v) => v.link.startsWith("https://")));
    assert.ok(shorts.every((v) => v.thumbnail?.startsWith("https://i.ytimg.com/vi/") && v.thumbnail.endsWith("/hqdefault.jpg")));
  });

  test("News: titles, sources and ISO dates", () => {
    const { items } = parseNews(fixture("news"));
    assert.ok(items.length >= 10);
    assert.equal(items[0].source, "Fortune");
    assert.equal(items[0].publishedAt, "2026-11-23T08:00:00.000Z");
  });

  test("Autocomplete: the suggestions", () => {
    const { suggestions } = parseAutocomplete(fixture("autocomplete"));
    assert.equal(suggestions[0], "smartphones under 20000");
  });

  test("empty and broken bodies give empty results, not errors", () => {
    assert.deepEqual(parseTrends({}), { points: [] });
    assert.deepEqual(parseYouTube({ video_results: "x" }), { videos: [] });
    assert.deepEqual(parseNews({}), { items: [] });
    assert.deepEqual(parseAutocomplete({}), { suggestions: [] });
  });
});

describe("best time to post", () => {
  test("the year: 12 months, two peaks, and the direction lately", () => {
    const year = summariseYear(parseTrends(fixture("trends-12m")).points, IST);
    assert.ok(year);
    assert.equal(year.months.length, 12);
    assert.equal(year.months.at(-1)?.key, "2026-11");
    assert.equal(year.peakMonths.length, 2);
    assert.ok(["rising", "falling", "steady"].includes(year.trend));
  });

  test("the week: hours in India time, the busiest 3-hour window and the two busiest days", () => {
    const week = summariseWeek(parseTrends(fixture("trends-7d")).points, IST);
    assert.ok(week?.hours && week.bestWindow && week.bestDays);
    assert.equal(week.hours.length, 24);
    assert.equal(Math.max(...week.hours), 100);
    assert.equal((week.bestWindow.start + 3) % 24, week.bestWindow.end);
    assert.equal(week.bestDays.length, 2);
  });

  test("the window can pass midnight", () => {
    // Busiest at 10 PM to 1 AM IST.
    const start = Date.UTC(2026, 10, 16, 18, 30) / 1000; // Nov 17, 00:00 IST
    const points = Array.from({ length: 168 }, (_, i) => {
      const hour = i % 24;
      return { timestamp: start + i * 3600, value: hour >= 22 || hour === 0 ? 90 : 20 };
    });
    assert.deepEqual(summariseWeek(points, IST)?.bestWindow, { start: 22, end: 1 });
  });

  test("too little data says nothing instead of guessing", () => {
    const sparse = Array.from({ length: 168 }, (_, i) => ({ timestamp: 1794906000 + i * 3600, value: i % 3 === 0 ? 40 : 0 }));
    assert.equal(summariseWeek(sparse, IST), null);
    assert.equal(summariseYear([{ timestamp: 1, value: 0 }], IST), null);
  });
});

describe("videos, news and keywords", () => {
  test("videos: Shorts first, most viewed first, six at most", () => {
    const picked = pickVideos(parseYouTube(fixture("youtube")).videos);
    assert.equal(picked.length, 6);
    const shorts = picked.filter((v) => v.isShort);
    assert.ok(shorts.length >= 3);
    assert.ok(picked.indexOf(shorts.at(-1)!) < picked.findIndex((v) => !v.isShort) || picked.every((v) => v.isShort));
    for (let i = 1; i < shorts.length; i++) assert.ok((shorts[i - 1].views ?? 0) >= (shorts[i].views ?? 0));
  });

  test("news: last 30 days only, newest first", () => {
    const items = pickNews(
      [
        { title: "Old story", link: "https://a.example/1", publishedAt: "2026-09-01T00:00:00Z" },
        { title: "Yesterday", link: "https://a.example/2", publishedAt: "2026-11-23T10:00:00Z" },
        { title: "Today", link: "https://a.example/3", publishedAt: "2026-11-24T09:00:00Z" },
        { title: "No date", link: "https://a.example/4" },
      ],
      NOW
    );
    assert.deepEqual(items.map((n) => n.title), ["Today", "Yesterday"]);
  });

  test("news: the same story from several outlets counts once", () => {
    const items = pickNews(parseNews(fixture("news")).items, NOW, 14);
    const xiaomi = items.filter((n) => /xiaomi/i.test(n.title));
    assert.ok(xiaomi.length <= 1, xiaomi.map((n) => n.title).join(" / "));
    assert.ok(sameStory("Xiaomi third-quarter profit drops as smartphone sales weigh on earnings", "Xiaomi third-quarter profit falls 57% as smartphone sales hit", "smartphones"));
    assert.ok(sameStory("Xiaomi third-quarter profit drops as smartphone sales weigh on earnings", "Xiaomi’s Sales Slip After Memory Shortages Weigh on Smartphones", "smartphones"));
    assert.ok(!sameStory("Xiaomi profit drops", "Nearly half of festive sales of smartphones were financed", "smartphones"));
    assert.ok(!sameStory("Smartphone sales in India rise", "Smartphone sales in the US fall", "smartphones"));
    const q = "smartphones India";
    assert.ok(sameStory("Motorola Signature 27 Launching In India on December 9: 200MP Camera, Expected Price And Features", "Motorola Signature 27 India Launch Date Announced, Availability Details Revealed: Specifications", q));
    assert.ok(!sameStory("Motorola Edge 70 Neo Launched in India at ₹37,999", "Motorola Signature 27 Launching In India on December 9: 200MP Camera, Expected Price And Features", q));
  });

  test("keywords: only phrases about the term, spam dropped, price variants cut to two", () => {
    const keywords = pickKeywords("smartphones", parseTrendsRelated(fixture("trends-related")), parseAutocomplete(fixture("autocomplete")).suggestions);
    const phrases = keywords.map((k) => k.phrase);
    assert.ok(phrases.includes("best smartphones"));
    assert.ok(phrases.includes("budget smartphones"));
    assert.ok(phrases.every((p) => /smartphone/.test(p)));
    assert.ok(!phrases.some((p) => /binance|hostinger|orangex/.test(p)));
    assert.ok(phrases.filter((p) => /under \d/.test(p)).length <= 2);
    assert.equal(keywords.find((k) => k.phrase === "vivo smartphones")?.rising, "+140%");
    assert.ok(keywords.length <= 12);
  });

  test("hashtags: lowercase, no spaces, no repeats", () => {
    assert.deepEqual(hashtagsOf("smartphones", [{ phrase: "best smartphones" }, { phrase: "5g smartphones" }, { phrase: "best smartphones" }]), [
      "#smartphones",
      "#bestsmartphones",
      "#5gsmartphones",
    ]);
  });
});

describe("the search term and market", () => {
  test("a short term from the category", () => {
    assert.equal(contentTerm(profile({ category: "smartphones and electronics" })), "smartphones");
    assert.equal(contentTerm(profile({ category: "", subIndustry: "Smartphones, Computers, and Wearables" })), "smartphones");
    assert.equal(contentTerm(profile({ category: "thrift clothing" })), "thrift clothing");
  });

  test("a stored market comes back whole; old analyses get India", () => {
    const m = marketFromStored({ country: "India", searchLocation: "India", scope: "international", assumed: false });
    assert.equal(m.gl, "in");
    assert.equal(m.iso2, "IN");
    assert.equal(marketTimeZone(m), IST);
    assert.equal(marketFromStored(undefined).country, "India");
    assert.equal(marketFromStored({ country: "United Kingdom" }).gl, "uk");
  });
});

describe("runContentResearch", () => {
  const ok = <T>(data: T): ProviderResult<T> => ({ ok: true, data, fromCache: false, fetchedAt: NOW.toISOString() });
  const serp = (overrides: Partial<SerpApiClient> = {}): SerpApiClient => ({
    googleSearch: async () => ({ ok: false, kind: "not_configured", message: "" }),
    adLibrary: async () => ({ ok: false, kind: "not_configured", message: "" }),
    resolveLocation: async () => null,
    trends: async (_q, _m, range) => ok(parseTrends(fixture(range === "today 12-m" ? "trends-12m" : "trends-7d"))),
    trendsRelated: async () => ok(parseTrendsRelated(fixture("trends-related"))),
    youtube: async () => ok(parseYouTube(fixture("youtube"))),
    news: async () => ok(parseNews(fixture("news"))),
    autocomplete: async () => ok(parseAutocomplete(fixture("autocomplete"))),
    ...overrides,
  });
  const market = marketFromStored({ country: "India", searchLocation: "India" });

  test("all four tools, with Loopy's hooks and captions", async () => {
    const intel = await runContentResearch({
      profile: profile({ category: "smartphones and electronics" }),
      market,
      deps: {
        serp: serp(),
        now: () => NOW,
        writeIdeas: async (input) => ({ hooks: input.headlines.map((_, i) => ({ n: i + 1, hook: `Post about story ${i + 1}` })), captions: ["One", "Two", "Three"] }),
      },
    });
    assert.equal(intel.term, "smartphones");
    assert.equal(intel.timeZone, IST);
    assert.ok(intel.bestTime?.bestWindow);
    assert.equal(intel.videos.length, 6);
    assert.ok(intel.news.length > 0 && intel.news.every((n) => n.hook));
    assert.ok(intel.keywords.length > 0);
    assert.equal(intel.hashtags[0], "#smartphones");
    assert.deepEqual(intel.captions, ["One", "Two", "Three"]);
    assert.deepEqual(intel.limitations, []);
  });

  test("a failed search empties its tool, with a note, and the rest still work", async () => {
    const intel = await runContentResearch({
      profile: profile({ category: "smartphones" }),
      market,
      deps: {
        serp: serp({ youtube: async () => ({ ok: false, kind: "quota", message: "out" }) }),
        now: () => NOW,
        writeIdeas: async () => {
          throw new Error("model down");
        },
      },
    });
    assert.deepEqual(intel.videos, []);
    assert.ok(intel.bestTime);
    assert.ok(intel.news.length > 0);
    assert.ok(intel.limitations.some((l) => /YouTube search out of monthly searches/.test(l)));
    assert.ok(intel.limitations.some((l) => /couldn't write/.test(l)));
  });
});

describe("Loopy's research brief", () => {
  test("carries the content signals: hours, months, news, keywords, videos", async () => {
    const { buildResearchBrief } = await import("../../ai/research-brief");
    const content = await runContentResearch({
      profile: profile({ category: "smartphones" }),
      market: marketFromStored({ country: "India", searchLocation: "India" }),
      deps: {
        serp: {
          googleSearch: async () => ({ ok: false, kind: "not_configured", message: "" }),
          adLibrary: async () => ({ ok: false, kind: "not_configured", message: "" }),
          resolveLocation: async () => null,
          trends: async (_q, _m, range) => ({ ok: true, data: parseTrends(fixture(range === "today 12-m" ? "trends-12m" : "trends-7d")), fromCache: false, fetchedAt: NOW.toISOString() }),
          trendsRelated: async () => ({ ok: true, data: parseTrendsRelated(fixture("trends-related")), fromCache: false, fetchedAt: NOW.toISOString() }),
          youtube: async () => ({ ok: true, data: parseYouTube(fixture("youtube")), fromCache: false, fetchedAt: NOW.toISOString() }),
          news: async () => ({ ok: true, data: parseNews(fixture("news")), fromCache: false, fetchedAt: NOW.toISOString() }),
          autocomplete: async () => ({ ok: true, data: parseAutocomplete(fixture("autocomplete")), fromCache: false, fetchedAt: NOW.toISOString() }),
        },
        now: () => NOW,
        writeIdeas: async () => ({ hooks: [], captions: [] }),
      },
    });
    const brief = buildResearchBrief({ company: { name: "Apple", website: "https://apple.com" }, competitors: [], market: { contentIntel: content } as never });
    assert.match(brief, /CONTENT SIGNALS for "smartphones" in India/);
    assert.match(brief, /searches peak 6 PM to 9 PM \(Asia\/Kolkata\)/);
    assert.match(brief, /busiest in Feb and Aug/);
    assert.match(brief, /Recent news:/);
    assert.match(brief, /What people search: "vivo smartphones" \(rising \+140%\)/);
    assert.match(brief, /Videos getting views on YouTube now/);
  });
});
