/**
 * Reads the text out of an uploaded pitch deck or company PDF, so the business profile can use it
 * alongside the website. Server-only. Free: no AI or search calls happen here.
 *
 * - PDF (most decks are exported to PDF): text per page, with pdf-parse.
 * - PowerPoint (.pptx): text per slide, plus the speaker notes, from the slide XML.
 *
 * Slides that are only pictures have no text to read; the caller tells the founder so.
 */

import JSZip from "jszip";
import type { PitchDeckUpload } from "@/lib/intelligence/types";

/** Largest upload accepted. Decks with big photos run to several MB. */
export const MAX_DECK_BYTES = 15 * 1024 * 1024;
/** Pages or slides read; a pitch deck is 10-30, a company PDF can run longer. */
export const MAX_DECK_PAGES = 60;
/** Text kept: about 5,000 tokens, enough for a long deck's words. */
export const MAX_DECK_CHARS = 20_000;
/** Below this many letters there's nothing worth reading (an image-only deck). */
const MIN_DECK_LETTERS = 80;
/** Skips any one slide part that unzips to more than this (a zip bomb, not a slide). */
const MAX_PART_BYTES = 4 * 1024 * 1024;

/** A problem the founder can fix, with a message for them and an HTTP status. */
export class DeckError extends Error {
  constructor(
    message: string,
    readonly status = 422
  ) {
    super(message);
  }
}

export type DeckKind = PitchDeckUpload["kind"];

/** PDF or PowerPoint, from the file's first bytes (names and browser types can lie). */
export function detectDeckKind(bytes: Uint8Array): DeckKind | null {
  const head = Buffer.from(bytes.subarray(0, 1024)).toString("latin1");
  if (head.includes("%PDF-")) return "pdf";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return "pptx";
  return null;
}

/** Whitespace tidied, control characters gone, capped at MAX_DECK_CHARS on a word boundary. */
export function cleanDeckText(text: string): string {
  const tidy = text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (tidy.length <= MAX_DECK_CHARS) return tidy;
  return tidy.slice(0, MAX_DECK_CHARS).replace(/\s+\S*$/, "") + "\n[The rest of the deck was cut for length.]";
}

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, code: string) => {
    if (code[0] !== "#") return XML_ENTITIES[code.toLowerCase()] ?? m;
    const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(n) ? String.fromCodePoint(n) : m;
  });
}

/** The words in one slide's (or notes page's) XML, a line per paragraph. */
export function slideXmlText(xml: string): string {
  return xml
    .split(/<\/a:p>/)
    .map((para) => [...para.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXml(m[1])).join(""))
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

async function readPdf(bytes: Uint8Array): Promise<{ pages: number; text: string }> {
  const { PDFParse, PasswordException } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText({ first: MAX_DECK_PAGES, pageJoiner: "" });
    const text = result.pages.map((p) => `[Page ${p.num}]\n${p.text.trim()}`).join("\n\n");
    return { pages: result.total, text };
  } catch (err) {
    if (err instanceof PasswordException || (err instanceof Error && /password/i.test(err.message))) {
      throw new DeckError("This PDF is password-protected. Save a copy without the password and upload that.");
    }
    throw new DeckError("We couldn't open this PDF. It may be damaged. Try exporting it again.");
  } finally {
    await parser.destroy().catch(() => {});
  }
}

/** The uncompressed size JSZip records for an entry (not part of its public types). */
function unzippedSize(file: JSZip.JSZipObject): number {
  const data = (file as unknown as { _data?: { uncompressedSize?: number } })._data;
  return data?.uncompressedSize ?? 0;
}

