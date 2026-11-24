"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import RubberSegment from "@/components/reactbits/RubberSegment";
import { GoogleIcon } from "@/components/auth/GoogleIcon";
import { SettingsSection } from "@/components/profile/SettingsSection";
import { FIELD, LABEL, PRIMARY_INLINE, SECONDARY_INLINE } from "@/components/ui/fields";
import { SEND_HOURS, hourLabel } from "@/lib/calendar/agenda";
import type { AgendaChannel, CalendarConnection, CalendarSettingsData } from "@/lib/calendar/types";
import { toast, type ToastTone } from "@/lib/toast";

type Note = { tone: "ok" | "error" | "info"; text: string } | null;

const NOTE_COLOR = { ok: "text-[#34D399]", error: "text-[#F87171]", info: "text-[#B4B4BC]" };

/** What /oauth/callback reports back in ?calendar= */
const NOTICES: Record<string, { tone: ToastTone; title: string; description: string }> = {
  connected: { tone: "success", title: "Google Calendar connected", description: "Your agenda arrives every morning. Send a test to see it now." },
  denied: { tone: "info", title: "Google Calendar not connected", description: "You cancelled on Google's page, so nothing changed." },
  permission: {
    tone: "error",
    title: "Calendar access wasn't allowed",
    description: "On Google's page, tick the box that lets Loop Launch see your calendar events, then try again.",
  },
  expired: { tone: "error", title: "That didn't finish", description: "It took too long or started in another tab. Please try again." },
  api_disabled: {
    tone: "error",
    title: "Google Calendar isn't switched on yet",
    description: "The Google Calendar API needs turning on in Google Cloud for this app.",
  },
  unavailable: { tone: "info", title: "Google Calendar is coming soon", description: "You'll be able to connect it here once it's ready." },
  error: { tone: "error", title: "Couldn't connect Google Calendar", description: "Something went wrong. Please try again." },
};

const CONNECT_URL = "/api/calendar/connect";

