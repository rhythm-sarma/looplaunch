import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { humanizeMessage, stripDashes } from "../humanize";

describe("stripDashes", () => {
  test("day-by-day lines take a colon after the bold day", () => {
    assert.equal(stripDashes("**MON** — Post your first reel"), "**MON:** Post your first reel");
    assert.equal(stripDashes("**TUE**—Reply to every DM"), "**TUE:** Reply to every DM");
    assert.equal(stripDashes("- **Primary KPI:** — Cost per sale"), "- **Primary KPI:** Cost per sale");
  });

  test("headings take a colon", () => {
    assert.equal(stripDashes("## Day 1 — Launch"), "## Day 1: Launch");
    assert.equal(stripDashes("### STOP — START"), "### STOP: START");
  });

  test("short list labels take a colon, longer clauses a comma", () => {
    assert.equal(stripDashes("- Instagram Reels — post three a week"), "- Instagram Reels: post three a week");
    assert.equal(
      stripDashes("- Your buyers already compare prices on Amazon — so show yours first"),
      "- Your buyers already compare prices on Amazon, so show yours first"
    );
  });

  test("dashes in sentences become commas", () => {
    assert.equal(stripDashes("The hook — the first 3 seconds — matters most."), "The hook, the first 3 seconds, matters most.");
    assert.equal(stripDashes("This works – but only if you post daily."), "This works, but only if you post daily.");
    assert.equal(stripDashes("Here's the plan —"), "Here's the plan:");
  });

  test("ranges take a hyphen", () => {
    assert.equal(stripDashes("Post 2–3 times a week"), "Post 2-3 times a week");
    assert.equal(stripDashes("Price it at ₹500 — ₹800"), "Price it at ₹500-₹800");
  });

  test("markdown structure and plain text are left alone", () => {
    const md = "# Plan\n\n---\n\n- one\n- two\n\n1. first";
    assert.equal(stripDashes(md), md);
    assert.equal(stripDashes("well-known, 1,000 buyers"), "well-known, 1,000 buyers");
    assert.equal(stripDashes(""), "");
    assert.equal(stripDashes(undefined), undefined);
  });

  test("a spaced hyphen standing in for a dash is treated as one", () => {
    assert.equal(stripDashes("**MON** - Post your first reel"), "**MON:** Post your first reel");
    assert.equal(stripDashes("- Instagram Reels - post three a week"), "- Instagram Reels: post three a week");
    assert.equal(stripDashes("The hook - the first 3 seconds - matters most."), "The hook, the first 3 seconds, matters most.");
    assert.equal(stripDashes("Post 2 - 3 times a week"), "Post 2-3 times a week");
    assert.equal(stripDashes("Keep it short -- one line."), "Keep it short, one line.");
  });

  test("bullets and hyphenated words keep their hyphens", () => {
    const md = "**STOP**\n- Posting random spec sheets\n  - nested point\n- Guessing day-to-day";
    assert.equal(stripDashes(md), md);
    assert.equal(stripDashes("  - Reels — post daily"), "  - Reels: post daily");
    assert.equal(stripDashes("— Post a reel"), "- Post a reel");
  });

  test("no dash survives", () => {
    const text = "**MON** — a\n— b\nc — d – e\n## f — g\n- h — i\n3–4\nj ‒ k ― l\nm—n\no - p";
    const out = stripDashes(text);
    assert.doesNotMatch(out, /[—–‒―]/);
    assert.doesNotMatch(out, / - /);
  });
});

describe("humanizeMessage", () => {
  test("cleans the answer, follow-ups and evidence, and leaves questions alone", () => {
    const answer = humanizeMessage({
      id: "a",
      role: "assistant",
      content: "Start here — today.",
      timestamp: "",
      followUpQuestions: ["What next — scripts?"],
      evidence: [{ source: "x", insight: "Buyers ask — a lot" }],
    });
    assert.equal(answer.content, "Start here, today.");
    assert.equal(answer.followUpQuestions?.[0], "What next, scripts?");
    assert.equal(answer.evidence?.[0].insight, "Buyers ask, a lot");

    const question = { id: "q", role: "user" as const, content: "A — B", timestamp: "" };
    assert.equal(humanizeMessage(question), question);
  });
});
