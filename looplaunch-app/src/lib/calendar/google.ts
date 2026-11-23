/**
 * Google OAuth and Google Calendar over plain HTTPS (no Google SDK).
 * Read-only: we ask for calendar.events.readonly and only ever list events.
 */

import { createHash, randomBytes } from "node:crypto";

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";
/** openid + email tell us which Google account was connected; the calendar scope reads events. */
export const GOOGLE_SCOPES = ["openid", "email", CALENDAR_SCOPE];

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export interface GoogleClient {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** Anything Google refused. `reason` is Google's own code, e.g. invalid_grant or SERVICE_DISABLED. */
export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason: string
  ) {
    super(message);
    this.name = "GoogleApiError";
  }

  /** The person has to connect again: the token was revoked or expired, or calendar access was taken away. */
  get needsReconnect(): boolean {
    return (
      this.reason === "invalid_grant" ||
      this.status === 401 ||
      this.reason === "insufficientPermissions" ||
      this.reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT"
    );
  }

  /** The Google Calendar API is switched off in the Google Cloud project: a setup problem, not the person's. */
  get apiDisabled(): boolean {
    return this.reason === "accessNotConfigured" || this.reason === "SERVICE_DISABLED";
  }
}

// ─── Starting the sign-in ───

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** PKCE: Google only hands out tokens to whoever also knows the verifier behind this hash. */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** Google's consent page. `prompt=consent` with offline access makes Google return a refresh token every time. */
export function buildAuthUrl(
  client: Pick<GoogleClient, "clientId" | "redirectUri">,
  options: { state: string; codeVerifier: string; loginHint?: string }
): string {
  const params = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "select_account consent",
    state: options.state,
    code_challenge: pkceChallenge(options.codeVerifier),
    code_challenge_method: "S256",
  });
  if (options.loginHint) params.set("login_hint", options.loginHint);
  return `${AUTH_URL}?${params.toString()}`;
}

// ─── Tokens ───

export interface GoogleTokens {
  accessToken: string;
  /** Only on the first exchange, and only with offline access */
  refreshToken?: string;
  /** Space-separated scopes the person actually granted (they can untick calendar access) */
  scope: string;
  idToken?: string;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

async function postToken(params: Record<string, string>): Promise<TokenResponse & { access_token: string }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !data.access_token) {
    const reason = data.error || `http_${res.status}`;
    throw new GoogleApiError(`Google token request failed: ${data.error_description || reason}`, res.status, reason);
  }
  return data as TokenResponse & { access_token: string };
}

/** Swap the one-time code from the consent page for tokens. */
export async function exchangeCode(client: GoogleClient, code: string, codeVerifier: string): Promise<GoogleTokens> {
  const data = await postToken({
    code,
    client_id: client.clientId,
    client_secret: client.clientSecret,
    redirect_uri: client.redirectUri,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });
  return { accessToken: data.access_token, refreshToken: data.refresh_token, scope: data.scope ?? "", idToken: data.id_token };
}

/** A fresh access token (they last an hour) from the stored refresh token. */
export async function refreshAccessToken(client: GoogleClient, refreshToken: string): Promise<string> {
  const data = await postToken({
    refresh_token: refreshToken,
    client_id: client.clientId,
    client_secret: client.clientSecret,
    grant_type: "refresh_token",
  });
  return data.access_token;
}

/** Tell Google to forget our access. True if Google accepted it (or the token was already dead). */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      cache: "no-store",
    });
    // 400 invalid_token: already revoked or expired, which is what we wanted anyway.
    return res.ok || res.status === 400;
  } catch {
    return false;
  }
}

export function hasCalendarScope(scope: string): boolean {
  return scope.split(/\s+/).includes(CALENDAR_SCOPE);
}

/**
 * The connected Google account's email, from the ID token. It came straight from Google's token
 * endpoint over HTTPS, so (per OpenID Connect) it needs no signature check here.
 */
export function emailFromIdToken(idToken: string | undefined): string | null {
  const payload = idToken?.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: unknown };
    return typeof claims.email === "string" ? claims.email : null;
  } catch {
    return null;
  }
}

// ─── Calendar ───

export interface CalendarEvent {
  status?: string;
  summary?: string;
  eventType?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  attendees?: { self?: boolean; responseStatus?: string }[];
}

interface CalendarErrorBody {
  error?: {
    message?: string;
    status?: string;
    errors?: { reason?: string }[];
    details?: { reason?: string }[];
  };
}

async function calendarGet<T>(accessToken: string, path: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`${CALENDAR_API}${path}?${new URLSearchParams(params).toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (res.ok) return (await res.json()) as T;

  const body = (await res.json().catch(() => ({}))) as CalendarErrorBody;
  const reason =
    body.error?.details?.find((d) => d.reason)?.reason || body.error?.errors?.[0]?.reason || body.error?.status || `http_${res.status}`;
  throw new GoogleApiError(`Google Calendar request failed: ${body.error?.message || reason}`, res.status, reason);
}

/** The primary calendar's time zone, e.g. "Asia/Kolkata". */
export async function fetchCalendarTimeZone(accessToken: string): Promise<string | null> {
  const data = await calendarGet<{ timeZone?: string }>(accessToken, "/calendars/primary/events", {
    maxResults: "1",
    fields: "timeZone",
  });
  return data.timeZone || null;
}

/**
 * Events on the primary calendar that overlap [timeMin, timeMax), with recurring events expanded.
 * Only the fields the agenda needs are requested: title, times, status, type and the person's own RSVP.
 */
export async function fetchEventsBetween(accessToken: string, timeMin: string, timeMax: string, timeZone: string): Promise<CalendarEvent[]> {
  const data = await calendarGet<{ items?: CalendarEvent[] }>(accessToken, "/calendars/primary/events", {
    timeMin,
    timeMax,
    timeZone,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
    fields: "items(status,summary,eventType,start(date,dateTime),end(date,dateTime),attendees(self,responseStatus))",
  });
  return data.items ?? [];
}
