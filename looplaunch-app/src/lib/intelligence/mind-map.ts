/**
 * Turns one Loopy answer (markdown) into a mind map: sections become branches and each step a
 * short point. Used by the mind map dialog (components/intelligence/MindMap.tsx) and the PDF.
 */

export interface MindMapLeaf {
  /** Short, scannable label */
  label: string;
  /** Full text, shown when the point is opened */
  detail?: string;
}

export interface MindMapBranch {
  label: string;
  leaves: MindMapLeaf[];
}

export interface MindMapData {
  root: string;
  /** Opening paragraph of the answer, shown when the centre is tapped */
  summary?: string;
  branches: MindMapBranch[];
}

const MAX_BRANCHES = 8;
const MAX_LEAVES = 8;

function clean(text: string): string {
  return text
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")
    .replace(/^#+\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[:：]$/, "")
    .trim();
}

/** "MON" → "Mon", "STOP" → "Stop"; mixed-case text is left alone. */
function tidyCase(text: string): string {
  return text === text.toUpperCase() && /[A-Z]/.test(text) ? text.charAt(0) + text.slice(1).toLowerCase() : text;
}

function firstWords(text: string, n: number): string {
  const words = text.split(" ");
  if (words.length <= n) return text;
  return `${words.slice(0, n).join(" ").replace(/[,.;:!?-]+$/, "")}…`;
}

function shorten(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

function toLeaf(text: string, group?: string): MindMapLeaf {
  let label: string;
  let detail: string;

  const bold = text.match(/^\*\*([^*]{1,60})\*\*\s*[:\-–—]?\s*(.*)$/);
  if (bold) {
    // "**MON** — Audit your site…" or "**Primary KPI:** Cost per sale…"
    const head = clean(bold[1]);
    detail = clean(bold[2]);
    label = detail && head.length <= 5 ? `${tidyCase(head)}: ${firstWords(detail, 5)}` : tidyCase(head) || firstWords(detail, 7);
  } else {
    detail = clean(text);
    const lead = detail.match(/^([A-Za-z0-9 ]{1,14}?)\s*[:—–]\s+(.+)$/);
    label = lead ? `${tidyCase(lead[1])}: ${firstWords(lead[2], 5)}` : firstWords(detail, 7);
  }

  if (group) label = `${group}: ${label}`;
  const plainLabel = label.replace(/…$/, "");
  const hasMore = detail && detail.length > plainLabel.replace(/^[^:]+:\s*/, "").length + 3;
  return { label: shorten(label, 64), detail: hasMore ? detail : undefined };
}

/** Lines that talk to the reader ("Would you like me to…") aren't part of the plan. */
export const isFollowUp = (line: string) => /\*\*next step|would you like me to|want me to write/i.test(line);

export function parseMindMap(markdown: string, fallbackRoot: string): MindMapData {
  const lines = markdown.split("\n");
  const hasHeadings = lines.some((l) => /^#{1,4}\s+\S/.test(l.trim()));
  let root = fallbackRoot;
  let summary: string | undefined;
  const branches: MindMapBranch[] = [];
  let current: MindMapBranch | null = null;
  let group: string | undefined;

  const startBranch = (label: string): MindMapBranch => {
    const b: MindMapBranch = { label: shorten(tidyCase(clean(label)), 64), leaves: [] };
    branches.push(b);
    group = undefined;
    return b;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || isFollowUp(line)) continue;
    // A rule ends a "**STOP:**" group: the points after it aren't part of it.
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      group = undefined;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)/);
    if (heading) {
      // A single top-level title becomes the centre of the map.
      if (heading[1].length === 1 && branches.length === 0 && root === fallbackRoot) {
        root = shorten(clean(heading[2]), 40);
        continue;
      }
      current = startBranch(heading[2]);
      continue;
    }

    const isListItem = /^(?:[-*•]|\d+[.)])\s+/.test(line);
    const body = line.replace(/^(?:[-*•]|\d+[.)])\s+/, "");

    // "**STOP:**" on its own line labels the points below it.
    const boldOnly = body.match(/^\*\*([^*]{2,40})\*\*:?$/);
    if (boldOnly) {
      if (current) group = tidyCase(clean(boldOnly[1]));
      else if (!hasHeadings) current = startBranch(boldOnly[1]);
      continue;
    }

    const boldLead = /^\*\*[^*]{1,60}\*\*/.test(body);

    // Without headings, paragraphs that start with a bold label act as sections.
    if (!hasHeadings && boldLead && !isListItem && !/^\*\*[^*]{1,5}\*\*\s*[—–-]/.test(body)) {
      const m = body.match(/^\*\*([^*]{1,60})\*\*\s*[:\-–—]?\s*(.*)$/);
      current = startBranch(m ? m[1] : body);
      if (m && m[2]) current.leaves.push(toLeaf(m[2]));
      continue;
    }

    if (!current) {
      // Text before the first section: the opening paragraph explains the whole map.
      if (!isListItem && !boldLead) {
        if (!summary) summary = clean(body);
        continue;
      }
      current = startBranch("Key points");
    }

    if (isListItem || boldLead || current.leaves.length === 0) {
      current.leaves.push(toLeaf(body, group));
    }
  }

  return {
    root,
    summary: summary ? shorten(summary, 600) : undefined,
    branches: branches
      .filter((b) => b.label && b.leaves.length > 0)
      .slice(0, MAX_BRANCHES)
      .map((b) => ({ ...b, leaves: b.leaves.slice(0, MAX_LEAVES) })),
  };
}