async function readPptx(bytes: Uint8Array): Promise<{ pages: number; text: string }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new DeckError("We couldn't open this file. Upload a PDF or a PowerPoint (.pptx) deck.");
  }
  const readRaw = async (name: string) => {
    const file = zip.file(name);
    if (!file || unzippedSize(file) > MAX_PART_BYTES) return "";
    return file.async("string");
  };

  // Slide files in the order the deck shows them (presentation.xml's list), falling back to
  // their numbers when that list can't be read.
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
  if (slideFiles.length === 0) {
    // A .docx, .xlsx or other zip, or a Keynote file renamed
    throw new DeckError("This doesn't look like a PowerPoint deck. Upload a PDF or a .pptx file.", 415);
  }
  const ordered = await presentationOrder(readRaw);
  const slides = ordered.length ? ordered.filter((name) => slideFiles.includes(name)) : slideFiles;

  const parts: string[] = [];
  let length = 0;
  for (const [i, name] of slides.slice(0, MAX_DECK_PAGES).entries()) {
    if (length > MAX_DECK_CHARS) break;
    const body = slideXmlText(await readRaw(name));
    // The notes page linked from this slide; its slide-number placeholder is dropped.
    const rels = await readRaw(name.replace(/slides\/(slide\d+\.xml)$/, "slides/_rels/$1.rels"));
    const notesTarget = rels.match(/Type="[^"]*\/notesSlide"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Type="[^"]*\/notesSlide"/);
    const notesFile = notesTarget ? resolvePart("ppt/slides/", notesTarget[1] || notesTarget[2]) : "";
    const noteText = notesFile ? slideXmlText(await readRaw(notesFile)).replace(/^\d+$/gm, "").trim() : "";
    const part = [`[Slide ${i + 1}]`, body, noteText ? `Notes: ${noteText}` : ""].filter(Boolean).join("\n");
    parts.push(part);
    length += part.length;
  }
  return { pages: slides.length, text: parts.join("\n\n") };
}

/** "../notesSlides/notesSlide2.xml" from "ppt/slides/" → "ppt/notesSlides/notesSlide2.xml" */
function resolvePart(base: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/").filter(Boolean);
  for (const piece of target.split("/")) {
    if (piece === "..") parts.pop();
    else if (piece && piece !== ".") parts.push(piece);
  }
  return parts.join("/");
}

/** The slide files in the order presentation.xml lists them; [] when it can't be read. */
async function presentationOrder(readRaw: (name: string) => Promise<string>): Promise<string[]> {
  const [presentation, rels] = await Promise.all([readRaw("ppt/presentation.xml"), readRaw("ppt/_rels/presentation.xml.rels")]);
  if (!presentation || !rels) return [];
  const targets = new Map<string, string>();
  for (const rel of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = rel[0].match(/\bId="([^"]+)"/)?.[1];
    const target = rel[0].match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) targets.set(id, resolvePart("ppt/", target));
  }
  return [...presentation.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)]
    .map((m) => targets.get(m[1]))
    .filter((name): name is string => Boolean(name));
}

/** Reads a deck's text, or throws a DeckError with a message for the founder. */
export async function readDeck(bytes: Uint8Array, fileName: string): Promise<PitchDeckUpload> {
  if (bytes.byteLength === 0) throw new DeckError("That file is empty.");
  if (bytes.byteLength > MAX_DECK_BYTES) {
    throw new DeckError(`That file is over ${MAX_DECK_BYTES / 1024 / 1024} MB. Export a smaller copy (compressed images) and try again.`, 413);
  }
  const kind = detectDeckKind(bytes);
  if (!kind) throw new DeckError("Upload a PDF or a PowerPoint (.pptx) file.", 415);

  const { pages, text } = kind === "pdf" ? await readPdf(bytes) : await readPptx(bytes);
  const clean = cleanDeckText(text);
  const letters = clean.replace(/\[(?:Page|Slide) \d+\]/g, "").replace(/[^\p{L}]/gu, "").length;
  if (letters < MIN_DECK_LETTERS) {
    throw new DeckError(
      "We couldn't find any text in this file. If the slides are pictures, export the deck again from PowerPoint, Keynote, Google Slides or Canva, or skip this step."
    );
  }

  const name = fileName.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(-120) || (kind === "pdf" ? "deck.pdf" : "deck.pptx");
  return { fileName: name, pages, kind, text: clean };
}
