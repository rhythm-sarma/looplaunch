"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { SettingsSection } from "@/components/profile/SettingsSection";
import { FIELD, LABEL, PRIMARY_INLINE, SECONDARY_INLINE } from "@/components/ui/fields";
import { PLAN_SEND_HOURS, hourLabel, type PlanEmailData } from "@/lib/plan-email/plan";
import { toast } from "@/lib/toast";

/** Settings → Daily plan email: where every plan email's "change the time or stop" link lands. */
export function PlanEmailSettings({ data, accountEmail }: { data: PlanEmailData; accountEmail: string }) {
  const router = useRouter();
  const sub = data.subscription;
  const [sendHour, setSendHour] = useState(sub?.sendHour ?? 8);
  const [busy, setBusy] = useState<"save" | "stop" | null>(null);
  const [error, setError] = useState("");

  const hours = sub && !PLAN_SEND_HOURS.includes(sub.sendHour) ? [...PLAN_SEND_HOURS, sub.sendHour].sort((a, b) => a - b) : PLAN_SEND_HOURS;

  const post = async (path: string, body?: unknown) => {
    const res = await fetch(path, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: res.ok, error: json.error };
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("save");
    setError("");
    const { ok, error: message } = await post("/api/plan-email/settings", { sendHour });
    setBusy(null);
    if (!ok) return setError(message || "Couldn't save. Please try again.");
    toast("Time saved", { description: `Your next step arrives at ${hourLabel(sendHour)}.` });
    router.refresh();
  };

  const stop = async () => {
    setBusy("stop");
    setError("");
    const { ok, error: message } = await post("/api/plan-email/stop");
    setBusy(null);
    if (!ok) return setError(message || "Couldn't stop them. Please try again.");
    toast("Daily emails stopped", { description: "You won't get any more plan emails." });
    router.refresh();
  };

  const planLink = sub ? `/intelligence?session=${encodeURIComponent(sub.sessionId)}` : "/history";

  return (
    <SettingsSection
      id="settings-plan-email"
      title="Daily plan email"
      description="One step of your 7-day plan in your inbox each morning, so you always know what to do today."
    >
      {!data.available ? (
        <p className="text-[14px] leading-6 text-[#B4B4BC]">Coming soon: get each day&apos;s step of your plan by email.</p>
      ) : !sub ? (
        <div>
          <p className="text-[14px] leading-6 text-[#B4B4BC] max-w-[60ch]">
            Open one of your analyses, tap the menu at the top left, and choose <span className="text-[#F4F4F5]">Email me each day&apos;s step</span>.
            Day 1 arrives straight away.
          </p>
          <Link href="/history" className={`${SECONDARY_INLINE} mt-4`}>
            Open History
          </Link>
        </div>
      ) : sub.status === "done" ? (
        <div>
          <p className="text-[14px] leading-6 text-[#B4B4BC]">
            You got all {sub.totalSteps} steps of your plan for <span className="text-[#F4F4F5]">{sub.company}</span>. Start again from any
            analysis&apos;s menu.
          </p>
          <Link href={planLink} className={`${SECONDARY_INLINE} mt-4`}>
            Open the plan
          </Link>
        </div>
      ) : (
        <form onSubmit={save}>
          <p className="text-[14px] leading-6 text-[#B4B4BC]">
            Your plan for <span className="text-[#F4F4F5]">{sub.company}</span>: day {sub.sentSteps} of {sub.totalSteps} sent. Day{" "}
            {sub.sentSteps + 1} goes to <span className="text-[#F4F4F5] break-all">{accountEmail}</span>.
          </p>
          <div className="mt-4 max-w-[240px]">
            <label htmlFor="plan-hour" className={LABEL}>
              Send it at
            </label>
            <div className="relative">
              <select id="plan-hour" value={sendHour} onChange={(e) => setSendHour(Number(e.target.value))} className={`${FIELD} pr-10 appearance-none cursor-pointer`}>
                {hours.map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B8B94]" aria-hidden="true" />
            </div>
            <p className="mt-2 text-[13px] text-[#8B8B94]">In your time zone ({sub.timeZone.replace(/_/g, " ")}).</p>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button type="submit" disabled={busy !== null || sendHour === sub.sendHour} className={PRIMARY_INLINE}>
              {busy === "save" ? "Saving…" : "Save"}
            </button>
            <Link href={planLink} className={SECONDARY_INLINE}>
              Open the plan
            </Link>
            <button type="button" onClick={stop} disabled={busy !== null} className={SECONDARY_INLINE}>
              {busy === "stop" ? "Stopping…" : "Stop daily emails"}
            </button>
          </div>
          {error && <p className="ll-swap mt-4 text-[13px] text-[#F87171]">{error}</p>}
        </form>
      )}
    </SettingsSection>
  );
}
