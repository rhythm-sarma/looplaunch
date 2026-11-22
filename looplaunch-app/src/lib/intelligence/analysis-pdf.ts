/**
 * Builds the downloadable PDF of one Loopy answer (the 7-day strategy, say): a branded header,
 * the answer itself, what it's based on, and its mind map drawn as a tree at the end.
 *
 * Runs in the browser (download-pdf.ts fetches the fonts and logo and saves the file) and in Node
 * for tests: everything it needs comes in as bytes. A light page, so it prints well.
 */

import { PDFArray, PDFDocument, PDFName, PDFString, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { isFollowUp, type MindMapData, type MindMapLeaf } from "./mind-map";
import type { ResearchSource, StrategicEvidence } from "./types";

export interface AnalysisPdfInput {
  companyName: string;
  website?: string;
  /** "Your 7-day strategy for Acme" */
  title: string;
  /** The founder's own question, for answers that weren't a built-in strategy */
  question?: string;
  /** The answer, in the markdown Loopy writes */
  content: string;
  evidence?: StrategicEvidence[];
  sources?: ResearchSource[];
  mindMap: MindMapData;
  createdAt: Date;
}

export interface AnalysisPdfAssets {
  regular: ArrayBuffer | Uint8Array;
  semibold: ArrayBuffer | Uint8Array;
  /** White logo on a transparent background (public/logo.png), drawn on the dark header */
  logo?: ArrayBuffer | Uint8Array;
}

// ── Page and type scale (points; A4) ──
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 54;
const TOP = PAGE_H - 56;
const BOTTOM = 64;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = {
  ink: hex("#18181B"),
  body: hex("#3F3F46"),
  muted: hex("#71717A"),
  line: hex("#E4E4E7"),
  tree: hex("#C4C4CC"),
  panel: hex("#F4F4F5"),
  band: hex("#09090B"),
  bandText: hex("#B4B4BC"),
  white: rgb(1, 1, 1),
  purple: hex("#8B5CF6"),
  purpleDeep: hex("#6D28D9"),
  purpleWash: hex("#F5F3FF"),
  purpleEdge: hex("#DDD6FE"),
};

interface Run {
  text: string;
  bold: boolean;
}

/** Inline markdown to styled runs, the way MarkdownContent shows it (long bold spans stay plain). */
function inlineRuns(text: string): Run[] {
  const plain = text.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1");
  return plain
    .split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/)
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        const inner = part.slice(2, -2);
        return { text: inner, bold: inner.length <= 48 };
      }
      if ((part.startsWith("*") && part.endsWith("*") && part.length > 2) || (part.startsWith("`") && part.endsWith("`"))) {
        return { text: part.slice(1, -1), bold: false };
      }
      return { text: part.replace(/\*\*/g, ""), bold: false };
    });
}

class PdfWriter {
  readonly doc: PDFDocument;
  private regular: PDFFont;
  private semibold: PDFFont;
  private glyphs: Set<number>;
  page!: PDFPage;
  y = TOP;

  constructor(doc: PDFDocument, regular: PDFFont, semibold: PDFFont) {
    this.doc = doc;
    this.regular = regular;
    this.semibold = semibold;
    this.glyphs = new Set(regular.getCharacterSet());
  }

  font(bold: boolean) {
    return bold ? this.semibold : this.regular;
  }

  /** Text the font can draw: emoji and other missing characters are dropped or swapped. */
  safe(text: string): string {
    const swaps: Record<string, string> = { "—": ", ", "–": "-", "→": "->", "✓": "", "✔": "", "☐": "", "\t": " " };
    let out = "";
    for (const ch of text.replace(/[︎️‍​]/g, "")) {
      const cp = ch.codePointAt(0)!;
      if (this.glyphs.has(cp)) out += ch;
      else if (ch in swaps) out += swaps[ch];
      else if (cp === 0x20 || cp === 0xa0) out += " ";
    }
    return out;
  }

  width(text: string, bold: boolean, size: number) {
    return this.font(bold).widthOfTextAtSize(text, size);
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = TOP;
  }

