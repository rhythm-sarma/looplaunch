import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  agendaHtml,
  agendaItems,
  agendaOneLine,
  agendaSubject,
  agendaText,
  dayWindow,
  hourLabel,
  isDue,
  safeTimeZone,
  type Agenda,
} from "../agenda";
import type { CalendarEvent } from "../google";

describe("the local day", () => {
  test("today in India runs from 18:30 UTC the evening before", () => {
    // 07:30 in Kolkata on 23 November
    const day = dayWindow("Asia/Kolkata", new Date("2026-11-23T02:00:00Z"));
    assert.equal(day.date, "2026-11-23");
    assert.equal(day.dateLabel, "Monday, 23 November");
    assert.equal(day.timeMin, "2026-11-22T18:30:00.000Z");
    assert.equal(day.timeMax, "2026-11-23T18:30:00.000Z");
  });

  test("just after midnight local time is already the new day, even though UTC is still on yesterday", () => {
    const day = dayWindow("Asia/Kolkata", new Date("2026-11-22T18:45:00Z"));
    assert.equal(day.date, "2026-11-23");
  });

  test("the day the clocks go forward in New York is 23 hours long", () => {
    const day = dayWindow("America/New_York", new Date("2026-03-08T15:00:00Z"));
    assert.equal(day.timeMin, "2026-03-08T05:00:00.000Z");
    assert.equal(day.timeMax, "2026-03-09T04:00:00.000Z");
  });

  test("the day the clocks go back in London is 25 hours long", () => {
    const day = dayWindow("Europe/London", new Date("2026-10-25T12:00:00Z"));
    assert.equal(day.timeMin, "2026-10-24T23:00:00.000Z");
    assert.equal(day.timeMax, "2026-10-26T00:00:00.000Z");
  });

  test("an unknown time zone falls back to UTC", () => {
    assert.equal(safeTimeZone("Mars/Olympus_Mons"), "UTC");
    assert.equal(safeTimeZone(null), "UTC");
    assert.equal(safeTimeZone("Asia/Kolkata"), "Asia/Kolkata");
  });
});

describe("which events make the agenda", () => {
  const tz = "Asia/Kolkata";
  const window = dayWindow(tz, new Date("2026-11-23T02:00:00Z"));

  test("all-day first, then by time; declined, cancelled and working-location entries left out", () => {
    const events: CalendarEvent[] = [
      { summary: "Lunch with Sam", start: { dateTime: "2026-11-23T13:00:00+05:30" }, end: { dateTime: "2026-11-23T14:00:00+05:30" } },
      { summary: "Team standup", start: { dateTime: "2026-11-23T09:00:00+05:30" }, end: { dateTime: "2026-11-23T09:15:00+05:30" } },
      { summary: "Mom's birthday", start: { date: "2026-11-23" }, end: { date: "2026-11-24" } },
      {
        summary: "Vendor call",
        start: { dateTime: "2026-11-23T11:00:00+05:30" },
        attendees: [{ self: true, responseStatus: "declined" }],
      },
      { summary: "Old plan", status: "cancelled", start: { dateTime: "2026-11-23T10:00:00+05:30" } },
      { summary: "Office", eventType: "workingLocation", start: { date: "2026-11-23" } },
      { start: { dateTime: "2026-11-23T16:30:00+05:30" } },
    ];
    assert.deepEqual(agendaItems(events, window, tz), [
      { time: "All day", title: "Mom's birthday" },
      { time: "9:00 AM", title: "Team standup" },
      { time: "1:00 PM", title: "Lunch with Sam" },
      { time: "4:30 PM", title: "(No title)" },
    ]);
  });

  test("something that started yesterday shows when it ends, or counts as all day", () => {
    const events: CalendarEvent[] = [
      { summary: "Night shift", start: { dateTime: "2026-11-22T22:00:00+05:30" }, end: { dateTime: "2026-11-23T06:30:00+05:30" } },
      { summary: "Conference", start: { dateTime: "2026-11-22T09:00:00+05:30" }, end: { dateTime: "2026-11-25T18:00:00+05:30" } },
    ];
    assert.deepEqual(agendaItems(events, window, tz), [
      { time: "All day", title: "Conference" },
      { time: "Until 6:30 AM", title: "Night shift" },
    ]);
  });

  test("titles keep one line", () => {
    const events: CalendarEvent[] = [{ summary: "  Board\n meeting\t ", start: { dateTime: "2026-11-23T18:00:00+05:30" } }];
    assert.deepEqual(agendaItems(events, window, tz), [{ time: "6:00 PM", title: "Board meeting" }]);
  });
});

