import assert from "node:assert/strict";
import { describe, test } from "node:test";
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { DeckError, MAX_DECK_CHARS, cleanDeckText, detectDeckKind, readDeck, slideXmlText } from "../extract";

const LINE = "Racksup sells preloved fashion to Gen Z buyers in India through Instagram and WhatsApp drops.";

async function pdfWith(pages: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of pages) {
    const page = doc.addPage([600, 400]);
    if (text) page.drawText(text, { x: 40, y: 300, size: 12, font });
  }
  return doc.save();
}

const slideXml = (lines: string[]) =>
  `<?xml version="1.0"?><p:sld xmlns:a="a" xmlns:p="p"><p:cSld><p:spTree>${lines
    .map((l) => `<p:sp><p:txBody><a:p><a:r><a:t>${l}</a:t></a:r></a:p></p:txBody></p:sp>`)
    .join("")}</p:spTree></p:cSld></p:sld>`;

/** A minimal .pptx whose slide files are numbered against the order the deck shows them. */
async function pptx(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  zip.file(
    "ppt/presentation.xml",
    `<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId id="256" r:id="rId3"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>`
  );
  zip.file(
    "ppt/_rels/presentation.xml.rels",
    `<Relationships><Relationship Id="rId2" Type="x/slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="x/slide" Target="slides/slide2.xml"/></Relationships>`
  );
  zip.file("ppt/slides/slide1.xml", slideXml(["Traction", "1,200 orders &amp; 40% repeat buyers"]));
  zip.file("ppt/slides/slide2.xml", slideXml(["Racksup", LINE]));
  zip.file(
    "ppt/slides/_rels/slide2.xml.rels",
    `<Relationships><Relationship Id="rId1" Type="x/notesSlide" Target="../notesSlides/notesSlide9.xml"/></Relationships>`
  );
  zip.file("ppt/notesSlides/notesSlide9.xml", slideXml(["Say we started in a college hostel.", "2"]));
  return zip.generateAsync({ type: "uint8array" });
}

describe("deck extraction", () => {
  test("tells PDFs and PowerPoints apart by their bytes", async () => {
    assert.equal(detectDeckKind(await pdfWith([LINE])), "pdf");
    assert.equal(detectDeckKind(await pptx()), "pptx");
    assert.equal(detectDeckKind(new TextEncoder().encode("hello")), null);
  });

  test("reads slide XML a line per paragraph, decoding entities", () => {
    assert.equal(slideXmlText(slideXml(["A &amp; B", "&#8377;499"])), "A & B\n₹499");
  });

  test("reads a PDF's text page by page", async () => {
    const deck = await readDeck(await pdfWith([LINE, "Our goal: 500 orders a month by March."]), "Racksup deck.pdf");
    assert.equal(deck.kind, "pdf");
    assert.equal(deck.pages, 2);
    assert.equal(deck.fileName, "Racksup deck.pdf");
    assert.match(deck.text, /\[Page 1\][\s\S]*preloved fashion[\s\S]*\[Page 2\][\s\S]*500 orders/);
  });

  test("reads a PowerPoint in the order it's shown, with speaker notes", async () => {
    const deck = await readDeck(await pptx(), "deck.pptx");
    assert.equal(deck.kind, "pptx");
    assert.equal(deck.pages, 2);
    const first = deck.text.indexOf("Racksup");
    const second = deck.text.indexOf("Traction");
    assert.ok(first >= 0 && second > first, deck.text);
    assert.match(deck.text, /Notes: Say we started in a college hostel\./);
    assert.match(deck.text, /1,200 orders & 40% repeat buyers/);
    assert.doesNotMatch(deck.text, /Notes:[^\n]*\n2\b/);
  });

  test("a deck of pictures, a non-deck zip and other files are refused with a reason", async () => {
    await assert.rejects(readDeck(await pdfWith(["", ""]), "scan.pdf"), (e) => e instanceof DeckError && /couldn't find any text/.test(e.message));
    const docx = new JSZip();
    docx.file("word/document.xml", "<w:document/>");
    await assert.rejects(readDeck(await docx.generateAsync({ type: "uint8array" }), "cv.docx"), (e) => e instanceof DeckError && e.status === 415);
    await assert.rejects(readDeck(new TextEncoder().encode("just text"), "notes.txt"), (e) => e instanceof DeckError && e.status === 415);
    await assert.rejects(readDeck(new Uint8Array(), "empty.pdf"), DeckError);
  });

  test("text is tidied and capped", () => {
    assert.equal(cleanDeckText("a\u0007b  \t c\n\n\n\nd"), "a b c\n\nd");
    const long = cleanDeckText("word ".repeat(10_000));
    assert.ok(long.length <= MAX_DECK_CHARS + 60);
    assert.match(long, /cut for length/);
  });
});
