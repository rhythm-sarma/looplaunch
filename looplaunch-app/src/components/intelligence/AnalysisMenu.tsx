"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { CalendarDays, ChevronDown, Clapperboard, Clock, Download, Hash, LogOut, Mail, Menu, Network, Newspaper, Plus, Settings, Timer, UserRound, X } from "lucide-react";
import { Avatar } from "@/components/auth/Avatar";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";
import { FIELD } from "@/components/ui/fields";
import { MiniTick } from "@/components/ui/MiniTick";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { profileOf } from "@/lib/auth/profile";
import { useAuthUser } from "@/lib/auth/use-auth-user";
import type { CalendarSettingsData } from "@/lib/calendar/types";
import type { ContentTool } from "@/lib/intelligence/types";
import { DEFAULT_PLAN_HOUR, PLAN_SEND_HOURS, hourLabel, type PlanEmailData } from "@/lib/plan-email/plan";
import { toast } from "@/lib/toast";
import { SIDEBAR_WIDTH, WIDE_QUERY, useIsWide, useMenuDocked } from "./menu-docked";

export interface StrategyAnswer {
  /** Index of the answer in the conversation */
  index: number;
  /** "7-day strategy", "14-day strategy" */
  label: string;
}

interface AnalysisMenuProps {
  sessionId: string;
  companyName: string;
  /** The strategies on this page, oldest first. The newest is the one emailed and mapped. */
  strategies: StrategyAnswer[];
  /** Index of the answer whose PDF is being made, if any */
  pdfIndex: number | null;
  /** Index of the answer whose PDF was just saved: its row shows the green tick for a moment */
  pdfDoneIndex?: number | null;
  onDownloadPdf: (index: number) => void;
  onOpenMindMap: (index: number) => void;
  /** Signed out: show the page's login prompt */
  onNeedLogin: () => void;
  /** Opens the content tools window at one tool */
  onOpenContent: (tool: ContentTool) => void;
  /** The analysis is finished, so the content tools can run */
  contentReady: boolean;
  /** The country the analysis searched ("India") */
  country?: string;
}

const noopSubscribe = () => () => {};
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const LIST: Variants = { open: { transition: { staggerChildren: 0.035, delayChildren: 0.08 } }, closed: {} };
const ROW: Variants = {
  closed: { opacity: 0, x: -8 },
  open: { opacity: 1, x: 0, transition: { duration: 0.22, ease: EASE_OUT } },
};

const ITEM =
  "group w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer hover:bg-[#1C1C21] disabled:cursor-default disabled:hover:bg-transparent";
const ICON =
  "w-4 h-4 mt-0.5 shrink-0 text-[#8B8B94] group-hover:text-[#D4D4D8] group-disabled:group-hover:text-[#8B8B94] transition-[color,translate,rotate,scale] duration-200";
// Each icon reacts its own way when its row is pointed at (never on a disabled row).
const NUDGE = {
  download: "group-hover:translate-y-[2px] group-disabled:translate-y-0",
  mail: "group-hover:-rotate-12 group-disabled:rotate-0",
  map: "group-hover:scale-115 group-disabled:scale-100",
  plus: "group-hover:rotate-90",
  clock: "group-hover:-rotate-45",
  user: "group-hover:-translate-y-[2px]",
  settings: "group-hover:rotate-90 duration-500",
  logout: "group-hover:translate-x-[2px]",
  timer: "group-hover:rotate-12 group-disabled:rotate-0",
  videos: "group-hover:-rotate-6 group-hover:scale-110 group-disabled:rotate-0 group-disabled:scale-100",
  news: "group-hover:-translate-y-[2px] group-disabled:translate-y-0",
  hash: "group-hover:rotate-12 group-disabled:rotate-0",
};

