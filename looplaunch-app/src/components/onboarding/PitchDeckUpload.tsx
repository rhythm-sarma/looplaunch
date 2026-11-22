"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, FileText, Upload, X } from "lucide-react";
import type { PitchDeckUpload as Deck } from "@/lib/onboarding/types";

/** Same limit as the server (src/lib/deck/extract.ts), checked here first to save the upload. */
const MAX_MB = 15;

/** A plain reason a file can't be used, before it's sent; null when it looks fine. */
function problemWith(file: File): string | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".key")) return "Keynote files can't be read here. In Keynote, choose File > Export To > PDF, then upload that.";
  if (name.endsWith(".ppt")) return "That's the old PowerPoint format. Save it as .pptx or PDF, then upload that.";
  if (!name.endsWith(".pdf") && !name.endsWith(".pptx")) return "Upload a PDF or a PowerPoint (.pptx) file.";
  if (file.size > MAX_MB * 1024 * 1024) return `That file is over ${MAX_MB} MB. Export a smaller copy (compressed images) and try again.`;
  return null;
}

interface PitchDeckUploadProps {
  value: Deck | null;
  onChange: (deck: Deck | null) => void;
}

/**
 * The optional pitch deck step's drop zone: pick or drop a PDF or .pptx, the server reads its text
 * (/api/intelligence/deck), and the deck joins the answers. Only the text travels on; the file
 * itself isn't kept.
 */
export function PitchDeckUpload({ value, onChange }: PitchDeckUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const upload = async (file: File) => {
    const problem = problemWith(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setReading(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/intelligence/deck", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "We couldn't read this file. Try exporting it again as a PDF.");
        return;
      }
      onChange(body as Deck);
    } catch {
      setError("The upload didn't go through. Check your connection and try again.");
    } finally {
      setReading(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const pages = value ? `${value.pages} ${value.kind === "pptx" ? "slide" : "page"}${value.pages === 1 ? "" : "s"} read` : "";

  return (
    <div className="w-full max-w-lg text-left">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />

      <AnimatePresence mode="wait" initial={false}>
        {value && !reading ? (
          <motion.div
            key="added"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="flex items-center gap-3 rounded-2xl bg-[#141418] border border-[#8B5CF6]/50 px-4 py-3.5"
          >
            <span className="relative w-10 h-10 rounded-xl bg-[#8B5CF6]/15 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-[#C4B5FD]" aria-hidden="true" />
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 18, delay: 0.12 }}
                className="absolute -right-1 -bottom-1 w-4.5 h-4.5 rounded-full bg-[#8B5CF6] flex items-center justify-center"
                aria-hidden="true"
              >
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </motion.span>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-medium text-[#F4F4F5] truncate">{value.fileName}</span>
              <span className="block text-[13px] text-[#B4B4BC]">{pages}. Loopy will use it in your plan.</span>
            </span>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setError("");
              }}
              aria-label={`Remove ${value.fileName}`}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#B4B4BC] hover:text-white hover:bg-[#1C1C21] transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="drop"
            type="button"
            disabled={Boolean(reading)}
            onClick={() => inputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!dragging) setDragging(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file && !reading) upload(file);
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, scale: dragging ? 1.02 : 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            aria-describedby="pitch-deck-note"
            className={`w-full flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-5 py-8 text-center transition-colors cursor-pointer disabled:cursor-progress ${
              dragging ? "border-[#8B5CF6] bg-[#8B5CF6]/10" : error ? "border-error/60 bg-[#141418]" : "border-[#3F3F48] bg-[#141418] hover:border-[#8B5CF6]/70 hover:bg-[#17171C]"
            }`}
          >
            {reading ? (
              <>
                <span className="w-6 h-6 border-2 border-[#C4B5FD] border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                <span className="text-[15px] font-medium text-[#F4F4F5]" aria-live="polite">
                  Reading your deck…
                </span>
                <span className="text-[13px] text-[#B4B4BC] max-w-full truncate">{reading}</span>
              </>
            ) : (
              <>
                <motion.span
                  animate={dragging ? { y: -3 } : { y: 0 }}
                  className="w-11 h-11 rounded-full bg-[#1C1C21] flex items-center justify-center"
                  aria-hidden="true"
                >
                  <Upload className="w-5 h-5 text-[#C4B5FD]" />
                </motion.span>
                <span className="text-[15px] font-medium text-[#F4F4F5]">
                  {dragging ? "Drop it here" : (
                    <>
                      Drop your deck here, or <span className="text-[#C4B5FD] underline underline-offset-4">choose a file</span>
                    </>
                  )}
                </span>
                <span className="text-[13px] text-[#8B8B94]">PDF or PowerPoint (.pptx), up to {MAX_MB} MB</span>
              </>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {error && (
        <p role="alert" className="mt-3 text-[14px] text-error pl-1">
          {error}
        </p>
      )}
      <p id="pitch-deck-note" className="mt-3 text-[13px] leading-relaxed text-[#8B8B94] pl-1">
        We don&apos;t keep the file. Loopy saves a few key points from it with this analysis.
      </p>
    </div>
  );
}
