"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Clapperboard, Copy, ExternalLink, Hash, Minus, Newspaper, Play, RotateCcw, Sparkles, Timer, TrendingDown, TrendingUp, X } from "lucide-react";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";
import LatticeLoader from "@/components/reactbits/LatticeLoader";
import { MiniTick } from "@/components/ui/MiniTick";
import type { ContentIntel, ContentTool } from "@/lib/intelligence/types";

/**
 * The ☰ menu's content tools for one analysis, in one window with a tab per tool:
 * best time to post (Google Trends), reference videos (YouTube), news hooks (Google News +
 * Loopy) and caption keywords (Trends related searches + autocomplete). Older analyses
 * collect the data the first time this opens (src/app/api/intelligence/content).
 */

export const CONTENT_TOOLS: Array<{ id: ContentTool; label: string; icon: typeof Timer }> = [
  { id: "time", label: "Best time to post", icon: Timer },
  { id: "videos", label: "Reference videos", icon: Clapperboard },
  { id: "news", label: "News hooks", icon: Newspaper },
  { id: "keywords", label: "Caption keywords", icon: Hash },
];

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const PURPLE = "#8B5CF6";
const SLIDE = { type: "spring", stiffness: 500, damping: 40 } as const;

const hourName = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
const compact = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

function zoneLabel(timeZone: string): string {
  if (timeZone === "Asia/Kolkata") return "India time";
  try {
    return new Intl.DateTimeFormat("en", { timeZone, timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

function ago(iso?: string): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** A list item that rises in after the ones above it. */
function Rise({ i, children, className = "" }: { i: number; children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + i * 0.045, duration: 0.32, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/** Copy text; the button shows the green tick for a moment. */
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((k) => (k === key ? null : k)), 1600);
    } catch {
      /* the clipboard was blocked: nothing to show */
    }
  }, []);
  return { copied, copy };
}

const SMALL_BUTTON =
  "group inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[#1C1C21] hover:bg-[#232329] text-[13px] text-[#D4D4D8] hover:text-[#F4F4F5] active:scale-[0.97] transition cursor-pointer";

function CopyButton({ id, text, label = "Copy", copied, onCopy }: { id: string; text: string; label?: string; copied: string | null; onCopy: (id: string, text: string) => void }) {
  const done = copied === id;
  return (
    <button type="button" onClick={() => onCopy(id, text)} className={SMALL_BUTTON} aria-label={done ? "Copied" : label}>
      {done ? <MiniTick size={14} /> : <Copy className="w-3.5 h-3.5 text-[#B4B4BC]" aria-hidden="true" />}
      <span className={done ? "text-[#34D399]" : ""}>{done ? "Copied" : label}</span>
    </button>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[14px] font-semibold text-[#F4F4F5]">{title}</h3>
        {hint && <span className="text-[12px] text-[#8B8B94] text-right">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-[#17171B] px-4 py-3 text-[13px] leading-relaxed text-[#B4B4BC]">{children}</p>;
}

// ─── Best time to post ───

function BestTime({ data }: { data: ContentIntel }) {
  const reduce = useReducedMotion();
  const t = data.bestTime;
  if (!t) return <Empty>Google Trends doesn&apos;t have enough searches for &ldquo;{data.term}&rdquo; to show a pattern yet.</Empty>;
  const where = data.country === "India" ? "in India" : `in ${data.country}`;
  const inWindow = (h: number) => (t.bestWindow ? (h - t.bestWindow.start + 24) % 24 < 3 : false);
  const maxMonth = Math.max(...t.months.map((m) => m.value), 1);
  const Trend = t.trend === "rising" ? TrendingUp : t.trend === "falling" ? TrendingDown : Minus;
  const trendText =
    t.trend === "rising"
      ? "More people are searching than 3 months ago: a good time to post more."
      : t.trend === "falling"
        ? "Fewer people are searching than 3 months ago. Posts that answer a real question work best in quiet months."
        : "About as many people are searching as 3 months ago.";

  return (
    <div className="space-y-7">
      {t.bestWindow ? (
        <Rise i={0} className="rounded-2xl bg-[#17171B] border border-[#27272A] p-5">
          <p className="text-[12px] font-medium uppercase tracking-wide text-[#A78BFA]">Best hours</p>
          <p className="mt-1 text-[28px] leading-tight font-semibold text-[#F4F4F5]">
            {hourName(t.bestWindow.start)} to {hourName(t.bestWindow.end)}
            <span className="ml-2 text-[14px] font-medium text-[#8B8B94]">{zoneLabel(data.timeZone)}</span>
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#B4B4BC]">
            When people {where} search for {data.term}, from the last 7 days. Post 30 to 60 minutes before {hourName(t.bestWindow.start)}, so your post is new
            when they look.
          </p>
          {t.bestDays && t.bestDays.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-[#8B8B94]">Busiest days</span>
              {t.bestDays.map((d) => (
                <span key={d} className="rounded-full bg-[#8B5CF6]/15 text-[#C4B5FD] px-2.5 py-0.5 text-[13px] font-medium">
                  {d}
                </span>
              ))}
            </div>
          )}
          {t.hours && (
            <div className="mt-5" aria-label="Search interest by hour of the day">
              <div className="flex items-end gap-[3px] h-16">
                {t.hours.map((v, h) => (
                  <motion.span
                    key={h}
                    title={`${hourName(h)}: ${v}`}
                    className="flex-1 rounded-t-[3px]"
                    style={{ height: `${Math.max(4, v)}%`, background: inWindow(h) ? PURPLE : "#3F3F46", transformOrigin: "bottom" }}
                    initial={reduce ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: 0.15 + h * 0.012, duration: 0.4, ease: EASE_OUT }}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-[#71717A]">
                <span>12 AM</span>
                <span>6 AM</span>
                <span>12 PM</span>
                <span>6 PM</span>
                <span>11 PM</span>
              </div>
            </div>
          )}
        </Rise>
      ) : (
        <Empty>Too few searches in the last 7 days to tell the best hours. The months below still show the busy season.</Empty>
      )}

      <Rise i={1}>
        <Section title="Busiest months" hint="Last 12 months">
          <div className="flex items-end gap-1.5 h-32" aria-label="Search interest by month">
            {t.months.map((m, i) => {
              const peak = t.peakMonths.includes(m.label);
              return (
                <div key={m.key} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <motion.span
                    title={`${m.label}: ${m.value}`}
                    className="w-full rounded-t-md"
                    style={{ height: `${Math.max(4, (m.value / maxMonth) * 100)}%`, background: peak ? PURPLE : "#3F3F46", transformOrigin: "bottom" }}
                    initial={reduce ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: 0.25 + i * 0.04, duration: 0.45, ease: EASE_OUT }}
                  />
                  <span className={`text-[11px] ${peak ? "text-[#C4B5FD] font-semibold" : "text-[#71717A]"}`}>{m.label}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[14px] leading-relaxed text-[#B4B4BC]">
            Busiest in <span className="text-[#F4F4F5] font-medium">{t.peakMonths.join(" and ")}</span>: plan launches and offers for those months.
          </p>
          <p className="flex items-start gap-2 text-[14px] leading-relaxed text-[#B4B4BC]">
            <Trend className="w-4 h-4 mt-[3px] shrink-0 text-[#A78BFA]" aria-hidden="true" />
            {trendText}
          </p>
        </Section>
      </Rise>

      <p className="text-[12px] text-[#71717A]">
        From Google Trends for &ldquo;{data.term}&rdquo; {where}, {dateLabel(data.collectedAt)}. This is when people search, not when your followers are online.
      </p>
    </div>
  );
}

// ─── Reference videos ───

function Videos({ data, onAsk, company }: { data: ContentIntel; onAsk: (prompt: string) => void; company: string }) {
  if (!data.videos.length) return <Empty>YouTube didn&apos;t return videos for &ldquo;{data.term}&rdquo; this time.</Empty>;
  return (
    <div className="space-y-4">
      <p className="text-[14px] leading-relaxed text-[#B4B4BC]">
        Shorts and videos about {data.term} that people are watching on YouTube right now. Look at the first 3 seconds and the title: that&apos;s what earned the views.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.videos.map((v, i) => (
          <Rise key={v.link} i={i} className="rounded-2xl bg-[#17171B] border border-[#27272A] overflow-hidden flex flex-col">
            <a href={v.link} target="_blank" rel="noopener noreferrer" className="group block relative aspect-video bg-[#0E0E11] overflow-hidden">
              {v.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.thumbnail} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
              )}
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="w-11 h-11 rounded-full bg-black/60 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                  <Play className="w-5 h-5 text-white fill-white ml-0.5" aria-hidden="true" />
                </span>
              </span>
              <span className="absolute left-2 top-2 flex gap-1.5">
                {v.isShort && <span className="rounded-md bg-[#8B5CF6] px-1.5 py-0.5 text-[11px] font-semibold text-white">Short</span>}
              </span>
              {v.length && <span className="absolute right-2 bottom-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums">{v.length}</span>}
            </a>
            <div className="p-3.5 flex flex-col gap-2 flex-1">
              <a href={v.link} target="_blank" rel="noopener noreferrer" className="text-[14px] font-medium leading-snug text-[#F4F4F5] hover:underline line-clamp-2">
                {v.title}
              </a>
              <p className="text-[12px] text-[#8B8B94]">
                {[v.channel, v.views !== undefined ? `${compact(v.views)} views` : "", v.published].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-auto pt-1">
                <button
                  type="button"
                  className={SMALL_BUTTON}
                  onClick={() =>
                    onAsk(
                      `Write a reel script for ${company} inspired by this ${v.isShort ? "Short" : "video"} that's getting views on YouTube: "${v.title}". Keep what makes it work (the hook, the pace), but make it about what we sell.`
                    )
                  }
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" aria-hidden="true" />
                  Make one like this
                </button>
              </div>
            </div>
          </Rise>
        ))}
      </div>
      <p className="text-[12px] text-[#71717A]">From a YouTube search for &ldquo;{data.term}&rdquo;, {dateLabel(data.collectedAt)}.</p>
    </div>
  );
}

// ─── News hooks ───

function News({ data, onAsk, company, copied, onCopy }: { data: ContentIntel; onAsk: (prompt: string) => void; company: string; copied: string | null; onCopy: (id: string, text: string) => void }) {
  if (!data.news.length) return <Empty>No news about &ldquo;{data.term}&rdquo; in the last 30 days.</Empty>;
  return (
    <div className="space-y-4">
      <p className="text-[14px] leading-relaxed text-[#B4B4BC]">
        What&apos;s in the news about {data.term} this month, and how {company} can post about it while people are still talking about it.
      </p>
      <div className="space-y-3">
        {data.news.map((n, i) => (
          <Rise key={n.link} i={i} className="rounded-2xl bg-[#17171B] border border-[#27272A] p-4">
            <p className="text-[12px] text-[#8B8B94]">{[n.source, ago(n.publishedAt)].filter(Boolean).join(" · ")}</p>
            <a href={n.link} target="_blank" rel="noopener noreferrer" className="group mt-1 inline-flex items-start gap-1.5 text-[15px] font-medium leading-snug text-[#F4F4F5] hover:underline">
              {n.title}
              <ExternalLink className="w-3.5 h-3.5 mt-1 shrink-0 text-[#71717A] transition-transform duration-200 group-hover:translate-x-[2px] group-hover:-translate-y-[2px]" aria-hidden="true" />
            </a>
            {n.hook && (
              <div className="mt-3 rounded-xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/25 px-3.5 py-3">
                <p className="text-[12px] font-semibold text-[#C4B5FD]">Post idea</p>
                <p className="mt-0.5 text-[14px] leading-relaxed text-[#E4E4E7]">{n.hook}</p>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={SMALL_BUTTON}
                onClick={() =>
                  onAsk(`Write an Instagram post for ${company} based on this news: "${n.title}"${n.source ? ` (${n.source})` : ""}.${n.hook ? ` The angle: ${n.hook}` : ""}`)
                }
              >
                <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" aria-hidden="true" />
                Ask Loopy to write this post
              </button>
              {n.hook && <CopyButton id={`hook-${i}`} text={n.hook} label="Copy idea" copied={copied} onCopy={onCopy} />}
            </div>
          </Rise>
        ))}
      </div>
      <p className="text-[12px] text-[#71717A]">From Google News, {dateLabel(data.collectedAt)}. Post ideas are Loopy&apos;s.</p>
    </div>
  );
}

// ─── Caption keywords ───

function Keywords({ data, copied, onCopy }: { data: ContentIntel; copied: string | null; onCopy: (id: string, text: string) => void }) {
  if (!data.keywords.length && !data.captions.length) return <Empty>Google didn&apos;t return search phrases for &ldquo;{data.term}&rdquo; this time.</Empty>;
  const tags = data.hashtags.join(" ");
  return (
    <div className="space-y-7">
      {data.keywords.length > 0 && (
        <Rise i={0}>
          <Section title="What people search" hint="Tap one to copy it">
            <div className="flex flex-wrap gap-2">
              {data.keywords.map((k, i) => {
                const id = `kw-${i}`;
                const done = copied === id;
                return (
                  <motion.button
                    key={k.phrase}
                    type="button"
                    onClick={() => onCopy(id, k.phrase)}
                    className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] transition-colors cursor-pointer ${
                      done ? "bg-[#34D399]/15 text-[#34D399]" : "bg-[#1C1C21] hover:bg-[#232329] text-[#E4E4E7]"
                    }`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ delay: 0.08 + i * 0.03, type: "spring", duration: 0.35, bounce: 0.3 }}
                  >
                    {done && <MiniTick size={14} />}
                    {k.phrase}
                    {k.rising && !done && (
                      <span className="rounded-full bg-[#8B5CF6]/20 text-[#C4B5FD] px-1.5 text-[11px] font-semibold">{k.rising === "Breakout" ? "New" : k.rising}</span>
                    )}
                  </motion.button>
                );
              })}
            </div>
            <p className="text-[13px] text-[#8B8B94]">From Google Trends related searches and Google autocomplete. Purple tags are growing fast.</p>
          </Section>
        </Rise>
      )}

      {data.hashtags.length > 0 && (
        <Rise i={1}>
          <Section title="Hashtags">
            <div className="rounded-xl bg-[#17171B] border border-[#27272A] px-4 py-3 text-[14px] leading-relaxed text-[#C4B5FD] break-words">{tags}</div>
            <CopyButton id="hashtags" text={tags} label="Copy all as hashtags" copied={copied} onCopy={onCopy} />
          </Section>
        </Rise>
      )}

      {data.captions.length > 0 && (
        <Rise i={2}>
          <Section title="Example captions" hint="Written by Loopy">
            <div className="space-y-3">
              {data.captions.map((c, i) => (
                <div key={i} className="rounded-2xl bg-[#17171B] border border-[#27272A] p-4">
                  <p className="text-[14px] leading-relaxed text-[#E4E4E7] whitespace-pre-line">{c}</p>
                  <div className="mt-3">
                    <CopyButton id={`cap-${i}`} text={c} copied={copied} onCopy={onCopy} />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </Rise>
      )}
    </div>
  );
}

// ─── The window ───

interface ContentToolsProps {
  /** The tool to show; null: closed */
  tool: ContentTool | null;
  onToolChange: (tool: ContentTool) => void;
  onClose: () => void;
  sessionId: string;
  companyName: string;
  /** Sends a question to Loopy (the window closes first) */
  onAsk: (prompt: string) => void;
}

type Load = { state: "idle" } | { state: "loading" } | { state: "error"; message: string } | { state: "done"; data: ContentIntel };

export function ContentTools({ tool, onToolChange, onClose, sessionId, companyName, onAsk }: ContentToolsProps) {
  const reduce = useReducedMotion();
  const open = tool !== null;
  const [load, setLoad] = useState<Load>({ state: "idle" });
  const loadedFor = useRef<string | null>(null);
  const { copied, copy } = useCopy();

  const fetchContent = useCallback(() => {
    loadedFor.current = sessionId;
    setLoad({ state: "loading" });
    fetch(`/api/intelligence/content?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as { content?: ContentIntel; error?: string };
        if (res.ok && json.content) setLoad({ state: "done", data: json.content });
        else setLoad({ state: "error", message: json.error || "Couldn't load the content tools. Please try again." });
      })
      .catch(() => setLoad({ state: "error", message: "Couldn't reach Loop Launch. Check your connection and try again." }));
  }, [sessionId]);

  // Loads once per analysis, the first time the window opens.
  useEffect(() => {
    if (!open || loadedFor.current === sessionId) return;
    const t = window.setTimeout(fetchContent, 0);
    return () => window.clearTimeout(t);
  }, [open, sessionId, fetchContent]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!tool) return;
    tabsRef.current?.querySelector<HTMLElement>(`[data-tool="${tool}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [tool, reduce]);

  const data = load.state === "done" ? load.data : null;
  const ask = (prompt: string) => {
    onClose();
    onAsk(prompt);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-black/75"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          data-lenis-prevent
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Content tools"
            className="relative w-full max-w-3xl h-full sm:h-auto sm:max-h-full flex flex-col rounded-[20px] bg-[#111114] overflow-hidden"
            initial={reduce ? false : { y: 18, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-[#1F1F24] shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <LoopyMascot size={30} />
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-[#F4F4F5] truncate">Content tools</h2>
                  <p className="text-[13px] leading-snug text-[#B4B4BC] truncate">
                    {data ? `For "${data.term}" on Google ${data.country}` : `For ${companyName}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[#B4B4BC] hover:text-[#F4F4F5] hover:bg-[#1C1C21] transition-colors cursor-pointer"
                aria-label="Close content tools"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* A tab per tool; the white pill slides to the one picked */}
            <div ref={tabsRef} className="px-3 sm:px-5 pt-3 shrink-0 overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label="Content tools">
              <div className="flex gap-1.5 w-max sm:w-auto">
                {CONTENT_TOOLS.map((t) => {
                  const active = tool === t.id;
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      data-tool={t.id}
                      aria-selected={active}
                      onClick={() => onToolChange(t.id)}
                      className={`relative inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                        active ? "text-[#09090B]" : "text-[#B4B4BC] hover:text-[#F4F4F5] hover:bg-[#1C1C21]"
                      }`}
                    >
                      {active && <motion.span layoutId="content-tab" transition={SLIDE} className="absolute inset-0 rounded-full bg-[#F4F4F5]" aria-hidden="true" />}
                      <Icon className="relative w-4 h-4" aria-hidden="true" />
                      <span className="relative">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5">
              {load.state === "loading" || load.state === "idle" ? (
                <div className="py-16 flex flex-col items-center gap-3 text-[#B4B4BC]">
                  <LatticeLoader label="Searching Google, YouTube and the news" pattern="orbit" fontSize={14} />
                  <p className="text-[13px] text-[#8B8B94]">This takes about 15 seconds, once. After that it opens instantly.</p>
                </div>
              ) : load.state === "error" ? (
                <div className="py-14 flex flex-col items-center gap-3 text-center">
                  <p className="text-[14px] text-[#B4B4BC] max-w-sm">{load.message}</p>
                  <button type="button" onClick={fetchContent} className={SMALL_BUTTON}>
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    Try again
                  </button>
                </div>
              ) : (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={tool}
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
                    transition={{ duration: 0.22, ease: EASE_OUT }}
                  >
                    {tool === "time" && <BestTime data={load.data} />}
                    {tool === "videos" && <Videos data={load.data} onAsk={ask} company={companyName} />}
                    {tool === "news" && <News data={load.data} onAsk={ask} company={companyName} copied={copied} onCopy={copy} />}
                    {tool === "keywords" && <Keywords data={load.data} copied={copied} onCopy={copy} />}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
