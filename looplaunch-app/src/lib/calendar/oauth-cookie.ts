/**
 * The short-lived cookie that carries a Google Calendar connection from /api/calendar/connect to
 * /oauth/callback: the random state (so nobody can trick a browser into finishing someone else's
 * sign-in), the PKCE verifier, and who started it.
 */

import { timingSafeEqual } from "node:crypto";

export const OAUTH_COOKIE = "ll_gcal_oauth";

export interface OAuthCookie {
  state: string;
  verifier: string;
  userId: string;
}

export function encodeOAuthCookie(value: OAuthCookie): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeOAuthCookie(raw: string | undefined): OAuthCookie | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<OAuthCookie>;
    if (typeof value.state === "string" && typeof value.verifier === "string" && typeof value.userId === "string") {
      return { state: value.state, verifier: value.verifier, userId: value.userId };
    }
  } catch {
    // Not ours, or damaged.
  }
  return null;
}

/** Ten minutes is plenty to click through Google's consent page. Lax so it survives the redirect back from Google. */
export function oauthCookieOptions(maxAge = 600) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function sameState(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
