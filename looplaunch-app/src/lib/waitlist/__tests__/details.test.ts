import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { INDUSTRY_OPTIONS, brandPlatformOf, cleanBrandLink, cleanIndustry, cleanRole, cleanWhatsapp, parseDetails } from "../details";
import { MissingDetailsError, createMemoryStore, joinWaitlist } from "../board";

describe("waitlist details", () => {
  test("a WhatsApp number becomes + and digits; ten digits alone are an Indian mobile", () => {
    assert.equal(cleanWhatsapp("+91 98765 43210"), "+919876543210");
    assert.equal(cleanWhatsapp("98765-43210"), "+919876543210");
    assert.equal(cleanWhatsapp("098765 43210"), "+919876543210");
    assert.equal(cleanWhatsapp("0091 98765 43210"), "+919876543210");
    assert.equal(cleanWhatsapp("919876543210"), "+919876543210");
    assert.equal(cleanWhatsapp("+1 (415) 555-0100"), "+14155550100");
    assert.equal(cleanWhatsapp("+44 7700 900123"), "+447700900123");
    // Optional: nothing typed is fine.
    assert.equal(cleanWhatsapp(""), "");
    assert.equal(cleanWhatsapp("   "), "");
    assert.equal(cleanWhatsapp(undefined), "");
    // Not a number.
    assert.equal(cleanWhatsapp("call me"), null);
    assert.equal(cleanWhatsapp("12345"), null);
    assert.equal(cleanWhatsapp("+0 98765 43210"), null);
    assert.equal(cleanWhatsapp("+91 98765 43210 ext 5"), null);
    assert.equal(cleanWhatsapp("+1234567890123456"), null);
    assert.equal(cleanWhatsapp(9876543210), null);
  });

  test("an industry is one of the options exactly, or nothing", () => {
    for (const option of INDUSTRY_OPTIONS) assert.equal(cleanIndustry(option), option);
    assert.equal(cleanIndustry("fashion"), null);
    assert.equal(cleanIndustry(""), null);
    assert.equal(cleanIndustry(undefined), null);
    assert.equal(cleanIndustry(["Fashion"]), null);
  });

  test("roles keep the person's words, but not a bare Other", () => {
    assert.equal(cleanRole("  Co-founder "), "Co-founder");
    assert.equal(cleanRole("Head   of\ngrowth"), "Head of growth");
    assert.equal(cleanRole("Other"), "");
    assert.equal(cleanRole(""), "");
    assert.equal(cleanRole(42), "");
    assert.equal(cleanRole("x".repeat(100)).length, 60);
  });

  test("a brand link is a web address or an @handle", () => {
    assert.deepEqual(cleanBrandLink("halfmoon.coffee"), { link: "halfmoon.coffee", platform: "website" });
    assert.deepEqual(cleanBrandLink("https://www.Instagram.com/halfmoon"), {
      link: "https://www.Instagram.com/halfmoon",
      platform: "instagram",
    });
    assert.equal(cleanBrandLink("@halfmoon")?.platform, "other");
    assert.equal(cleanBrandLink("halfmoon"), null, "a bare word isn't a place online");
    assert.equal(cleanBrandLink("not a link"), null);
    assert.equal(cleanBrandLink(""), null);
    assert.equal(cleanBrandLink("<script>alert(1)</script>"), null);
  });

  test("the platform comes from the first link", () => {
    assert.equal(brandPlatformOf("linkedin.com/company/halfmoon"), "linkedin");
    assert.equal(brandPlatformOf("in.linkedin.com/in/rhythm"), "linkedin");
    assert.equal(brandPlatformOf("fb.com/halfmoon"), "facebook");
    assert.equal(brandPlatformOf("x.com/halfmoon"), "x");
    assert.equal(brandPlatformOf("youtu.be/abc"), "youtube");
    assert.equal(brandPlatformOf("www.tiktok.com/@halfmoon"), "tiktok");
    assert.equal(brandPlatformOf("halfmoon.co.in/shop"), "website");
    assert.equal(cleanBrandLink("instagram.com/halfmoon, halfmoon.coffee")?.platform, "instagram");
    // A look-alike host is just a website.
    assert.equal(brandPlatformOf("notinstagram.com/halfmoon"), "website");
  });

  test("both details are needed", () => {
    assert.deepEqual(parseDetails("CEO", "halfmoon.coffee"), { role: "CEO", brandLink: "halfmoon.coffee", brandPlatform: "website" });
    assert.equal(parseDetails("", "halfmoon.coffee"), null);
    assert.equal(parseDetails("CEO", ""), null);
  });

  test("joining needs the details; saving a time later doesn't, and never overwrites them", async () => {
    const store = createMemoryStore();
    const base = { email: "a@x.com", firstName: "Asha", timeMs: null, source: null, userAgent: null };
    await assert.rejects(joinWaitlist(store, base), MissingDetailsError);

    await joinWaitlist(store, { ...base, details: { role: "CEO", brandLink: "asha.in", brandPlatform: "website" } });
    const again = await joinWaitlist(store, { ...base, timeMs: 2400 });
    assert.equal(again.alreadyJoined, true);
    assert.equal(again.bestMs, 2400);

    await joinWaitlist(store, { ...base, details: { role: "Intern", brandLink: "evil.com", brandPlatform: "website" } });
    const row = await store.find("a@x.com");
    assert.equal((row as unknown as { role: string }).role, "CEO");
    assert.equal((row as unknown as { brand_link: string }).brand_link, "asha.in");
  });
});
