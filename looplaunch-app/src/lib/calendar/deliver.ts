/**
 * Sending the agenda: email through Brevo's API, or WhatsApp through Meta's Cloud API.
 * Each is off until its keys are in the environment (see config.ts).
 */

import { agendaHtml, agendaOneLine, agendaSubject, agendaText, type Agenda } from "./agenda";
import { emailSender, manageUrl, whatsappSender } from "./config";
import type { AgendaChannel } from "./types";

export type Delivery =
  | { delivered: true; channel: AgendaChannel; to: string }
  | { delivered: false; channel: AgendaChannel; reason: "not_configured" | "no_recipient" };

async function failure(service: string, res: Response): Promise<Error> {
  const body = (await res.text().catch(() => "")).slice(0, 300);
  return new Error(`${service} answered ${res.status}: ${body}`);
}

export async function sendAgendaEmail(to: string, agenda: Agenda): Promise<boolean> {
  const sender = emailSender();
  if (!sender) return false;
  const link = manageUrl();
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": sender.apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: { email: sender.fromEmail, name: sender.fromName },
      to: [{ email: to }],
      subject: agendaSubject(agenda),
      htmlContent: agendaHtml(agenda, link),
      textContent: agendaText(agenda, link),
      tags: ["daily-agenda"],
    }),
    cache: "no-store",
  });
  if (!res.ok) throw await failure("Brevo", res);
  return true;
}

/**
 * A template message, since we write first (outside WhatsApp's 24-hour reply window).
 * Template body fields: {{1}} the date, {{2}} the day's events on one line.
 */
export async function sendAgendaWhatsApp(to: string, agenda: Agenda): Promise<boolean> {
  const sender = whatsappSender();
  if (!sender) return false;
  const res = await fetch(`https://graph.facebook.com/${sender.graphVersion}/${sender.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sender.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/^\+/, ""),
      type: "template",
      template: {
        name: sender.template,
        language: { code: sender.language },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: agenda.dateLabel },
              { type: "text", text: agendaOneLine(agenda) },
            ],
          },
        ],
      },
    }),
    cache: "no-store",
  });
  if (!res.ok) throw await failure("WhatsApp", res);
  return true;
}

/** Send by the person's chosen channel. Throws if the provider refuses the message. */
export async function deliverAgenda(
  target: { channel: AgendaChannel; email: string | null; whatsapp: string | null },
  agenda: Agenda
): Promise<Delivery> {
  const to = target.channel === "whatsapp" ? target.whatsapp : target.email;
  if (!to) return { delivered: false, channel: target.channel, reason: "no_recipient" };
  const sent = target.channel === "whatsapp" ? await sendAgendaWhatsApp(to, agenda) : await sendAgendaEmail(to, agenda);
  return sent ? { delivered: true, channel: target.channel, to } : { delivered: false, channel: target.channel, reason: "not_configured" };
}