  /** Starts a new page unless `height` still fits above the bottom margin. */
  ensure(height: number) {
    if (this.y - height < BOTTOM) this.newPage();
  }

  /** Runs broken into lines no wider than `max`. Over-long words (links) are split. */
  wrap(runs: Run[], size: number, max: number): Run[][] {
    const lines: Run[][] = [];
    let line: Run[] = [];
    let lineW = 0;
    const push = (text: string, bold: boolean) => {
      const last = line[line.length - 1];
      if (last && last.bold === bold) last.text += text;
      else line.push({ text, bold });
      lineW += this.width(text, bold, size);
    };
    const breakLine = () => {
      if (line.length) {
        const last = line[line.length - 1];
        last.text = last.text.replace(/\s+$/, "");
        lines.push(line);
      }
      line = [];
      lineW = 0;
    };

    for (const run of runs) {
      for (const token of this.safe(run.text).split(/(\s+)/)) {
        if (!token) continue;
        if (/^\s+$/.test(token)) {
          if (line.length) push(" ", run.bold);
          continue;
        }
        let word = token;
        let w = this.width(word, run.bold, size);
        if (lineW + w > max && line.length) breakLine();
        while (w > max) {
          // Split a word that can't fit on any line
          let cut = word.length - 1;
          while (cut > 1 && this.width(word.slice(0, cut), run.bold, size) > max - lineW) cut--;
          push(word.slice(0, cut), run.bold);
          breakLine();
          word = word.slice(cut);
          w = this.width(word, run.bold, size);
        }
        push(word, run.bold);
      }
    }
    breakLine();
    return lines;
  }

  /** At most `max` lines; a cut ends with an ellipsis that still fits the width. */
  clamp(lines: Run[][], max: number, size: number, width: number): Run[][] {
    if (lines.length <= max) return lines;
    const kept = lines.slice(0, max).map((line) => line.map((r) => ({ ...r })));
    const last = kept[max - 1];
    const lineWidth = () => last.reduce((sum, r) => sum + this.width(r.text, r.bold, size), 0);
    const tail = last[last.length - 1];
    tail.text = tail.text.replace(/[\s,.;:]+$/, "") + "…";
    while (lineWidth() > width && tail.text.length > 1) {
      tail.text = tail.text.slice(0, -2).replace(/\s+\S*$/, "").replace(/[\s,.;:]+$/, "") + "…";
    }
    return kept;
  }

  drawLine(runs: Run[], x: number, y: number, size: number, color: RGB, page = this.page) {
    let cx = x;
    for (const run of runs) {
      page.drawText(run.text, { x: cx, y, size, font: this.font(run.bold), color });
      cx += this.width(run.text, run.bold, size);
    }
  }

  /** Wrapped text at the cursor, moving it down; returns the lines drawn. */
  paragraph(runs: Run[], opts: { size?: number; leading?: number; color?: RGB; indent?: number; width?: number } = {}) {
    const size = opts.size ?? 10.5;
    const leading = opts.leading ?? size * 1.5;
    const indent = opts.indent ?? 0;
    const lines = this.wrap(runs, size, (opts.width ?? CONTENT_W) - indent);
    for (const line of lines) {
      this.ensure(leading);
      this.drawLine(line, MARGIN_X + indent, this.y - size, size, opts.color ?? C.body);
      this.y -= leading;
    }
    return lines;
  }

  link(x: number, y: number, w: number, h: number, url: string, page = this.page) {
    if (!/^https?:\/\//i.test(url)) return;
    const annot = this.doc.context.register(
      this.doc.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [x, y, x + w, y + h],
        Border: [0, 0, 0],
        A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
      })
    );
    const annots = page.node.lookup(PDFName.of("Annots"));
    if (annots instanceof PDFArray) annots.push(annot);
    else page.node.set(PDFName.of("Annots"), this.doc.context.obj([annot]));
  }
}

// ── Sections ──

