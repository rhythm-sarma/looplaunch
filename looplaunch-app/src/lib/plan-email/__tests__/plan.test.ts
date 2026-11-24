import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { cleanGuide, latestPlan, planEmailHtml, planEmailSubject, planEmailText, planSteps } from "../plan";

const STRATEGY = `Since your #1 headache is **not knowing what to post**, let's solve this once and for all.

## 7 DAYS

**MON:** Audit your current product lineup and pick 3 hero ecosystem pairings (e.g., iPhone + Apple Watch + AirPods).
**TUE:** Script and film 2 Instagram Reels demonstrating the 'Ecosystem Magic' with zero tech jargon.
**WED:** Launch a localized Instagram campaign targeting young professionals in top Indian metros.
**THU:** Publish an unboxing and setup Reel focused on zero-friction onboarding.
**FRI:** Set up a location-tagged 'Visit Our Store' Instagram story series.
**SAT:** Film and schedule 2 YouTube Shorts addressing common buyer comparisons.
**SUN:** Review organic engagement metrics, respond to DMs about pricing in ₹, and refine next week's calendar.

## The full strategy

**Sun-dried** comparisons don't count as a day.
MON: this later line mustn't replace Monday's step.`;

describe("Finding a plan's daily steps", () => {
  test("reads the 7 DAYS section in day order, without markdown", () => {
    const steps = planSteps(STRATEGY);
    assert.equal(steps.length, 7);
    assert.equal(steps[0], "Audit your current product lineup and pick 3 hero ecosystem pairings (e.g., iPhone + Apple Watch + AirPods).");
    assert.equal(steps[6], "Review organic engagement metrics, respond to DMs about pricing in ₹, and refine next week's calendar.");
    assert.ok(steps.every((s) => !s.includes("**")));
  });

  test("ignores day-like lines after the 7 DAYS section", () => {
    assert.ok(!planSteps(STRATEGY).some((s) => s.includes("mustn't replace")));
  });

  test("understands other ways of writing the days", () => {
    const steps = planSteps("- Monday: Post a reel\n- **Tue** - Reply to every DM\n3. Wednesday: Go live\n**THURS:** Rest");
    assert.deepEqual(steps, ["Post a reel", "Reply to every DM", "Go live", "Rest"]);
  });

  test("puts days back in order and keeps each day's first step", () => {
    assert.deepEqual(planSteps("WED: c\nMON: a\nTUE: b\nMON: again"), ["a", "b", "c"]);
  });

  test("doesn't mistake ordinary sentences for days", () => {
    assert.deepEqual(planSteps("Monthly goal: 40 sales\nSundays are quiet\nSaturation is high"), []);
  });

  test("turns links into their text", () => {
    assert.deepEqual(planSteps("MON: Read [this guide](https://example.com) first"), ["Read this guide first"]);
  });
});

describe("The newest plan in a conversation", () => {
  test("skips answers without a day-by-day plan", () => {
    const messages = [
      { role: "user", content: "Build a prioritized 7-Day execution strategy" },
      { role: "assistant", content: STRATEGY },
      { role: "user", content: "What hashtags should I use?" },
      { role: "assistant", content: "Use #iphone and #apple." },
    ];
    const plan = latestPlan(messages);
    assert.equal(plan?.index, 1);
    assert.equal(plan?.steps.length, 7);
  });

  test("needs at least three steps", () => {
    assert.equal(latestPlan([{ role: "assistant", content: "MON: one\nTUE: two" }]), null);
  });
});

describe("The plan email", () => {
  const input = {
    company: "Apple",
    steps: planSteps(STRATEGY),
    stepIndex: 1,
    planUrl: "https://looplaunch.co/intelligence?session=ll_abc",
    manageUrl: "https://looplaunch.co/profile#settings-plan-email",
  };

  test("names the day in the subject and keeps it short", () => {
    const subject = planEmailSubject(input);
    assert.ok(subject.startsWith("Day 2 of 7: Script and film 2 Instagram Reels"));
    assert.ok(subject.length <= 82);
  });

  test("says today's step and tomorrow's, with both links", () => {
    const text = planEmailText(input);
    assert.ok(text.includes("Today: Script and film 2 Instagram Reels"));
    assert.ok(text.includes("Tomorrow: Launch a localized Instagram campaign"));
    assert.ok(text.includes(input.planUrl) && text.includes(input.manageUrl));
  });

  test("closes the plan on the last day", () => {
    const text = planEmailText({ ...input, stepIndex: 6 });
    assert.ok(text.startsWith("Day 7 of 7"));
    assert.ok(text.includes("This was the last step"));
    assert.ok(!text.includes("Tomorrow"));
  });

  test("escapes the step text in the HTML", () => {
    const html = planEmailHtml({ ...input, steps: ["Post <b>now</b> & then", "b", "c"], stepIndex: 0 });
    assert.ok(html.includes("Post &lt;b&gt;now&lt;/b&gt; &amp; then"));
    assert.ok(!html.includes("<b>now</b>"));
  });

  test("uses no em or en dashes", () => {
    for (const out of [planEmailText(input), planEmailHtml(input), planEmailSubject(input)]) assert.ok(!/[—–]/.test(out));
  });
});

describe("day guides", () => {
  const guide = {
    goal: "Buyers trust what they see working.",
    tasks: ["Film the pairing <live>", "Post it by 7 PM"],
    example: { label: "Hook", text: "Line one\nLine two" },
    time: "About 1 hour",
    doneWhen: "Two reels are in your drafts.",
    tip: "Keep it under 20 seconds.",
  };

  test("cleanGuide keeps a good guide and drops an empty one", () => {
    assert.deepEqual(cleanGuide(guide), guide);
    assert.equal(cleanGuide({ goal: "x", tasks: [] }), null);
    assert.equal(cleanGuide("nope"), null);
    assert.equal(cleanGuide({ goal: "x", tasks: ["a"], example: { label: "", text: "t" } })?.example, undefined);
  });

  test("the email shows the guide, escaped, and still works without one", () => {
    const input = { company: "Apple", steps: ["Audit", "Film", "Post"], stepIndex: 1, planUrl: "https://x/p", manageUrl: "https://x/m" };
    const html = planEmailHtml({ ...input, guide });
    assert.match(html, /Do this today/);
    assert.match(html, /Film the pairing &lt;live&gt;/);
    assert.match(html, /About 1 hour/);
    assert.match(html, /Done when:/);
    const text = planEmailText({ ...input, guide });
    assert.match(text, /1\. Film the pairing <live>\n2\. Post it by 7 PM/);
    assert.match(text, /Hook:\nLine one\nLine two/);
    assert.doesNotMatch(planEmailHtml(input), /Do this today/);
  });
});
