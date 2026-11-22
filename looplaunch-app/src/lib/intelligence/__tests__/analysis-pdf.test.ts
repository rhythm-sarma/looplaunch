import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { analysisPdfFileName, buildAnalysisPdf, leafText } from "../analysis-pdf";
import { parseMindMap } from "../mind-map";

const fonts = join(process.cwd(), "public", "fonts", "pdf");

const strategy = `## 7 DAYS

**MON:** Film a reel styling one jacket three ways, priced at ₹899.
**TUE:** Reply to every DM within an hour.

## Why this works

Your buyers want a find, not a catalogue.

**Next step:** Want me to write the ready-to-record scripts for these Reels and Shorts? 💡`;

describe("analysis PDF", () => {
  test("builds a PDF with the answer, then the mind map on its own page", async () => {
    const bytes = await buildAnalysisPdf(
      {
        companyName: "Racksup",
        website: "https://racksup.in",
        title: "Your 7-day strategy for Racksup",
        content: strategy,
        mindMap: parseMindMap(strategy, "Racksup plan"),
        createdAt: new Date("2026-11-22T10:00:00"),
      },
      { regular: readFileSync(join(fonts, "Geist-Regular.ttf")), semibold: readFileSync(join(fonts, "Geist-SemiBold.ttf")) }
    );
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getPageCount(), 2);
    assert.equal(doc.getTitle(), "Your 7-day strategy for Racksup");
  });

  test("mind map points on paper carry the full step", () => {
    assert.equal(leafText({ label: "Mon: Film a reel styling one…", detail: "Film a reel styling one jacket three ways." }), "Mon: Film a reel styling one jacket three ways.");
    assert.equal(leafText({ label: "Carousels", detail: "thrift tips buyers save" }), "Carousels: thrift tips buyers save");
    assert.equal(leafText({ label: "Stop: posting without prices" }), "Stop: posting without prices");
  });

  test("file names are tidy", () => {
    assert.equal(analysisPdfFileName("Racksup.in!", "7-day strategy", new Date(2026, 10, 2)), "loop-launch-racksup-in-7-day-strategy-2026-11-02.pdf");
  });
});
