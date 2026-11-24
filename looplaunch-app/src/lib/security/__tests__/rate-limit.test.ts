import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { clientAddress, rejectIfTooMany, takeToken } from "../rate-limit";

describe("takeToken", () => {
  test("allows up to the limit in the window, then refuses with a wait", () => {
    const limit = { max: 3, windowMs: 60_000 };
    const key = `t1:${Math.random()}`;
    const t0 = 1_000_000;
    assert.deepEqual(takeToken(key, limit, t0), { ok: true });
    assert.deepEqual(takeToken(key, limit, t0 + 1), { ok: true });
    assert.deepEqual(takeToken(key, limit, t0 + 2), { ok: true });
    const refused = takeToken(key, limit, t0 + 3);
    assert.equal(refused.ok, false);
    assert.equal(!refused.ok && refused.retryAfterSec, 60);
  });

  test("a refused request isn't counted, and the window slides", () => {
    const limit = { max: 2, windowMs: 10_000 };
    const key = `t2:${Math.random()}`;
    takeToken(key, limit, 0);
    takeToken(key, limit, 5_000);
    assert.equal(takeToken(key, limit, 6_000).ok, false);
    assert.equal(takeToken(key, limit, 7_000).ok, false);
    // The first request has left the window: one more is allowed.
    assert.equal(takeToken(key, limit, 10_001).ok, true);
    assert.equal(takeToken(key, limit, 10_002).ok, false);
  });

  test("different people have separate counts", () => {
    const limit = { max: 1, windowMs: 60_000 };
    const run = Math.random();
    assert.equal(takeToken(`t3:${run}:a`, limit).ok, true);
    assert.equal(takeToken(`t3:${run}:b`, limit).ok, true);
    assert.equal(takeToken(`t3:${run}:a`, limit).ok, false);
  });
});

describe("clientAddress", () => {
  const req = (headers: Record<string, string>) => new Request("https://looplaunch.co/api/x", { headers });

  test("uses Cloudflare's address, which a visitor can't fake", () => {
    assert.equal(clientAddress(req({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "1.2.3.4, 203.0.113.7" })), "203.0.113.7");
  });

  test("without Cloudflare, ignores the first X-Forwarded-For entry (the client writes it)", () => {
    assert.equal(clientAddress(req({ "x-forwarded-for": "6.6.6.6, 198.51.100.9" })), "198.51.100.9");
  });

  test("falls back to 'unknown'", () => {
    assert.equal(clientAddress(req({})), "unknown");
  });
});

describe("rejectIfTooMany", () => {
  test("answers 429 with Retry-After once over the limit, per signed-in user", async () => {
    const request = new Request("https://looplaunch.co/api/intelligence/gather", { method: "POST", headers: { "cf-connecting-ip": "203.0.113.50" } });
    const userId = `user-${Math.random()}`;
    let last = null;
    for (let i = 0; i < 11; i++) last = rejectIfTooMany(request, "gather", userId);
    assert.ok(last);
    assert.equal(last.status, 429);
    assert.ok(Number(last.headers.get("Retry-After")) > 0);
    assert.match((await last.json()).error, /try again in \d+ minute/);
    // Another person isn't affected.
    assert.equal(rejectIfTooMany(request, "gather", `user-${Math.random()}`), null);
  });
});