describe("when the daily agenda is due", () => {
  const base = { timeZone: "Asia/Kolkata", sendHour: 7, lastSentOn: null, status: "active" as const };

  test("from the chosen hour, for a few hours, once a day", () => {
    assert.equal(isDue(base, new Date("2026-11-23T01:00:00Z")).due, false, "6:30 AM is too early");
    assert.deepEqual(isDue(base, new Date("2026-11-23T01:30:00Z")), { due: true, date: "2026-11-23" }, "7:00 AM");
    assert.equal(isDue(base, new Date("2026-11-23T04:00:00Z")).due, true, "9:30 AM still catches up");
    assert.equal(isDue(base, new Date("2026-11-23T04:30:00Z")).due, false, "10:00 AM is too late");
    assert.equal(isDue({ ...base, lastSentOn: "2026-11-23" }, new Date("2026-11-23T01:30:00Z")).due, false, "already sent");
    assert.equal(isDue({ ...base, lastSentOn: "2026-11-22" }, new Date("2026-11-23T01:30:00Z")).due, true, "sent yesterday");
  });

  test("never while the connection needs reconnecting", () => {
    assert.equal(isDue({ ...base, status: "reconnect" }, new Date("2026-11-23T01:30:00Z")).due, false);
  });

  test("hour labels", () => {
    assert.equal(hourLabel(7), "7:00 AM");
    assert.equal(hourLabel(0), "12:00 AM");
    assert.equal(hourLabel(12), "12:00 PM");
    assert.equal(hourLabel(18), "6:00 PM");
  });
});

describe("the message", () => {
  const agenda: Agenda = {
    date: "2026-11-23",
    dateLabel: "Monday, 23 November",
    items: [
      { time: "All day", title: "Mom's birthday" },
      { time: "9:00 AM", title: "Standup <with> \"design\" & ops" },
    ],
  };

  test("subject counts the events", () => {
    assert.equal(agendaSubject(agenda), "Your day: Monday, 23 November (2 events)");
    assert.equal(agendaSubject({ ...agenda, items: [] }), "Your day: Monday, 23 November (nothing scheduled)");
    assert.equal(agendaSubject({ ...agenda, items: [agenda.items[0]] }), "Your day: Monday, 23 November (1 event)");
  });

  test("plain text lists each event and how to change it", () => {
    const text = agendaText(agenda, "https://looplaunch.co/profile");
    assert.match(text, /^Here's your day, Monday, 23 November\./);
    assert.match(text, /All day\s+Mom's birthday/);
    assert.match(text, /9:00 AM\s+Standup <with> "design" & ops/);
    assert.match(text, /https:\/\/looplaunch\.co\/profile$/);
    assert.match(agendaText({ ...agenda, items: [] }, "x"), /Nothing on your calendar today\./);
  });

  test("HTML escapes event titles", () => {
    const html = agendaHtml(agenda, "https://looplaunch.co/profile");
    assert.ok(html.includes("Standup &lt;with&gt; &quot;design&quot; &amp; ops"));
    assert.ok(!html.includes("<with>"));
    assert.ok(html.includes("Mom&#39;s birthday"));
  });

  test("one line for WhatsApp: no line breaks, short, and says what was left out", () => {
    assert.equal(agendaOneLine(agenda), "All day Mom's birthday · 9:00 AM Standup <with> \"design\" & ops");
    assert.equal(agendaOneLine({ ...agenda, items: [] }), "nothing on your calendar");

    const many: Agenda = {
      ...agenda,
      items: Array.from({ length: 40 }, (_, i) => ({ time: `${(i % 12) + 1}:00 PM`, title: `Meeting number ${i + 1}` })),
    };
    const line = agendaOneLine(many, 120);
    assert.ok(line.length <= 120, `${line.length} characters`);
    assert.match(line, / · and \d+ more$/);
    assert.ok(!/[\n\t]| {4}/.test(line));

    const long: Agenda = { ...agenda, items: [{ time: "9:00 AM", title: "x".repeat(300) }] };
    const cut = agendaOneLine(long, 100);
    assert.ok(cut.length <= 100);
    assert.ok(cut.endsWith("…"));
    assert.ok(!cut.includes("more"));
  });
});