function header(w: PdfWriter, input: AnalysisPdfInput, logo: PDFImage | null) {
  const titleSize = 22;
  const titleLines = w.wrap([{ text: input.title, bold: true }], titleSize, CONTENT_W);
  const bandH = 40 + 26 + 22 + titleLines.length * titleSize * 1.22 + 10 + 16 + 26;
  const { page } = w;
  page.drawRectangle({ x: 0, y: PAGE_H - bandH, width: PAGE_W, height: bandH, color: C.band });
  page.drawRectangle({ x: 0, y: PAGE_H - bandH, width: PAGE_W, height: 3, color: C.purple });

  let y = PAGE_H - 40;
  if (logo) {
    const h = 26;
    page.drawImage(logo, { x: MARGIN_X, y: y - h, width: (logo.width / logo.height) * h, height: h });
  } else {
    w.drawLine([{ text: "Loop Launch", bold: true }], MARGIN_X, y - 18, 16, C.white);
  }
  const date = input.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const dateW = w.width(date, false, 9.5);
  w.drawLine([{ text: date, bold: false }], PAGE_W - MARGIN_X - dateW, y - 16, 9.5, C.bandText);

  y -= 26 + 22;
  for (const line of titleLines) {
    w.drawLine(line, MARGIN_X, y - titleSize, titleSize, C.white);
    y -= titleSize * 1.22;
  }
  y -= 10;
  const domain = (input.website || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  const meta = [domain, "Written by Loopy, your Loop Launch strategist"].filter(Boolean).join("  ·  ");
  w.drawLine(w.wrap([{ text: meta, bold: false }], 10, CONTENT_W)[0] ?? [], MARGIN_X, y - 10, 10, C.bandText);

  w.y = PAGE_H - bandH - 30;
}

function question(w: PdfWriter, text: string) {
  const size = 10.5;
  const lines = w.wrap([{ text, bold: false }], size, CONTENT_W - 28);
  const h = 16 + 14 + lines.length * size * 1.45 + 12;
  w.ensure(h);
  w.page.drawRectangle({ x: MARGIN_X, y: w.y - h, width: CONTENT_W, height: h, color: C.panel });
  w.page.drawRectangle({ x: MARGIN_X, y: w.y - h, width: 3, height: h, color: C.purple });
  w.drawLine([{ text: "You asked", bold: true }], MARGIN_X + 14, w.y - 22, 9, C.muted);
  let y = w.y - 30;
  for (const line of lines) {
    w.drawLine(line, MARGIN_X + 14, y - size, size, C.ink);
    y -= size * 1.45;
  }
  w.y -= h + 18;
}

/** The answer's markdown, block by block, in the same shapes the app shows. */
function body(w: PdfWriter, markdown: string) {
  const blocks = markdown
    .replace(/\r/g, "")
    .replace(/^(#{1,6}\s.*)\n(?=\S)/gm, "$1\n\n")
    .split(/\n\s*\n/)
    .map((b) => b.replace(/^\n+|\s+$/g, ""))
    .filter((b) => b.trim());

  for (const block of blocks) {
    const trimmed = block.trim();

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      w.ensure(20);
      w.y -= 8;
      w.page.drawLine({ start: { x: MARGIN_X, y: w.y }, end: { x: MARGIN_X + CONTENT_W, y: w.y }, thickness: 0.75, color: C.line });
      w.y -= 12;
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading && !trimmed.includes("\n")) {
      const level = heading[1].length;
      const size = level === 1 ? 16 : level === 2 ? 13.5 : 11.5;
      const before = level <= 2 ? 14 : 8;
      // Keep a heading with at least two lines of what follows it
      w.ensure(before + size * 1.3 + 34);
      w.y -= before;
      w.paragraph([{ text: heading[2].replace(/\*\*/g, ""), bold: true }], { size, leading: size * 1.3, color: C.ink });
      w.y -= level <= 2 ? 4 : 2;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const runs = inlineRuns(
        trimmed
          .split("\n")
          .map((l) => l.replace(/^>\s?/, ""))
          .join(" ")
      );
      // Short quotes stay on one page so the bar beside them stays whole
      const lines = w.wrap(runs, 10.5, CONTENT_W - 14);
      w.ensure(Math.min(lines.length * 15.75 + 8, 200));
      const startPage = w.page;
      const top = w.y;
      w.y -= 4;
      w.paragraph(runs, { indent: 14, color: C.muted });
      if (w.page === startPage) w.page.drawRectangle({ x: MARGIN_X, y: w.y, width: 2, height: top - w.y, color: C.purpleEdge });
      w.y -= 8;
      continue;
    }

    // Line by line: list items (with nesting by indent) and text lines in one block
    for (const raw of block.split("\n")) {
      // "Next step: want me to write the scripts?" talks to the reader in the app; not on paper
      if (!raw.trim() || isFollowUp(raw)) continue;
      const depth = Math.min(2, Math.floor((raw.match(/^\s*/)?.[0].length ?? 0) / 2));
      const bullet = raw.match(/^\s*[-*•]\s+(.*)$/);
      const numbered = raw.match(/^\s*(\d+)[.)]\s+(.*)$/);
      if (bullet || numbered) {
        const indent = depth * 14;
        const marker = numbered ? `${numbered[1]}.` : "";
        const textIndent = indent + (numbered ? 20 : 14);
        w.ensure(16);
        const firstY = w.y - 10.5;
        if (numbered) w.drawLine([{ text: marker, bold: true }], MARGIN_X + indent, firstY, 10, C.muted);
        else w.page.drawCircle({ x: MARGIN_X + indent + 3.5, y: firstY + 3.4, size: 1.9, color: C.purple });
        w.paragraph(inlineRuns((bullet ? bullet[1] : numbered![2]).trim()), { indent: textIndent });
        w.y -= 3;
      } else {
        w.paragraph(inlineRuns(raw.trim()));
      }
    }
    w.y -= 7;
  }
}

function basedOn(w: PdfWriter, evidence: StrategicEvidence[] = [], sources: ResearchSource[] = []) {
  if (!evidence.length && !sources.length) return;
  w.ensure(60);
  w.y -= 6;
  w.page.drawLine({ start: { x: MARGIN_X, y: w.y }, end: { x: MARGIN_X + CONTENT_W, y: w.y }, thickness: 0.75, color: C.line });
  w.y -= 18;

  if (evidence.length) {
    w.paragraph([{ text: "What this is based on", bold: true }], { size: 11.5, color: C.ink });
    w.y -= 2;
    for (const ev of evidence) {
      w.ensure(34);
      w.paragraph(inlineRuns(ev.insight), { size: 10 });
      const label = `Source: ${ev.source || ev.url || ""}`;
      const lines = w.paragraph([{ text: label, bold: false }], { size: 8.5, color: C.muted });
      if (ev.url && lines.length === 1) w.link(MARGIN_X, w.y + 2, w.width(lines[0][0]?.text ?? "", false, 8.5), 11, ev.url);
      w.y -= 6;
    }
    w.y -= 6;
  }

  if (sources.length) {
    w.paragraph([{ text: "Sources", bold: true }], { size: 11.5, color: C.ink });
    w.y -= 2;
    for (const s of sources) {
      w.ensure(30);
      w.paragraph([{ text: s.title || s.source, bold: false }], { size: 10, color: C.ink });
      const lines = w.paragraph([{ text: s.url, bold: false }], { size: 8.5, color: C.purpleDeep });
      if (lines.length === 1) w.link(MARGIN_X, w.y + 2, w.width(lines[0][0]?.text ?? "", false, 8.5), 11, s.url);
      w.y -= 5;
    }
  }
}

// ── Mind map: root on the left, branches beside it, each branch's points beside that ──
const ROOT_W = 96;
const BRANCH_W = 116;
const ARM = 12;
/** Most lines a point gets; paper has room for more of each step than the app's short labels */
const LEAF_MAX_LINES = 3;

/**
 * A point's text for paper: the app shows a short label and opens the full step on tap, so here
 * the label's lead ("Mon:", "Carousels") is joined to the full step when there is one.
 */
export function leafText(leaf: MindMapLeaf): string {
  if (!leaf.detail) return leaf.label;
  if (leaf.label.endsWith("…")) {
    const shown = leaf.label.slice(0, -1);
    const at = shown.indexOf(leaf.detail.slice(0, Math.min(12, leaf.detail.length)));
    return at >= 0 ? shown.slice(0, at) + leaf.detail : leaf.detail;
  }
  return `${leaf.label}: ${leaf.detail}`;
}
const NODE_PAD_X = 8;
const NODE_PAD_Y = 7;
const LEAF_SIZE = 9;
const LEAF_LEAD = 12;
const BRANCH_SIZE = 9.5;
const BRANCH_LEAD = 12.5;
const ROW_GAP = 6;
const BLOCK_GAP = 12;
/** Connectors meet each node at the middle of its first line */
const MEET = NODE_PAD_Y + 6.5;

function mindMap(w: PdfWriter, data: MindMapData) {
  if (data.branches.length === 0) return;
  w.newPage();
  w.paragraph([{ text: "Mind map", bold: true }], { size: 16, leading: 21, color: C.ink });
  w.paragraph([{ text: "The plan at a glance. Each branch is one part of the plan, and the points beside it are its steps.", bold: false }], {
    size: 10,
    color: C.muted,
  });
  w.y -= 18;

  const rootX = MARGIN_X;
  const spine1 = rootX + ROOT_W + ARM;
  const branchX = spine1 + ARM;
  const spine2 = branchX + BRANCH_W + ARM;
  const leafX = spine2 + ARM;
  const leafW = MARGIN_X + CONTENT_W - leafX;

  // Root node, its top level with the first branch
  const rootSize = 10.5;
  const rootLines = w.wrap([{ text: data.root, bold: true }], rootSize, ROOT_W - NODE_PAD_X * 2).slice(0, 4);
  const rootH = rootLines.length * 13.5 + NODE_PAD_Y * 2;
  const rootTop = w.y;
  w.page.drawRectangle({ x: rootX, y: rootTop - rootH, width: ROOT_W, height: rootH, color: C.ink });
  rootLines.forEach((line, i) => w.drawLine(line, rootX + NODE_PAD_X, rootTop - NODE_PAD_Y - 10 - i * 13.5, rootSize, C.white));
  w.page.drawLine({ start: { x: rootX + ROOT_W, y: rootTop - MEET }, end: { x: spine1, y: rootTop - MEET }, thickness: 1, color: C.tree });

  let spineTop = rootTop - MEET;
  let lastMeet: number | null = null;
  const closeSpine = () => {
    if (lastMeet !== null && lastMeet < spineTop) {
      w.page.drawLine({ start: { x: spine1, y: spineTop }, end: { x: spine1, y: lastMeet }, thickness: 1, color: C.tree });
    }
  };

  data.branches.forEach((branch, bi) => {
    const branchLines = w.wrap([{ text: branch.label, bold: true }], BRANCH_SIZE, BRANCH_W - NODE_PAD_X * 2 - 9).slice(0, 4);
    const branchH = branchLines.length * BRANCH_LEAD + NODE_PAD_Y * 2;
    const leaves = branch.leaves.map((leaf) => {
      const lines = w.clamp(w.wrap(inlineRuns(leafText(leaf)), LEAF_SIZE, leafW - NODE_PAD_X * 2), LEAF_MAX_LINES, LEAF_SIZE, leafW - NODE_PAD_X * 2);
      return { lines, h: lines.length * LEAF_LEAD + NODE_PAD_Y * 2 };
    });
    const leavesH = leaves.reduce((sum, l) => sum + l.h, 0) + ROW_GAP * Math.max(0, leaves.length - 1);
    const blockH = Math.max(branchH, leavesH);

    // A branch never splits across pages; the spine carries on from the top of the next one
    if (w.y - blockH < BOTTOM) {
      closeSpine();
      w.newPage();
      w.paragraph([{ text: "Mind map, continued", bold: false }], { size: 9, color: C.muted });
      w.y -= 8;
      spineTop = w.y;
      lastMeet = null;
    }

    const top = w.y;
    const meet = top - MEET;
    const { page } = w;
    // Branch node and its arm from the spine
    page.drawLine({ start: { x: spine1, y: meet }, end: { x: branchX, y: meet }, thickness: 1, color: C.tree });
    page.drawRectangle({
      x: branchX,
      y: top - branchH,
      width: BRANCH_W,
      height: branchH,
      color: C.purpleWash,
      borderColor: C.purpleEdge,
      borderWidth: 0.75,
    });
    page.drawCircle({ x: branchX + NODE_PAD_X + 2.5, y: meet + 0.5, size: 2.5, color: C.purple });
    branchLines.forEach((line, i) => w.drawLine(line, branchX + NODE_PAD_X + 9, top - NODE_PAD_Y - 9.5 - i * BRANCH_LEAD, BRANCH_SIZE, C.ink));

    // Its points, each on an arm from the branch's own spine
    if (leaves.length) {
      page.drawLine({ start: { x: branchX + BRANCH_W, y: meet }, end: { x: spine2, y: meet }, thickness: 1, color: C.tree });
      let ly = top;
      let lastLeafMeet = meet;
      leaves.forEach((leaf) => {
        const leafMeet = ly - MEET;
        page.drawLine({ start: { x: spine2, y: leafMeet }, end: { x: leafX, y: leafMeet }, thickness: 1, color: C.tree });
        page.drawRectangle({ x: leafX, y: ly - leaf.h, width: leafW, height: leaf.h, color: C.white, borderColor: C.line, borderWidth: 0.75 });
        leaf.lines.forEach((line, i) => w.drawLine(line, leafX + NODE_PAD_X, ly - NODE_PAD_Y - 9 - i * LEAF_LEAD, LEAF_SIZE, C.body));
        lastLeafMeet = leafMeet;
        ly -= leaf.h + ROW_GAP;
      });
      if (lastLeafMeet < meet) page.drawLine({ start: { x: spine2, y: meet }, end: { x: spine2, y: lastLeafMeet }, thickness: 1, color: C.tree });
    }

    lastMeet = meet;
    w.y = top - blockH - (bi === data.branches.length - 1 ? 0 : BLOCK_GAP);
  });
  closeSpine();
}

function footers(w: PdfWriter, companyName: string) {
  const pages = w.doc.getPages();
  pages.forEach((page, i) => {
    const left = w.safe(`Loop Launch  ·  ${companyName}`);
    const right = `Page ${i + 1} of ${pages.length}`;
    w.drawLine([{ text: left, bold: false }], MARGIN_X, 34, 8.5, C.muted, page);
    w.drawLine([{ text: right, bold: false }], PAGE_W - MARGIN_X - w.width(right, false, 8.5), 34, 8.5, C.muted, page);
  });
}

/** The PDF's bytes. */
export async function buildAnalysisPdf(input: AnalysisPdfInput, assets: AnalysisPdfAssets): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [regular, semibold] = await Promise.all([
    doc.embedFont(assets.regular, { subset: true }),
    doc.embedFont(assets.semibold, { subset: true }),
  ]);
  const logo = assets.logo ? await doc.embedPng(assets.logo).catch(() => null) : null;

  doc.setTitle(input.title);
  doc.setAuthor("Loop Launch");
  doc.setCreator("Loop Launch");
  doc.setProducer("Loop Launch");
  doc.setSubject(`Marketing analysis for ${input.companyName}`);
  doc.setCreationDate(input.createdAt);

  const w = new PdfWriter(doc, regular, semibold);
  w.newPage();
  header(w, input, logo);
  if (input.question) question(w, input.question);
  body(w, input.content);
  basedOn(w, input.evidence, input.sources);
  mindMap(w, input.mindMap);
  footers(w, input.companyName);

  return doc.save();
}

/** A file name like "loop-launch-acme-7-day-strategy-2026-11-22.pdf". */
export function analysisPdfFileName(companyName: string, label: string, date: Date): string {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return ["loop-launch", slug(companyName), slug(label), day].filter(Boolean).join("-") + ".pdf";
}
