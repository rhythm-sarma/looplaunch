/**
 * Turning a day of calendar events into the agenda we send: which hours count as "today" in the
 * person's time zone, which events to show, and the email / WhatsApp wording. No I/O here.
 */

import type { CalendarEvent } from "./google";
import type { ConnectionStatus } from "./types";

/** How long after the chosen hour a missed send may still go out (e.g. the server was restarting at 7). */
export const SEND_WINDOW_HOURS = 3;

/** Hours offered in Settings, as local hours. */
export const SEND_HOURS = [5, 6, 7, 8, 9, 10, 11];
export const DEFAULT_SEND_HOUR = 7;

export interface AgendaItem {
  /** "9:00 AM", "All day" or "Until 10:30 AM" */
  time: string;
  title: string;
}

export interface Agenda {
  /** Local date, YYYY-MM-DD */
  date: string;
  /** "Monday, 23 November" */
  dateLabel: string;
  items: AgendaItem[];
}

// ─── Time zones ───

/** The calendar's time zone if this server knows it, otherwise UTC. */
export function safeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

const partFormatters = new Map<string, Intl.DateTimeFormat>();

/** What a wall clock in `timeZone` shows at the moment `at`. */
export function zonedParts(timeZone: string, at: Date) {
  let formatter = partFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    partFormatters.set(timeZone, formatter);
  }
  const parts = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0 };
  for (const part of formatter.formatToParts(at)) {
    if (part.type in parts) parts[part.type as keyof typeof parts] = Number(part.value);
  }
  return parts;
}

/** Milliseconds the zone is ahead of UTC at `at` (+5:30 for India, -5 or -4 hours for New York). */
function offsetMs(timeZone: string, at: Date): number {
  const p = zonedParts(timeZone, at);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - (at.getTime() - at.getUTCMilliseconds());
}

/** The moment local midnight starts on that date. The second pass settles days when the clocks change. */
function zonedMidnight(timeZone: string, year: number, month: number, day: number): Date {
  const wall = Date.UTC(year, month - 1, day);
  const first = wall - offsetMs(timeZone, new Date(wall));
  return new Date(wall - offsetMs(timeZone, new Date(first)));
}

const pad = (n: number) => String(n).padStart(2, "0");

export interface DayWindow {
  date: string;
  dateLabel: string;
  /** Start and end of the local day as UTC timestamps, for the Calendar API */
  timeMin: string;
  timeMax: string;
}

/** "Today" in the person's time zone: 23 or 25 hours long on the days the clocks change. */
export function dayWindow(timeZone: string, now: Date): DayWindow {
  const p = zonedParts(timeZone, now);
  const tomorrow = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long" }).format(now);
  const dayMonth = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "long" }).format(now);
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    dateLabel: `${weekday}, ${dayMonth}`,
    timeMin: zonedMidnight(timeZone, p.year, p.month, p.day).toISOString(),
    timeMax: zonedMidnight(timeZone, tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate()).toISOString(),
  };
}

// ─── Which events, and how they read ───

/** "9:00 AM". Newer ICU puts a narrow no-break space before AM/PM; plain spaces travel better. */
function clockTime(timeZone: string, at: number): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(at).replace(/\s/g, " ");
}

/**
 * The day's events in the order a person reads them: all-day first, then by start time.
 * Left out: events the person declined, cancelled ones, and Google's "working location" markers.
 */
export function agendaItems(events: CalendarEvent[], window: Pick<DayWindow, "timeMin" | "timeMax">, timeZone: string): AgendaItem[] {
  const dayStart = Date.parse(window.timeMin);
  const dayEnd = Date.parse(window.timeMax);
  const rows: (AgendaItem & { allDay: boolean; at: number })[] = [];

  for (const event of events) {
    if (event.status === "cancelled" || event.eventType === "workingLocation") continue;
    if (event.attendees?.some((a) => a.self && a.responseStatus === "declined")) continue;
    const title = (event.summary ?? "").replace(/\s+/g, " ").trim() || "(No title)";

    const startTime = event.start?.dateTime ? Date.parse(event.start.dateTime) : NaN;
    if (Number.isNaN(startTime)) {
      if (event.start?.date) rows.push({ time: "All day", title, allDay: true, at: 0 });
      continue;
    }
    if (startTime >= dayStart) {
      rows.push({ time: clockTime(timeZone, startTime), title, allDay: false, at: startTime });
      continue;
    }
    // Started before today, like an overnight flight: say when it ends, or treat it as all day.
    const endTime = event.end?.dateTime ? Date.parse(event.end.dateTime) : NaN;
    if (endTime < dayEnd) rows.push({ time: `Until ${clockTime(timeZone, endTime)}`, title, allDay: false, at: dayStart });
    else rows.push({ time: "All day", title, allDay: true, at: 0 });
  }

  return rows
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.at - b.at)
    .map(({ time, title }) => ({ time, title }));
}