function ItemText({ title, detail, muted }: { title: ReactNode; detail?: ReactNode; muted?: boolean }) {
  return (
    <span className="flex-1 min-w-0">
      <span className={`block text-[14px] font-medium ${muted ? "text-[#8B8B94]" : "text-[#F4F4F5]"}`}>{title}</span>
      {detail && <span className="block mt-0.5 text-[13px] leading-snug text-[#8B8B94]">{detail}</span>}
    </span>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="px-3 pt-1 pb-1.5 text-[12px] font-medium text-[#71717A] truncate">{children}</p>;
}

/** The person's daily-email and calendar state, for the menu. Never throws. */
async function loadMenuState(): Promise<{ plan: PlanEmailData; calendar: CalendarSettingsData | null }> {
  const get = async <T,>(url: string): Promise<T | null> => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      return res.ok ? ((await res.json()) as T) : null;
    } catch {
      return null;
    }
  };
  const [plan, calendar] = await Promise.all([get<PlanEmailData>("/api/plan-email"), get<CalendarSettingsData>("/api/calendar/settings")]);
  return { plan: plan ?? { available: false, subscription: null }, calendar };
}

/**
 * The ☰ menu of an analysis: what you can do with this plan (PDF, daily emails, Google Calendar,
 * mind map), getting around, and your account at the bottom.
 * Wide screens: a sidebar beside the chat, open at first; ☰ closes and reopens it (remembered).
 * Phones and small laptops: ☰ slides it over the page.
 */
