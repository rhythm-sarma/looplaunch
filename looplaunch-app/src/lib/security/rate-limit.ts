/**
 * Request limits for the routes that cost money (SerpApi, Gemini, Tavily) or send email, and
 * for the public waitlist form, so one person or script can't run up the bill or flood a table.
 *
 * Kept in memory: Loop Launch runs as one server, and a restart only resets the counts.
 * Each limit counts requests in a sliding window, per signed-in user when there is one, and
 * per network address otherwise.
 */

import { NextResponse } from "next/server";

export interface Limit {
  /** Requests allowed in the window */
  max: number;
  windowMs: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** The limits, per route. Generous for real use, tight enough to stop a loop or a script. */
export const LIMITS = {
  /** A new analysis: about 10 searches and 7 AI calls each */
  gather: { max: 10, windowMs: HOUR },
  /** A question to Loopy */
  ask: { max: 40, windowMs: 10 * MINUTE },
  /** A quick answer to a buyer question in Search intel */
  quickAnswer: { max: 60, windowMs: 10 * MINUTE },
  /** The ☰ menu's content tools (6 searches when an analysis doesn't have them yet) */
  content: { max: 15, windowMs: HOUR },
  /** A pitch deck upload (read on the server) */
  deck: { max: 15, windowMs: HOUR },
  /** Starting daily emails or sending a test agenda: each sends an email */
  email: { max: 10, windowMs: HOUR },
  /** The public waitlist form */
  waitlist: { max: 5, windowMs: MINUTE },
} satisfies Record<string, Limit>;

type Store = Map<string, number[]>;
const state = globalThis as unknown as { __rateLimits?: Store; __rateLimitSweep?: number };
const hits: Store = (state.__rateLimits ??= new Map());

/** Forget entries nobody has used for an hour, so the map can't grow without end. */
function sweep(now: number) {
  if (now - (state.__rateLimitSweep ?? 0) < 5 * MINUTE) return;
  state.__rateLimitSweep = now;
  for (const [key, times] of hits) {
    if (!times.length || now - times[times.length - 1] > HOUR) hits.delete(key);
  }
}

/**
 * Records one request for `key` and says whether it's over the limit, with how long until the
 * next one is allowed. A refused request isn't counted, so waiting always works.
 */
export function takeToken(key: string, limit: Limit, now = Date.now()): { ok: true } | { ok: false; retryAfterSec: number } {
  sweep(now);
  const recent = (hits.get(key) ?? []).filter((t) => now - t < limit.windowMs);
  if (recent.length >= limit.max) {
    hits.set(key, recent);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((recent[0] + limit.windowMs - now) / 1000)) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true };
}

/**
 * The visitor's network address. Cloudflare sits in front of looplaunch.co and sets
 * CF-Connecting-IP itself (a visitor can't fake it); X-Forwarded-For's first entry is whatever
 * the client sent, so it's only a last resort.
 */
export function clientAddress(request: Request): string {
  const h = request.headers;
  return (
    h.get("cf-connecting-ip")?.trim() ||
    h.get("true-client-ip")?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",").pop()?.trim() ||
    "unknown"
  );
}

/**
 * For a route handler: a 429 response when this user (or, signed out, this address) is over
 * the route's limit, or null to carry on.
 */
export function rejectIfTooMany(request: Request, route: keyof typeof LIMITS, userId?: string | null): NextResponse | null {
  const who = userId ? `user:${userId}` : `ip:${clientAddress(request)}`;
  const result = takeToken(`${route}:${who}`, LIMITS[route]);
  if (result.ok) return null;
  const minutes = Math.ceil(result.retryAfterSec / 60);
  return NextResponse.json(
    { error: `That's a lot of requests in a short time. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } }
  );
}
