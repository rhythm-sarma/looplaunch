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
 * - a spaced hyphen standing in for a dash ("Reels - post daily") counts as one; hyphens inside
 *   words ("day-to-day") and list bullets ("- one") are left alone
 */

import type { ChatMessage } from "./types";

// Em dash, en dash, figure dash, horizontal bar, and a spaced "--" or " - " standing in for one.
const HAS_DASH = /[\u2014\u2013\u2012\u2015]| --? /;
const DASH = "(?:[\\u2014\\u2013\\u2012\\u2015]|(?<= )--?(?= ))";

const LIST_MARKER = /^(\s*(?:[-*•]|\d+[.)])\s+)/;
// A line opening with a dash used as a bullet: "— Post a reel"
const DASH_BULLET = /^(\s*)[\u2014\u2013\u2012\u2015]\s+/;

function tidy(line: string): string {
  return line
    .replace(/,\s*([,.;:!?)])/g, "$1")
    .replace(/([(:])\s*,\s*/g, "$1 ")
    .replace(/\(\s+/g, "(")
    .replace(/(\S) {2,}(?=\S)/g, "$1 ")
    .replace(/\s+,/g, ",")
    .replace(/,(\S)/g, (m, next: string) => (/[\d"”'’]/.test(next) ? m : `, ${next}`));
}

/** The dashes in one line of text that has no list marker at its start. */
function stripText(text: string, isListItem: boolean, isHeading: boolean): string {
  let out = text;

  // Number and price ranges: "2–3", "2024 — 2025", "₹500–₹800", "2 - 3"
  out = out.replace(new RegExp(`(\\d)\\s*${DASH}\\s*([₹$€£]?\\d)`, "g"), "$1-$2");

  // Headings: the first dash introduces what follows
  if (isHeading) out = out.replace(new RegExp(`\\s*${DASH}\\s*`), ": ");

  // A bold label at the start: "**MON** — Post" → "**MON:** Post"
  out = out.replace(new RegExp(`^\\*\\*([^*\\n]+?)\\*\\*\\s*${DASH}\\s*`), (_m, label: string) =>
    /[:.?!]$/.test(label.trim()) ? `**${label}** ` : `**${label.trim()}:** `
  );

  // A short label at the start of a list item: "Instagram Reels — post three a week"
  if (isListItem) {
    const m = out.match(new RegExp(`^([^\\u2014\\u2013\\u2012\\u2015.!?;:]{1,40}?)\\s+${DASH}\\s+`));
    if (m && m[1].trim().split(/\s+/).length <= 4) out = `${m[1].trim()}: ` + out.slice(m[0].length);
  }

  // A dash closing a line introduces what comes next
  out = out.replace(new RegExp(`\\s*${DASH}\\s*$`), ":");
  // Any other dash: a comma
  out = out.replace(new RegExp(`\\s*${DASH}\\s*`, "g"), ", ");
  // Text that now starts with a comma (it opened with a dash that wasn't a bullet)
  out = out.replace(/^\s*,\s*/, "");
  // A lone dash left over, from an em dash with no spaces around it ("word—word")
  out = out.replace(/[\u2014\u2013\u2012\u2015]/g, ", ");

  return tidy(out);
}

function stripLine(line: string): string {
  if (!HAS_DASH.test(line)) return line;

  // A dash used as a bullet becomes an ordinary one
  const bulleted = line.replace(DASH_BULLET, "$1- ");
  // The list marker ("- ", "1. ") stays as it is; only the text after it is cleaned
  const marker = bulleted.match(LIST_MARKER)?.[1] ?? "";
  const heading = marker ? "" : bulleted.match(/^\s*#{1,6}\s+/)?.[0] ?? "";
  const lead = marker || heading;
  const rest = bulleted.slice(lead.length);
  if (!HAS_DASH.test(rest)) return bulleted;
  return lead + stripText(rest, Boolean(marker), Boolean(heading));
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