export function AnalysisMenu({
  sessionId,
  companyName,
  strategies,
  pdfIndex,
  pdfDoneIndex = null,
  onDownloadPdf,
  onOpenMindMap,
  onNeedLogin,
  onOpenContent,
  contentReady,
  country,
}: AnalysisMenuProps) {
  const router = useRouter();
  const user = useAuthUser();
  const reduce = useReducedMotion();
  const [docked, setDocked] = useMenuDocked();
  const wide = useIsWide();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Portalled to <body>, so neither the sticky header nor a page transition can trap the fixed panels.
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const profile = user ? profileOf(user) : null;
  const latest = strategies[strategies.length - 1];
  const sidebarShown = wide && docked;
  const drawerShown = drawerOpen && !wide;

  // What the server says about this person's daily emails and calendar.
  const [plan, setPlan] = useState<PlanEmailData | null>(null);
  const [calendar, setCalendar] = useState<CalendarSettingsData | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [sendHour, setSendHour] = useState(DEFAULT_PLAN_HOUR);
  const [busy, setBusy] = useState<"start" | "stop" | null>(null);
  // Daily emails just switched on: the envelope becomes the green tick for a moment.
  const [justStarted, setJustStarted] = useState(false);

  const userId = user?.id;
  // The sidebar is on screen from the start, so it loads as soon as we know who's here.
  useEffect(() => {
    if (!userId || !sidebarShown) return;
    let live = true;
    loadMenuState().then((s) => {
      if (!live) return;
      setPlan(s.plan);
      setCalendar(s.calendar);
    });
    return () => {
      live = false;
    };
  }, [userId, sidebarShown]);

  const toggle = () => {
    if (window.matchMedia(WIDE_QUERY).matches) {
      setDocked(!docked);
      return;
    }
    setDrawerOpen(true);
    if (user)
      void loadMenuState().then((s) => {
        setPlan(s.plan);
        setCalendar(s.calendar);
      });
  };

  /** After an action that takes over the screen: the slide-over closes, the sidebar stays. */
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setEmailOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!drawerShown) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeDrawer();
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => closeRef.current?.focus(), 50);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [drawerShown, closeDrawer]);

  const needLogin = () => {
    closeDrawer();
    onNeedLogin();
  };

  // ─── Daily plan email ───
  const subscription = plan?.subscription ?? null;
  const onThisPlan = subscription?.sessionId === sessionId;

  const startEmails = async () => {
    setBusy("start");
    try {
      const res = await fetch("/api/plan-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, sendHour, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      const json = (await res.json().catch(() => ({}))) as { subscription?: PlanEmailData["subscription"]; error?: string };
      if (!res.ok || !json.subscription) {
        toast("Daily emails didn't start", { description: json.error || "Please try again in a minute.", tone: "error" });
        return;
      }
      setPlan({ available: true, subscription: json.subscription });
      setEmailOpen(false);
      setJustStarted(true);
      window.setTimeout(() => setJustStarted(false), 2600);
      toast("Day 1 is in your inbox", {
        description: `Check ${profile?.email ?? "your email"}. Day 2 arrives tomorrow at ${hourLabel(sendHour)}.`,
        tone: "success",
      });
    } finally {
      setBusy(null);
    }
  };

  const stopEmails = async () => {
    setBusy("stop");
    try {
      const res = await fetch("/api/plan-email/stop", { method: "POST" });
      if (!res.ok) {
        toast("Couldn't stop them", { description: "Please try again.", tone: "error" });
        return;
      }
      setPlan((p) => (p ? { ...p, subscription: null } : p));
      toast("Daily emails stopped", { description: "You won't get any more plan emails." });
    } finally {
      setBusy(null);
    }
  };

  const emailDetail = (): ReactNode => {
    if (!user) return "Log in to get each day's step by email.";
    if (!latest) return "Once your 7-day strategy is ready.";
    if (!plan) return "Checking…";
    if (!plan.available) return "Coming soon.";
    if (onThisPlan && subscription?.status === "active")
      return `Day ${subscription.sentSteps + 1} of ${subscription.totalSteps} arrives at ${hourLabel(subscription.sendHour)}.`;
    if (onThisPlan && subscription?.status === "done") return `All ${subscription.totalSteps} days sent. Start again?`;
    if (subscription?.status === "active") return `On for ${subscription.company}. Switch to this plan?`;
    return "Today's step in your inbox each morning.";
  };
  const emailOn = onThisPlan && subscription?.status === "active";
  const emailDisabled = Boolean(user) && (!latest || !plan?.available);

  // ─── Google Calendar ───
  // Until Google verifies the app (GOOGLE_CALENDAR_LAUNCH=on), the server reports it unavailable: "Coming soon".
  const calendarItem = (): { title: string; detail: string; href?: string; disabled?: boolean; soon?: boolean } => {
    if (!user) return { title: "Google Calendar", detail: "Your day's meetings in a morning email.", disabled: true, soon: true };
    if (!calendar) return { title: "Google Calendar", detail: "Checking…", disabled: true };
    if (!calendar.available) return { title: "Google Calendar", detail: "Your day's meetings in a morning email.", disabled: true, soon: true };
    if (calendar.connection?.status === "reconnect")
      return { title: "Reconnect Google Calendar", detail: "Google stopped sharing your calendar.", href: "/api/calendar/connect" };
    if (calendar.connection)
      return { title: "Google Calendar connected", detail: calendar.connection.googleEmail ?? "Manage it in Settings.", href: "/profile#settings-calendar" };
    return { title: "Connect Google Calendar", detail: "Your day's meetings in a morning email.", href: "/api/calendar/connect" };
  };
  const cal = calendarItem();

  const signOut = async () => {
    closeDrawer();
    await createSupabaseBrowserClient().auth.signOut();
    router.push("/");
    router.refresh();
  };

  /** Everything in the menu below its top bar: the same in the sidebar and the slide-over. */
  const body = (
    <>
      <motion.div className="flex-1 overflow-y-auto overscroll-contain px-2 py-3" variants={LIST} initial={reduce ? false : "closed"} animate="open">
        {/* ─── This plan ─── */}
        <SectionLabel>Your plan for {companyName}</SectionLabel>

        {strategies.length === 0 ? (
          <motion.div variants={ROW}>
            <button type="button" disabled className={ITEM}>
              <Download className={ICON} aria-hidden="true" />
              <ItemText title="Download PDF" detail="Once your 7-day strategy is ready." muted />
            </button>
          </motion.div>
        ) : (
          strategies.map((s) => (
            <motion.div key={s.index} variants={ROW}>
              <button
                type="button"
                onClick={() => (user ? onDownloadPdf(s.index) : needLogin())}
                disabled={pdfIndex !== null}
                aria-busy={pdfIndex === s.index}
                className={ITEM}
              >
                {pdfIndex === s.index ? (
                  <span className="w-4 h-4 mt-0.5 shrink-0 border-2 border-[#B4B4BC] border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                ) : pdfDoneIndex === s.index ? (
                  <MiniTick size={16} className="mt-0.5" />
                ) : (
                  <Download className={`${ICON} ${NUDGE.download}`} aria-hidden="true" />
                )}
                <ItemText
                  title={pdfIndex === s.index ? "Making your PDF…" : pdfDoneIndex === s.index ? "Downloaded" : "Download PDF"}
                  detail={strategies.length > 1 ? `Your ${s.label}` : `Your ${s.label}, with its mind map`}
                />
              </button>
            </motion.div>
          ))
        )}

        {/* Daily plan email */}
        <motion.div variants={ROW}>
          {emailOn ? (
            <motion.div
              key="email-on"
              className="flex items-start gap-3 px-3 pt-2.5 pb-1"
              initial={justStarted && !reduce ? { opacity: 0, y: -4 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
            >
              {justStarted ? <MiniTick size={16} className="mt-0.5" /> : <Mail className="w-4 h-4 mt-0.5 shrink-0 text-[#34D399]" aria-hidden="true" />}
              <ItemText title={justStarted ? "Day 1 is on its way" : "Daily emails are on"} detail={emailDetail()} />
            </motion.div>
          ) : (
            <button
              type="button"
              onClick={() => (user ? setEmailOpen((o) => !o) : needLogin())}
              disabled={emailDisabled}
              aria-expanded={user ? emailOpen : undefined}
              className={ITEM}
            >
              <Mail className={`${ICON} ${NUDGE.mail}`} aria-hidden="true" />
              <ItemText title="Email me each day's step" detail={emailDetail()} muted={emailDisabled} />
              {user && !emailDisabled && (
                <ChevronDown
                  className={`w-4 h-4 mt-0.5 shrink-0 text-[#71717A] transition-transform duration-200 ${emailOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              )}
            </button>
          )}
          {emailOn && (
            <div className="pl-10 pr-3 pb-2">
              <button
                type="button"
                onClick={stopEmails}
                disabled={busy !== null}
                className="text-[13px] text-[#B4B4BC] hover:text-white underline underline-offset-2 cursor-pointer disabled:opacity-60"
              >
                {busy === "stop" ? "Stopping…" : "Stop daily emails"}
              </button>
            </div>
          )}

          <AnimatePresence initial={false}>
            {emailOpen && !emailOn && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.24, ease: EASE_OUT }}
                className="overflow-hidden"
              >
                <div className="mx-3 mb-2 mt-1 rounded-xl bg-[#141418] border border-[#1F1F24] p-3.5">
                  <p className="text-[13px] leading-relaxed text-[#B4B4BC]">
                    Every morning for 7 days: that day&apos;s step with exactly how to do it, sent to{" "}
                    <span className="text-[#F4F4F5] break-all">{profile?.email}</span>. Day 1 arrives right away.
                  </p>
                  <label htmlFor={`plan-email-hour-${sidebarShown ? "side" : "drawer"}`} className="block mt-3 mb-1.5 text-[13px] font-medium text-[#D4D4D8]">
                    Send it at
                  </label>
                  <div className="relative">
                    <select
                      id={`plan-email-hour-${sidebarShown ? "side" : "drawer"}`}
                      value={sendHour}
                      onChange={(e) => setSendHour(Number(e.target.value))}
                      className={`${FIELD} h-10 pr-10 appearance-none cursor-pointer`}
                    >
                      {PLAN_SEND_HOURS.map((h) => (
                        <option key={h} value={h}>
                          {hourLabel(h)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B8B94]" aria-hidden="true" />
                  </div>
                  <button
                    type="button"
                    onClick={startEmails}
                    disabled={busy !== null}
                    className="mt-3 w-full h-10 rounded-full bg-[#F4F4F5] text-[#09090B] text-[14px] font-semibold hover:bg-white active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-progress cursor-pointer"
                  >
                    {busy === "start" ? "Writing your day 1 guide…" : subscription?.status === "active" && !onThisPlan ? "Switch to this plan" : "Start daily emails"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Google Calendar */}
        <motion.div variants={ROW}>
          {cal.href && user ? (
            <a href={cal.href} onClick={() => setDrawerOpen(false)} className={ITEM}>
              <CalendarDays className={`${ICON} ${calendar?.connection?.status === "active" ? "text-[#34D399] group-hover:text-[#34D399]" : ""}`} aria-hidden="true" />
              <ItemText title={cal.title} detail={cal.detail} />
            </a>
          ) : (
            <button type="button" disabled={cal.disabled} className={ITEM}>
              <CalendarDays className={ICON} aria-hidden="true" />
              <ItemText
                title={
                  cal.soon ? (
                    <span className="flex items-center gap-2">
                      {cal.title}
                      <span className="shrink-0 rounded-full bg-[#1C1C21] border border-[#27272A] px-2 py-px text-[11px] font-medium text-[#B4B4BC]">
                        Coming soon
                      </span>
                    </span>
                  ) : (
                    cal.title
                  )
                }
                detail={cal.detail}
                muted={cal.disabled}
              />
            </button>
          )}
        </motion.div>

        {/* Mind map */}
        <motion.div variants={ROW}>
          <button
            type="button"
            onClick={() => {
              if (!latest) return;
              closeDrawer();
              onOpenMindMap(latest.index);
            }}
            disabled={!latest}
            className={ITEM}
          >
            <Network className={`${ICON} ${NUDGE.map}`} aria-hidden="true" />
            <ItemText title="See the mind map" detail={latest ? "Your plan at a glance." : "Once your 7-day strategy is ready."} muted={!latest} />
          </button>
        </motion.div>

        <div className="h-px bg-[#1C1C21] mx-3 my-3" aria-hidden="true" />

        {/* ─── Content tools (SerpApi: Trends, YouTube, News, Autocomplete) ─── */}
        <SectionLabel>Content tools</SectionLabel>
        {(
          [
            { id: "time", icon: Timer, nudge: NUDGE.timer, title: "Best time to post", detail: `When people${country ? ` in ${country}` : ""} search for what you sell.` },
            { id: "videos", icon: Clapperboard, nudge: NUDGE.videos, title: "Reference videos", detail: "Shorts and videos getting views now." },
            { id: "news", icon: Newspaper, nudge: NUDGE.news, title: "News hooks", detail: "This month's news, turned into posts." },
            { id: "keywords", icon: Hash, nudge: NUDGE.hash, title: "Caption keywords", detail: "What people type, for captions and hashtags." },
          ] as const
        ).map((t) => (
          <motion.div key={t.id} variants={ROW}>
            <button
              type="button"
              onClick={() => {
                if (!user) return needLogin();
                closeDrawer();
                onOpenContent(t.id);
              }}
              disabled={Boolean(user) && !contentReady}
              className={ITEM}
            >
              <t.icon className={`${ICON} ${t.nudge}`} aria-hidden="true" />
              <ItemText title={t.title} detail={contentReady || !user ? t.detail : "Once your analysis is ready."} muted={Boolean(user) && !contentReady} />
            </button>
          </motion.div>
        ))}

        <div className="h-px bg-[#1C1C21] mx-3 my-3" aria-hidden="true" />

        {/* ─── Getting around ─── */}
        <motion.div variants={ROW}>
          <Link href="/new" onClick={() => setDrawerOpen(false)} className={ITEM}>
            <Plus className={`${ICON} ${NUDGE.plus}`} aria-hidden="true" />
            <ItemText title="New analysis" />
          </Link>
        </motion.div>
        {user && (
          <motion.div variants={ROW}>
            <Link href="/history" onClick={() => setDrawerOpen(false)} className={ITEM}>
              <Clock className={`${ICON} ${NUDGE.clock}`} aria-hidden="true" />
              <ItemText title="History" />
            </Link>
          </motion.div>
        )}
      </motion.div>

      {/* ─── Bottom: the account ─── */}
      <div className="shrink-0 border-t border-[#1C1C21] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {profile ? (
          <>
            <div className="flex items-center gap-3 px-3 pt-2 pb-2.5">
              <Avatar profile={profile} size={36} />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-[#F4F4F5] truncate">{profile.name}</p>
                <p className="text-[13px] text-[#8B8B94] truncate">{profile.email}</p>
              </div>
            </div>
            <Link href="/profile#settings-profile" onClick={() => setDrawerOpen(false)} className={`${ITEM} py-2`}>
              <UserRound className={`${ICON} ${NUDGE.user}`} aria-hidden="true" />
              <ItemText title="Profile" />
            </Link>
            <Link href="/profile" onClick={() => setDrawerOpen(false)} className={`${ITEM} py-2`}>
              <Settings className={`${ICON} ${NUDGE.settings}`} aria-hidden="true" />
              <ItemText title="Settings" />
            </Link>
            <button type="button" onClick={signOut} className={`${ITEM} py-2`}>
              <LogOut className={`${ICON} ${NUDGE.logout}`} aria-hidden="true" />
              <ItemText title="Log out" />
            </button>
          </>
        ) : (
          <div className="p-2">
            <Link
              href={`/login?next=${encodeURIComponent(`/intelligence?session=${sessionId}`)}`}
              className="flex items-center justify-center w-full h-10 rounded-full bg-[#F4F4F5] text-[#09090B] text-[14px] font-semibold hover:bg-white active:scale-[0.98] transition"
            >
              Log in
            </Link>
            <p className="mt-2 text-center text-[12px] text-[#8B8B94]">To save this plan and get it by email.</p>
          </div>
        )}
      </div>
    </>
  );

  /** Wide screens: beside the chat, under the header. The page makes room for it (see useMenuDocked). */
  const sidebar = (
    <AnimatePresence initial={false}>
      {sidebarShown && (
        <motion.aside
          key="analysis-sidebar"
          id="analysis-menu"
          aria-label="Menu"
          data-lenis-prevent
          className="fixed z-30 left-0 top-14 bottom-0 flex flex-col bg-[#09090B] border-r border-[#1C1C21]"
          style={{ width: SIDEBAR_WIDTH }}
          initial={{ x: reduce ? 0 : -SIDEBAR_WIDTH, opacity: reduce ? 0 : 1 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: reduce ? 0 : -SIDEBAR_WIDTH, opacity: reduce ? 0 : 1 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
        >
          {body}
        </motion.aside>
      )}
    </AnimatePresence>
  );

  /** Phones and small laptops: over the page, with its own close button. */
  const drawer = (
    <AnimatePresence>
      {drawerShown && (
        <motion.div
          key="analysis-menu-scrim"
          className="fixed inset-0 z-60 bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.2 } }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}
      {drawerShown && (
        <motion.nav
          key="analysis-menu-panel"
          id="analysis-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          data-lenis-prevent
          className="fixed z-60 left-0 top-0 bottom-0 w-[min(340px,88vw)] flex flex-col bg-[#0E0E11] border-r border-[#1F1F24] shadow-[16px_0_48px_rgba(0,0,0,0.5)]"
          initial={{ x: reduce ? 0 : "-100%", opacity: reduce ? 0 : 1 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: reduce ? 0 : "-100%", opacity: reduce ? 0 : 1, transition: { duration: 0.2, ease: [0.55, 0.055, 0.675, 0.19] } }}
          transition={{ type: "spring", stiffness: 380, damping: 38 }}
        >
          <div className="flex items-center justify-between gap-3 h-14 px-4 border-b border-[#1C1C21] shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <LoopyMascot size={26} mood="still" />
              <span className="text-[14px] font-semibold text-[#F4F4F5] truncate">Loop Launch</span>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={closeDrawer}
              aria-label="Close menu"
              className="w-9 h-9 -mr-1.5 rounded-full flex items-center justify-center text-[#8B8B94] hover:text-white hover:bg-[#1C1C21] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {body}
        </motion.nav>
      )}
    </AnimatePresence>
  );

  const expanded = wide ? docked : drawerOpen;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup={wide ? undefined : "dialog"}
        aria-expanded={expanded}
        aria-controls="analysis-menu"
        aria-label={wide ? (docked ? "Close menu" : "Open menu") : "Open menu"}
        title={wide ? (docked ? "Close menu" : "Open menu") : undefined}
        className={`w-9 h-9 -ml-2 shrink-0 rounded-full flex items-center justify-center hover:text-[#F4F4F5] hover:bg-[#1C1C21] active:scale-95 transition cursor-pointer ${
          wide && docked ? "text-[#F4F4F5]" : "text-[#B4B4BC]"
        }`}
      >
        <Menu className="w-5 h-5" />
      </button>
      {isClient &&
        createPortal(
          <>
            {sidebar}
            {drawer}
          </>,
          document.body
        )}
    </>
  );
}
