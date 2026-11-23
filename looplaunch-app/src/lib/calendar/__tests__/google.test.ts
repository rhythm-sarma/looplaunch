import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, test } from "node:test";
import { decryptToken, encryptToken, tokenKeyFromEnv } from "../crypto";
import { CALENDAR_SCOPE, GoogleApiError, buildAuthUrl, emailFromIdToken, hasCalendarScope, pkceChallenge } from "../google";
import { decodeOAuthCookie, encodeOAuthCookie, sameState } from "../oauth-cookie";

describe("Google consent link", () => {
  test("asks for read-only calendar access, offline, with PKCE", () => {
    const url = new URL(
      buildAuthUrl(
        { clientId: "client-123.apps.googleusercontent.com", redirectUri: "http://localhost:3000/oauth/callback" },
        { state: "state-abc", codeVerifier: "verifier-xyz", loginHint: "work@looplaunch.co" }
      )
    );
    assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
    const q = url.searchParams;
    assert.equal(q.get("client_id"), "client-123.apps.googleusercontent.com");
    assert.equal(q.get("redirect_uri"), "http://localhost:3000/oauth/callback");
    assert.equal(q.get("response_type"), "code");
    assert.equal(q.get("scope"), `openid email ${CALENDAR_SCOPE}`);
    assert.equal(q.get("access_type"), "offline");
    assert.match(q.get("prompt") ?? "", /consent/);
    assert.equal(q.get("state"), "state-abc");
    assert.equal(q.get("code_challenge"), pkceChallenge("verifier-xyz"));
    assert.equal(q.get("code_challenge_method"), "S256");
    assert.equal(q.get("login_hint"), "work@looplaunch.co");
  });

  test("PKCE challenge matches the RFC 7636 example", () => {
    assert.equal(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  test("knows whether calendar access was granted (people can untick it)", () => {
    assert.equal(hasCalendarScope(`openid https://www.googleapis.com/auth/userinfo.email ${CALENDAR_SCOPE}`), true);
    assert.equal(hasCalendarScope("openid https://www.googleapis.com/auth/userinfo.email"), false);
    assert.equal(hasCalendarScope(""), false);
  });

  test("reads the connected account's email from the ID token", () => {
    const payload = Buffer.from(JSON.stringify({ email: "rhythm@gmail.com", sub: "1" })).toString("base64url");
    assert.equal(emailFromIdToken(`header.${payload}.signature`), "rhythm@gmail.com");
    assert.equal(emailFromIdToken(undefined), null);
    assert.equal(emailFromIdToken("not-a-jwt"), null);
    assert.equal(emailFromIdToken("a.@@@.c"), null);
  });

  test("errors say whether the person must reconnect or the API is switched off", () => {
    assert.equal(new GoogleApiError("x", 400, "invalid_grant").needsReconnect, true);
    assert.equal(new GoogleApiError("x", 401, "authError").needsReconnect, true);
    assert.equal(new GoogleApiError("x", 403, "insufficientPermissions").needsReconnect, true);
    assert.equal(new GoogleApiError("x", 403, "SERVICE_DISABLED").needsReconnect, false);
    assert.equal(new GoogleApiError("x", 403, "SERVICE_DISABLED").apiDisabled, true);
    assert.equal(new GoogleApiError("x", 500, "backendError").needsReconnect, false);
  });
});

describe("stored tokens", () => {
  const key = randomBytes(32);

  test("encrypt and decrypt round trip, with a fresh IV each time", () => {
    const a = encryptToken("1//refresh-token", key);
    const b = encryptToken("1//refresh-token", key);
    assert.notEqual(a, b);
    assert.match(a, /^v1:/);
    assert.ok(!a.includes("refresh-token"));
    assert.equal(decryptToken(a, key), "1//refresh-token");
  });

  test("a changed value or another key is refused", () => {
    const stored = encryptToken("1//refresh-token", key);
    const tampered = stored.slice(0, -2) + (stored.endsWith("A") ? "BB" : "AA");
    assert.throws(() => decryptToken(tampered, key));
    assert.throws(() => decryptToken(stored, randomBytes(32)));
    assert.throws(() => decryptToken("plain-token", key));
  });

  test("the key must be 32 bytes of base64", () => {
    assert.equal(tokenKeyFromEnv(undefined), null);
    assert.equal(tokenKeyFromEnv(""), null);
    assert.equal(tokenKeyFromEnv(randomBytes(16).toString("base64")), null);
    assert.equal(tokenKeyFromEnv(` ${key.toString("base64")}\n`)?.equals(key), true);
  });
});

describe("sign-in cookie", () => {
  test("round trips and rejects anything else", () => {
    const value = { state: "s", verifier: "v", userId: "u" };
    assert.deepEqual(decodeOAuthCookie(encodeOAuthCookie(value)), value);
    assert.equal(decodeOAuthCookie(undefined), null);
    assert.equal(decodeOAuthCookie("garbage"), null);
    assert.equal(decodeOAuthCookie(Buffer.from('{"state":1}').toString("base64url")), null);
  });

  test("state comparison", () => {
    assert.equal(sameState("abc", "abc"), true);
    assert.equal(sameState("abc", "abd"), false);
    assert.equal(sameState("abc", "abcd"), false);
  });
});
