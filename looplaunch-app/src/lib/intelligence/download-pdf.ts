/**
 * Downloads one Loopy answer as a PDF (see analysis-pdf.ts). Browser only, and loaded on demand
 * from the analysis page so pdf-lib and the fonts cost nothing until someone asks for a PDF.
 */

import { analysisPdfFileName, buildAnalysisPdf, type AnalysisPdfInput } from "./analysis-pdf";

const ASSETS = {
  regular: "/fonts/pdf/Geist-Regular.ttf",
  semibold: "/fonts/pdf/Geist-SemiBold.ttf",
  logo: "/logo.png",
};

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't load ${url} (${res.status})`);
  return res.arrayBuffer();
}

/** Builds the PDF and saves it as a file; `label` names it ("7-day strategy", "answer"). */
export async function downloadAnalysisPdf(input: AnalysisPdfInput, label: string): Promise<void> {
  const [regular, semibold, logo] = await Promise.all([
    fetchBytes(ASSETS.regular),
    fetchBytes(ASSETS.semibold),
    fetchBytes(ASSETS.logo).catch(() => undefined),
  ]);
  const bytes = await buildAnalysisPdf(input, { regular, semibold, logo });
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = analysisPdfFileName(input.companyName, label, input.createdAt);
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Some browsers read the file after click() returns
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
