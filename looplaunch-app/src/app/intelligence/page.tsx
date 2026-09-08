"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type {
  StatusResponse,
  StrategicAnswer,
  PipelineStatus,
} from "@/lib/intelligence/types";

// ──────────────────────────────────────────────
// Pipeline Stage UI Config
// ──────────────────────────────────────────────

const STAGE_LABELS: Record<PipelineStatus, string> = {
  idle: "Initializing...",
  crawling_company: "Researching your website",
  crawling_competitors: "Researching your competitors",
  researching_market: "Analyzing your market",
  analyzing_company: "Building company intelligence",
  analyzing_competitors: "Analyzing competitive landscape",
  analyzing_market: "Understanding market dynamics",
  diagnosing: "Generating strategic diagnosis",
  ready: "Intelligence ready",
  error: "Something went wrong",
};

const STAGE_ORDER: PipelineStatus[] = [
  "crawling_company",
  "crawling_competitors",
  "researching_market",
  "analyzing_company",
  "analyzing_competitors",
  "analyzing_market",
  "diagnosing",
  "ready",
];

// ──────────────────────────────────────────────
// Suggested Questions
// ──────────────────────────────────────────────

const STARTER_QUESTIONS = [
  "What is our strongest competitive advantage?",
  "Which marketing channels should we prioritize?",
  "How should we position ourselves differently from competitors?",
  "What market opportunities are we currently missing?",
  "What's the biggest threat to our growth?",
  "How can we improve our value proposition?",
];

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────

function IntelligencePageContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  // Pipeline status
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [isGathering, setIsGathering] = useState(true);

  // Q&A state
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [conversation, setConversation] = useState<
    { question: string; answer: StrategicAnswer }[]
  >([]);
  const [error, setError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ─── Poll pipeline status ───
  useEffect(() => {
    if (!sessionId || !isGathering) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/intelligence/status?sessionId=${sessionId}`
        );
        if (!res.ok) {
          setError("Session not found. Please start over.");
          setIsGathering(false);
          return;
        }
        const data: StatusResponse = await res.json();
        setStatus(data);

        if (data.status === "ready") {
          setIsGathering(false);
          clearInterval(pollInterval);
        } else if (data.status === "error") {
          setError(data.error || "An error occurred during intelligence gathering.");
          setIsGathering(false);
          clearInterval(pollInterval);
        }
      } catch {
        // Network error — keep polling
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [sessionId, isGathering]);

  // ─── Auto-scroll to bottom of conversation ───
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  // ─── Ask a question ───
  const handleAsk = async (q?: string) => {
    const questionText = q || question.trim();
    if (!questionText || !sessionId || isAsking) return;

    setIsAsking(true);
    setError("");
    setQuestion("");

    try {
      const res = await fetch("/api/intelligence/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, question: questionText }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to get answer");
        setIsAsking(false);
        return;
      }

      const data = await res.json();
      setConversation((prev) => [
        ...prev,
        { question: questionText, answer: data.answer },
      ]);
    } catch {
      setError("Network error. Please try again.");
    }

    setIsAsking(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ─── No session ID ───
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <h1 className="text-2xl font-medium mb-4">No session found</h1>
          <p className="text-text-secondary mb-6">
            Start by entering your website on the home page.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#9d5ce6] text-white hover:bg-[#ad6ef8] transition-all"
          >
            ← Go Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col">
      {/* ─── Top Bar ─── */}
      <header className="border-b border-border-subtle px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="text-text-tertiary hover:text-text-primary transition-colors">
            ← Back
          </a>
          <div className="w-px h-5 bg-border-subtle" />
          <h1 className="text-sm font-medium tracking-wide text-text-secondary">
            Loop Launch Intelligence
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              status?.status === "ready"
                ? "bg-emerald-400"
                : status?.status === "error"
                ? "bg-red-400"
                : "bg-amber-400 animate-pulse"
            }`}
          />
          <span className="text-xs text-text-tertiary">
            {status ? STAGE_LABELS[status.status] : "Connecting..."}
          </span>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-6">
        {/* ─── Gathering Progress ─── */}
        <AnimatePresence>
          {isGathering && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="py-16 flex flex-col items-center"
            >
              <div className="mb-8">
                <div className="w-16 h-16 border-2 border-[#9d5ce6] border-t-transparent rounded-full animate-spin" />
              </div>
              <h2 className="text-2xl font-medium mb-2">
                Building your intelligence profile
              </h2>
              <p className="text-text-secondary text-sm mb-8">
                This usually takes 30-60 seconds.
              </p>

              {/* Progress Steps */}
              <div className="w-full max-w-sm space-y-3">
                {STAGE_ORDER.map((stage) => {
                  const currentIdx = status
                    ? STAGE_ORDER.indexOf(status.status)
                    : -1;
                  const stageIdx = STAGE_ORDER.indexOf(stage);
                  const isComplete = currentIdx > stageIdx;
                  const isCurrent = status?.status === stage;

                  return (
                    <div
                      key={stage}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
                        isCurrent
                          ? "bg-[#9d5ce6]/10 border border-[#9d5ce6]/30"
                          : isComplete
                          ? "opacity-50"
                          : "opacity-25"
                      }`}
                    >
                      {isComplete ? (
                        <svg className="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : isCurrent ? (
                        <div className="w-4 h-4 border-2 border-[#9d5ce6] border-t-transparent rounded-full animate-spin shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-border-subtle shrink-0" />
                      )}
                      <span className={`text-sm ${isCurrent ? "text-text-primary font-medium" : "text-text-secondary"}`}>
                        {STAGE_LABELS[stage]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Q&A Interface (shown when ready) ─── */}
        {!isGathering && status?.status === "ready" && (
          <div className="flex-1 flex flex-col py-8">
            {/* Welcome message or conversation */}
            {conversation.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 flex flex-col items-center justify-center"
              >
                <h2 className="text-3xl font-medium mb-3 text-center">
                  Your intelligence is ready
                </h2>
                <p className="text-text-secondary text-center max-w-md mb-10">
                  Ask any strategic marketing question. Loop Launch will answer
                  using the intelligence gathered about your company, competitors,
                  and market.
                </p>

                {/* Starter Questions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                  {STARTER_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleAsk(q)}
                      className="text-left px-4 py-3 rounded-xl border border-border-subtle bg-bg-surface hover:border-[#9d5ce6]/40 hover:bg-bg-elevated transition-all text-sm text-text-secondary hover:text-text-primary cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-8 pb-4">
                {conversation.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Question */}
                    <div className="flex justify-end mb-4">
                      <div className="bg-[#9d5ce6]/15 border border-[#9d5ce6]/30 rounded-xl px-5 py-3 max-w-[80%]">
                        <p className="text-sm text-text-primary">{item.question}</p>
                      </div>
                    </div>

                    {/* Answer */}
                    <div className="bg-bg-surface border border-border-subtle rounded-xl px-6 py-5 space-y-4">
                      <p className="text-sm text-text-primary leading-relaxed whitespace-pre-line">
                        {item.answer.answer}
                      </p>

                      {/* Evidence */}
                      {item.answer.evidence?.length > 0 && (
                        <div className="border-t border-border-subtle pt-4">
                          <p className="text-[11px] uppercase tracking-wider text-[#9d5ce6] font-semibold mb-2">
                            Evidence
                          </p>
                          <div className="space-y-2">
                            {item.answer.evidence.map((e, i) => (
                              <div key={i} className="flex gap-2 text-xs">
                                <span className="text-text-tertiary shrink-0">
                                  [{e.source}]
                                </span>
                                <span className="text-text-secondary">
                                  {e.insight}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Confidence */}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                          Confidence:
                        </span>
                        <span
                          className={`text-[10px] uppercase tracking-wider font-semibold ${
                            item.answer.confidence === "high"
                              ? "text-emerald-400"
                              : item.answer.confidence === "medium"
                              ? "text-amber-400"
                              : "text-red-400"
                          }`}
                        >
                          {item.answer.confidence}
                        </span>
                      </div>

                      {/* Follow-up Questions */}
                      {item.answer.followUpQuestions?.length > 0 && (
                        <div className="border-t border-border-subtle pt-3">
                          <p className="text-[11px] uppercase tracking-wider text-text-tertiary mb-2">
                            Follow-up questions
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {item.answer.followUpQuestions.map((fq, i) => (
                              <button
                                key={i}
                                onClick={() => handleAsk(fq)}
                                className="text-xs px-3 py-1.5 rounded-lg border border-border-subtle hover:border-[#9d5ce6]/40 text-text-secondary hover:text-text-primary transition-all cursor-pointer"
                              >
                                {fq}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {/* Loading state */}
                {isAsking && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-3 px-6 py-4"
                  >
                    <div className="w-4 h-4 border-2 border-[#9d5ce6] border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-text-secondary">
                      Analyzing with your intelligence data...
                    </span>
                  </motion.div>
                )}

                <div ref={bottomRef} />
              </div>
            )}

            {/* ─── Input Area ─── */}
            <div className="sticky bottom-0 pt-4 pb-6 bg-bg-primary">
              {error && (
                <div className="mb-3 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}
              <div className="relative rounded-xl bg-bg-surface border border-border-subtle focus-within:border-[#9d5ce6] focus-within:shadow-[0_0_22px_rgba(157,92,230,0.15)] transition-all">
                <textarea
                  ref={inputRef}
                  rows={2}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAsk();
                    }
                  }}
                  placeholder="Ask a strategic question..."
                  disabled={isAsking}
                  className="w-full bg-transparent text-text-primary text-sm placeholder:text-text-placeholder p-4 pr-14 resize-none focus:outline-none border-0 outline-none ring-0"
                />
                <button
                  onClick={() => handleAsk()}
                  disabled={!question.trim() || isAsking}
                  className="absolute right-3 bottom-3 w-8 h-8 rounded-lg bg-[#9d5ce6] text-white flex items-center justify-center hover:bg-[#ad6ef8] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-7-7l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <p className="text-[11px] text-text-tertiary mt-2 text-center">
                Press Enter to send · Shift+Enter for new line
              </p>
            </div>
          </div>
        )}

        {/* ─── Error State ─── */}
        {!isGathering && status?.status === "error" && (
          <div className="py-16 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-xl font-medium mb-2">Something went wrong</h2>
            <p className="text-text-secondary text-sm mb-6 max-w-md text-center">
              {error || status?.error || "An error occurred during intelligence gathering."}
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#9d5ce6] text-white hover:bg-[#ad6ef8] transition-all"
            >
              ← Try Again
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function IntelligencePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg-primary flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#9d5ce6] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <IntelligencePageContent />
    </Suspense>
  );
}
