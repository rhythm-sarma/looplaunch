/**
 * GET /api/calendar/connect
 *
 * The "Connect Google Calendar" button in Settings. Sends the signed-in person to Google's
 * consent page (read-only calendar access); Google sends them back to /oauth/callback.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getSignedInClaims } from "@/lib/auth/supabase-server";
import { canUseApp } from "@/lib/auth/team";
import { calendarFeatures, googleClient } from "@/lib/calendar/config";
import { buildAuthUrl, randomToken } from "@/lib/calendar/google";
import { OAUTH_COOKIE, encodeOAuthCookie, oauthCookieOptions } from "@/lib/calendar/oauth-cookie";

export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  const claims = await getSignedInClaims();
  if (!claims) return NextResponse.redirect(new URL("/login?next=/profile", origin));
  if (!canUseApp(claims.email)) return NextResponse.redirect(new URL("/", origin));

  const client = googleClient();
  if (!client || !calendarFeatures().connect) {
    return NextResponse.redirect(new URL("/profile?calendar=unavailable#settings-calendar", origin));
  }

  const state = randomToken();
  const verifier = randomToken(48);
  const response = NextResponse.redirect(buildAuthUrl(client, { state, codeVerifier: verifier, loginHint: claims.email }));
  response.cookies.set(OAUTH_COOKIE, encodeOAuthCookie({ state, verifier, userId: claims.userId }), oauthCookieOptions());
  return response;
}
