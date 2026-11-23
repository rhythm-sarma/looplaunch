/**
 * Email through Brevo's transactional API, for everything the app sends on its own: the daily plan
 * email and the daily calendar agenda. Off until BREVO_API_KEY and AGENDA_EMAIL_FROM are set.
 * The from address must be a sender in Brevo (looplaunch.co is an authenticated Brevo domain).
 */

import { getSupabase } from "@/lib/db/supabase";

const env = (name: string) => process.env[name]?.trim() || "";

export interface EmailSender {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

/** The Brevo API key (xkeysib-…, not an SMTP key) and the from address, or null if either is missing. */
export function emailSender(): EmailSender | null {
  const apiKey = env("BREVO_API_KEY");
  const fromEmail = env("AGENDA_EMAIL_FROM");
  if (!apiKey || !fromEmail) return null;
  return { apiKey, fromEmail, fromName: env("AGENDA_EMAIL_FROM_NAME") || "Loop Launch" };
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Shows in Brevo's logs, e.g. "daily-plan" */
  tag: string;
}

/** False if email isn't set up on this server. Throws if Brevo refuses the message. */
export async function sendEmail(email: OutgoingEmail): Promise<boolean> {
  const sender = emailSender();
  if (!sender) return false;
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": sender.apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: { email: sender.fromEmail, name: sender.fromName },
      to: [{ email: email.to }],
      subject: email.subject,
      htmlContent: email.html,
      textContent: email.text,
      tags: [email.tag],
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`Brevo answered ${res.status}: ${body}`);
  }
  return true;
}

/** The email someone logs in with, for sends that happen without them (the morning emails). */
export async function accountEmail(userId: string): Promise<string | null> {
  const { data, error } = (await getSupabase()?.auth.admin.getUserById(userId)) ?? { data: null, error: null };
  if (error) console.warn("[Email] Looking up an account email failed:", error.message);
  return data?.user?.email ?? null;
}
