/**
 * Em dashes (—) and en dashes (–) are the best-known tell of machine-written text, and the founder
 * asked for none in the analysis. The prompts already ask the model not to use them; this removes
 * any that slip through, and the ones in analyses written before that rule.
 *
 * Works line by line so markdown (headings, lists, "---" rules) keeps its shape:
 * - "**MON** — Post a reel" and "## Day 1 — Launch" become "**MON:** Post a reel" and "## Day 1: Launch"
 * - a short list label ("- Instagram Reels — post three a week") takes a colon too
 * - number ranges ("2–3 posts", "₹500–₹800") take a plain hyphen
 * - every other dash becomes a comma ("the hook — the first 3 seconds — matters")
 */

import type { ChatMessage } from "./types";

const HAS_DASH = /[—–]| -- /;
const DASH = "(?:[\\u2014\\u2013]|(?<= )--(?= ))";

const LIST_MARKER = /^(\s*(?:[-*•]|\d+[.)])\s+)/;

function tidy(line: string): string {
  return line
    .replace(/,\s*([,.;:!?)])/g, "$1")
    .replace(/([(:])\s*,\s*/g, "$1 ")
    .replace(/\(\s+/g, "(")
    .replace(/(\S) {2,}(?=\S)/g, "$1 ")
    .replace(/\s+,/g, ",")
    .replace(/,(\S)/g, (m, next: string) => (/[\d"”'’]/.test(next) ? m : `, ${next}`));
}

function stripLine(line: string): string {
  if (!HAS_DASH.test(line)) return line;
  let out = line;

  // Number and price ranges: "2–3", "2024 — 2025", "₹500–₹800"
  out = out.replace(new RegExp(`(\\d)\\s*${DASH}\\s*([₹$€£]?\\d)`, "g"), "$1-$2");

  // A dash used as a bullet
  out = out.replace(new RegExp(`^(\\s*)${DASH}\\s+`), "$1- ");

  // Headings: the first dash introduces what follows
  if (/^\s*#{1,6}\s/.test(out)) {
    out = out.replace(new RegExp(`\\s*${DASH}\\s*`), ": ");
  }

  // A bold label at the start of a line or list item: "**MON** — Post" → "**MON:** Post"
  out = out.replace(
    new RegExp(`^(\\s*(?:(?:[-*•]|\\d+[.)])\\s+)?)\\*\\*([^*\\n]+?)\\*\\*\\s*${DASH}\\s*`),
    (_m, lead: string, label: string) => (/[:.?!]$/.test(label.trim()) ? `${lead}**${label}** ` : `${lead}**${label.trim()}:** `)
  );

  // A short label at the start of a list item: "- Instagram Reels — post three a week"
  const marker = out.match(LIST_MARKER);
  if (marker) {
    const rest = out.slice(marker[1].length);
    const m = rest.match(new RegExp(`^([^\\u2014\\u2013.!?;:]{1,40}?)\\s+${DASH}\\s+`));
    if (m && m[1].trim().split(/\s+/).length <= 4) {
      out = marker[1] + `${m[1].trim()}: ` + rest.slice(m[0].length);
    }
  }

  // A dash closing a line introduces what comes next
  out = out.replace(new RegExp(`\\s*${DASH}\\s*$`), ":");
  // Any other dash: a comma
  out = out.replace(new RegExp(`\\s*${DASH}\\s*`, "g"), ", ");
  // A line that now starts with a comma (it opened with a dash that wasn't a bullet)
  out = out.replace(/^(\s*),\s*/, "$1");

  return tidy(out);
}

/** The text with its em and en dashes replaced by ordinary punctuation. */
export function stripDashes(text: string): string;
export function stripDashes(text: string | undefined): string | undefined;
export function stripDashes(text: string | undefined): string | undefined {
  if (!text || !HAS_DASH.test(text)) return text;
  return text.split("\n").map(stripLine).join("\n");
}

/** A Loopy answer with the dashes taken out of everything the reader sees. */
export function humanizeMessage(message: ChatMessage): ChatMessage {
  if (message.role !== "assistant") return message;
  return {
    ...message,
    content: stripDashes(message.content),
    followUpQuestions: message.followUpQuestions?.map((q) => stripDashes(q)),
    evidence: message.evidence?.map((e) => ({ ...e, insight: stripDashes(e.insight) })),
  };
}
