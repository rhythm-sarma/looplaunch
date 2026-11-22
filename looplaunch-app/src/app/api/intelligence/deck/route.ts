/**
 * POST /api/intelligence/deck  (multipart form, field "file")
 *
 * The optional last onboarding step: reads the text out of a pitch deck or company PDF
 * (PDF or .pptx) and returns it, so the answers can carry it to /api/intelligence/gather.
 * Nothing is stored here and no paid service is called. Open to the same people as the scan.
 */

import { NextResponse } from "next/server";
import { rejectIfNoAccess } from "@/lib/auth/team-guard";
import { DeckError, MAX_DECK_BYTES, readDeck } from "@/lib/deck/extract";

export async function POST(request: Request) {
  const denied = await rejectIfNoAccess();
  if (denied) return denied;

  // Refuse an oversized body before reading it, when the browser says how big it is.
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_DECK_BYTES + 64 * 1024) {
    return NextResponse.json({ error: `That file is over ${MAX_DECK_BYTES / 1024 / 1024} MB. Export a smaller copy and try again.` }, { status: 413 });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "The upload didn't come through. Please try again." }, { status: 400 });
  }
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Choose a PDF or PowerPoint file to upload." }, { status: 400 });
  }

  try {
    const deck = await readDeck(new Uint8Array(await file.arrayBuffer()), file.name);
    console.log(`[Deck] Read ${deck.kind} "${deck.fileName}": ${deck.pages} pages, ${deck.text.length} characters`);
    return NextResponse.json(deck);
  } catch (err) {
    if (err instanceof DeckError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[Deck] Couldn't read an upload:", err);
    return NextResponse.json({ error: "We couldn't read this file. Try exporting it again as a PDF." }, { status: 500 });
  }
}