/** Is it time for this person's daily send? Only once a day, and not hours late. */
export function isDue(
  connection: { timeZone: string; sendHour: number; lastSentOn: string | null; status: ConnectionStatus },
  now: Date
): { due: boolean; date: string } {
  const p = zonedParts(connection.timeZone, now);
  const date = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  const inWindow = p.hour >= connection.sendHour && p.hour < connection.sendHour + SEND_WINDOW_HOURS;
  return { due: connection.status === "active" && inWindow && connection.lastSentOn !== date, date };
}

export function hourLabel(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${hour < 12 ? "AM" : "PM"}`;
}

// ─── The message ───

const countLabel = (n: number) => (n === 0 ? "nothing scheduled" : n === 1 ? "1 event" : `${n} events`);

export function agendaSubject(agenda: Agenda): string {
  return `Your day: ${agenda.dateLabel} (${countLabel(agenda.items.length)})`;
}

export function agendaText(agenda: Agenda, manageUrl: string): string {
  const lines = agenda.items.length
    ? agenda.items.map((item) => `${item.time.padEnd(16)}${item.title}`)
    : ["Nothing on your calendar today."];
  return [
    `Here's your day, ${agenda.dateLabel}.`,
    "",
    ...lines,
    "",
    `Change the time or stop these: ${manageUrl}`,
  ].join("\n");
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** A plain, light email that reads well in any client. Event titles are escaped: they're the person's own text. */
export function agendaHtml(agenda: Agenda, manageUrl: string): string {
  const cell = "padding:10px 0;border-top:1px solid #E4E4E7;vertical-align:top;font-size:15px;line-height:22px";
  const rows = agenda.items.length
    ? agenda.items
        .map(
          (item) =>
            `<tr><td style="${cell};width:124px;padding-right:12px;color:#6D28D9;font-weight:600;white-space:nowrap">${escapeHtml(item.time)}</td>` +
            `<td style="${cell};color:#18181B">${escapeHtml(item.title)}</td></tr>`
        )
        .join("")
    : `<tr><td style="${cell};color:#52525B">Nothing on your calendar today.</td></tr>`;

  return `<!DOCTYPE html><html><body style="margin:0;background:#FAFAFA">
<div style="max-width:520px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181B">
<p style="margin:0 0 6px;font-size:13px;color:#71717A">Loop Launch · Daily agenda</p>
<h1 style="margin:0 0 20px;font-size:22px;line-height:28px;font-weight:600">${escapeHtml(agenda.dateLabel)}</h1>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">${rows}</table>
<p style="margin:28px 0 0;font-size:13px;line-height:20px;color:#71717A">You get this because you connected Google Calendar in Loop Launch. <a href="${escapeHtml(manageUrl)}" style="color:#71717A">Change the time or stop these emails</a>.</p>
</div></body></html>`;
}

/**
 * The agenda on one line, for a WhatsApp template field: those can't hold line breaks, tabs or
 * runs of spaces, and must stay short.
 */
export function agendaOneLine(agenda: Agenda, maxLength = 600): string {
  if (!agenda.items.length) return "nothing on your calendar";
  const parts = agenda.items.map((item) => `${item.time} ${item.title}`.replace(/\s+/g, " "));
  const full = parts.join(" · ");
  if (full.length <= maxLength) return full;

  // Keep as many whole events as fit, then say how many more there are.
  let line = "";
  let kept = 0;
  while (kept < parts.length) {
    const candidate = kept ? `${line} · ${parts[kept]}` : parts[kept];
    if (`${candidate} · and ${parts.length - kept - 1} more`.length > maxLength) break;
    line = candidate;
    kept++;
  }
  const more = parts.length - kept;
  if (kept === 0) {
    // Even the first event is too long: cut its title short.
    const suffix = more > 1 ? ` · and ${more - 1} more` : "";
    return `${parts[0].slice(0, maxLength - suffix.length - 1).trimEnd()}…${suffix}`;
  }
  return `${line} · and ${more} more`;
}
