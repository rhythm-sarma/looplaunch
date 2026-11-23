/**
 * Send a sample daily agenda email through Brevo, with the same code the app uses, to check that
 * BREVO_API_KEY and AGENDA_EMAIL_FROM work. Needs no Google connection or database.
 *
 *   npm run agenda:test-email -- you@example.com
 */

import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const to = process.argv[2]?.trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error("Usage: npm run agenda:test-email -- you@example.com");
    process.exit(1);
  }

  // Imported after the environment is loaded, since config reads it.
  const { emailSender } = await import("../src/lib/email/brevo");
  const { sendAgendaEmail } = await import("../src/lib/calendar/deliver");
  const { agendaSubject, dayWindow } = await import("../src/lib/calendar/agenda");

  const sender = emailSender();
  if (!sender) {
    console.error("BREVO_API_KEY or AGENDA_EMAIL_FROM isn't set in .env.local, so email can't be sent.");
    process.exit(1);
  }

  const day = dayWindow("Asia/Kolkata", new Date());
  const agenda = {
    date: day.date,
    dateLabel: day.dateLabel,
    items: [
      { time: "All day", title: "Sample: Diwali sale planning" },
      { time: "10:00 AM", title: "Sample: Call with supplier" },
      { time: "2:30 PM", title: "Sample: Review this week's Instagram posts" },
    ],
  };

  try {
    await sendAgendaEmail(to, agenda);
    console.log(`Sent "${agendaSubject(agenda)}" from ${sender.fromName} <${sender.fromEmail}> to ${to}.`);
  } catch (error) {
    console.error("Brevo refused it:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
