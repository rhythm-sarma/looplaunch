/**
 * GET /oauth/callback
 *
 * Google sends people back here after the Google Calendar consent page. This exact URL is the
 * redirect URI registered on the OAuth client in Google Cloud (GOOGLE_CALENDAR_REDIRECT_URI).
 * Checks the state, stores the connection, and returns to Settings with ?calendar=<result>.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getSignedInClaims } from "@/lib/auth/supabase-server";
import { GoogleApiError } from "@/lib/calendar/google";
import { OAUTH_COOKIE, decodeOAuthCookie, oauthCookieOptions, sameState } from "@/lib/calendar/oauth-cookie";
import { connectWithCode } from "@/lib/calendar/service";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const finish = (result: string) => {
    const response = NextResponse.redirect(new URL(`/profile?calendar=${result}#settings-calendar`, origin));
    response.cookies.set(OAUTH_COOKIE, "", oauthCookieOptions(0));
    return response;
  };

  // Cancelled on Google's page, or Google refused (e.g. the account isn't a test user yet).
  const googleError = searchParams.get("error");
  if (googleError) return finish(googleError === "access_denied" ? "denied" : "error");

  const saved = decodeOAuthCookie(request.cookies.get(OAUTH_COOKIE)?.value);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!saved || !code || !state || !sameState(saved.state, state)) return finish("expired");

  // Only the person who started the connection can finish it.
  const claims = await getSignedInClaims();
  if (!claims || claims.userId !== saved.userId) return finish("expired");

  try {
    return finish(await connectWithCode(claims.userId, code, saved.verifier));
  } catch (error) {
    const detail = error instanceof GoogleApiError ? `${error.reason}: ${error.message}` : String(error);
    console.error("[Calendar] Finishing the Google connection failed:", detail);
    return finish("error");
  }
}