function Row({ label, value, action, children }: { label: string; value?: ReactNode; action?: ReactNode; children?: ReactNode }) {
  return (
    <div className="py-5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-[#F4F4F5]">{label}</p>
          {value && <div className="mt-1 text-[14px] leading-6 text-[#B4B4BC] break-words">{value}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Settings → Daily agenda: connect Google Calendar, pick when and how the agenda arrives, send a test. */
export function CalendarSettings({ data, notice, accountEmail }: { data: CalendarSettingsData; notice?: string; accountEmail: string }) {
  // Show the result of a connection once, then tidy ?calendar= out of the address bar.
  const shown = useRef(false);
  useEffect(() => {
    if (!notice || shown.current) return;
    shown.current = true;
    const n = NOTICES[notice];
    if (n) toast(n.title, { description: n.description, tone: n.tone });
    window.history.replaceState(null, "", "/profile#settings-calendar");
  }, [notice]);

  const via = data.channels.whatsapp ? "by email or WhatsApp" : "by email";

  return (
    <SettingsSection
      id="settings-calendar"
      title="Daily agenda"
      description={`Every morning, what's on your Google Calendar that day, sent to you ${via}.`}
    >
      {!data.available ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-[#27272A] bg-[#141418] text-[14px] font-medium text-[#8B8B94] cursor-default select-none">
            <GoogleIcon />
            Connect Google Calendar
          </span>
          <span className="rounded-full bg-[#1C1C21] border border-[#27272A] px-2.5 py-0.5 text-[12px] font-medium text-[#B4B4BC]">Coming soon</span>
        </div>
      ) : data.connection ? (
        <Connected connection={data.connection} channels={data.channels} accountEmail={accountEmail} />
      ) : (
        <div>
          <p className="text-[14px] leading-6 text-[#B4B4BC] max-w-[60ch]">
            Loop Launch reads today&apos;s events from your Google Calendar and sends you the list at the time you choose. It can
            only read your calendar, never change it, and you can disconnect at any time.
          </p>
          <a href={CONNECT_URL} className={`${PRIMARY_INLINE} mt-4`}>
            <GoogleIcon />
            Connect Google Calendar
          </a>
        </div>
      )}
    </SettingsSection>
  );
}

function Connected({
  connection,
  channels,
  accountEmail,
}: {
  connection: CalendarConnection;
  channels: CalendarSettingsData["channels"];
  accountEmail: string;
}) {
  const router = useRouter();
  const [sendHour, setSendHour] = useState(connection.sendHour);
  const [channel, setChannel] = useState<AgendaChannel>(channels.whatsapp ? connection.channel : "email");
  const [whatsapp, setWhatsapp] = useState(connection.whatsapp ?? "");
  const [busy, setBusy] = useState<"save" | "test" | "disconnect" | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const hours = SEND_HOURS.includes(connection.sendHour) ? SEND_HOURS : [...SEND_HOURS, connection.sendHour].sort((a, b) => a - b);
  const changed =
    sendHour !== connection.sendHour ||
    channel !== connection.channel ||
    (channel === "whatsapp" && whatsapp.trim() !== (connection.whatsapp ?? ""));
  const zone = connection.timeZone.replace(/_/g, " ");

  const post = async (path: string, body?: unknown) => {
    const res = await fetch(path, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, json };
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("save");
    setNote(null);
    const { ok, json } = await post("/api/calendar/settings", { sendHour, channel, whatsapp });
    setBusy(null);
    if (!ok) {
      setNote({ tone: "error", text: String(json.error || "Couldn't save. Please try again.") });
      return;
    }
    toast("Daily agenda saved", {
      description: `Every day at ${hourLabel(sendHour)}, by ${channel === "whatsapp" ? "WhatsApp" : "email"}.`,
    });
    router.refresh();
  };

  const sendTest = async () => {
    setBusy("test");
    setNote(null);
    const { ok, json } = await post("/api/calendar/send-now");
    setBusy(null);
    setPreview(typeof json.preview === "string" ? json.preview : null);

    const delivery = json.delivery as { delivered: boolean; to?: string; reason?: string } | undefined;
    if (ok && delivery?.delivered) {
      setNote({ tone: "ok", text: `Sent to ${delivery.to}. Here's what it says:` });
      toast("Test agenda sent", { description: `Check ${delivery.to}.` });
    } else if (ok && delivery?.reason === "not_configured") {
      setNote({
        tone: "info",
        text: `Sending by ${connection.channel === "whatsapp" ? "WhatsApp" : "email"} isn't switched on yet, so nothing was sent. Here's what it will say:`,
      });
    } else if (ok && delivery?.reason === "no_recipient") {
      setNote({ tone: "error", text: "Add your WhatsApp number and save first." });
    } else {
      setNote({ tone: "error", text: String(json.message || json.error || "Couldn't send a test. Please try again.") });
      if (json.error === "reconnect") router.refresh();
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    setNote(null);
    const { ok, json } = await post("/api/calendar/disconnect");
    if (!ok) {
      setBusy(null);
      setNote({ tone: "error", text: String(json.error || "Couldn't disconnect. Please try again.") });
      return;
    }
    toast("Google Calendar disconnected", { description: "Your daily agenda has stopped." });
    router.refresh();
  };

  return (
    <div>
      {connection.status === "reconnect" && (
        <div className="mb-6 rounded-[12px] border border-[#78350F] bg-[#78350F]/20 p-4">
          <p className="text-[14px] leading-6 text-[#FBBF24]">
            Google stopped letting Loop Launch read your calendar, so your agenda is paused. Connect it again to restart it.
          </p>
          <a href={CONNECT_URL} className={`${PRIMARY_INLINE} mt-3`}>
            <GoogleIcon />
            Reconnect Google Calendar
          </a>
        </div>
      )}

      <form onSubmit={save} className="divide-y divide-[#1F1F24]">
        <Row
          label="Google Calendar"
          value={
            <>
              Connected{connection.googleEmail ? ` as ${connection.googleEmail}` : ""}. Times follow your calendar&apos;s time zone ({zone}).
            </>
          }
          action={
            <button type="button" onClick={disconnect} disabled={busy !== null} className={SECONDARY_INLINE}>
              {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
            </button>
          }
        />

        <Row label="When and how">
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cal-hour" className={LABEL}>
                Send it at
              </label>
              <div className="relative">
                <select
                  id="cal-hour"
                  value={sendHour}
                  onChange={(e) => setSendHour(Number(e.target.value))}
                  className={`${FIELD} pr-10 appearance-none cursor-pointer`}
                >
                  {hours.map((h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B8B94]" aria-hidden="true" />
              </div>
            </div>

            <div>
              <p className={LABEL}>Send it by</p>
              {channels.whatsapp ? (
                <RubberSegment
                  items={[
                    { value: "email", label: "Email" },
                    { value: "whatsapp", label: "WhatsApp" },
                  ]}
                  value={channel}
                  onChange={(v) => setChannel(v === "whatsapp" ? "whatsapp" : "email")}
                  aria-label="Send it by"
                  size="sm"
                  radius={999}
                  trackColor="#09090B"
                  thumbColor="#2A2A30"
                  textColor="#B4B4BC"
                  activeTextColor="#F4F4F5"
                />
              ) : (
                <p className="h-10 flex items-center text-[14px] text-[#B4B4BC] break-all">Email to {accountEmail}</p>
              )}
            </div>
          </div>

          {channel === "whatsapp" && (
            <div className="mt-4 max-w-sm">
              <label htmlFor="cal-whatsapp" className={LABEL}>
                WhatsApp number
              </label>
              <input
                id="cal-whatsapp"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className={`${FIELD} pr-3.5`}
              />
            </div>
          )}
          {channel === "email" && channels.whatsapp && (
            <p className="mt-3 text-[13px] leading-relaxed text-[#8B8B94]">Sent to {accountEmail}, the email you log in with.</p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button type="submit" disabled={busy !== null || !changed} className={PRIMARY_INLINE}>
              {busy === "save" ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={sendTest} disabled={busy !== null || connection.status === "reconnect"} className={SECONDARY_INLINE}>
              {busy === "test" ? "Reading your calendar…" : "Send a test now"}
            </button>
          </div>

          {note && <p className={`ll-swap mt-4 text-[13px] leading-relaxed ${NOTE_COLOR[note.tone]}`}>{note.text}</p>}
          {preview && (
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-[12px] border border-[#1F1F24] bg-[#09090B] p-4 font-mono text-[13px] leading-6 text-[#D4D4D8]">
              {preview}
            </pre>
          )}
        </Row>
      </form>
    </div>
  );
}
