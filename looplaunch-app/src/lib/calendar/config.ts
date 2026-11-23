/**
 * Google Calendar daily agenda: everything it reads from the environment.
 * See .env.example for each variable. Only the yes/no flags from calendarFeatures() reach the browser.
 */

import { getSiteUrl } from "@/lib/seo";
import { tokenKeyFromEnv } from "./crypto";
import type { GoogleClient } from "./google";
import type { AgendaChannel } from "./types";

const env = (name: string) => process.env[name]?.trim() || "";

/**
 * The OAuth client from Google Cloud → Google Auth Platform → Clients. The redirect URI must be
 * listed there exactly; it defaults to the site's own /oauth/callback.
 */
export function googleClient(): GoogleClient | null {
  const clientId = env("GOOGLE_CALENDAR_CLIENT_ID");
  const clientSecret = env("GOOGLE_CALENDAR_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri: env("GOOGLE_CALENDAR_REDIRECT_URI") || `${getSiteUrl()}/oauth/callback` };
}

export interface EmailSender {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

/** Brevo (already our email provider). The from address must be a verified sender in Brevo. */
export function emailSender(): EmailSender | null {
  const apiKey = env("BREVO_API_KEY");
  const fromEmail = env("AGENDA_EMAIL_FROM");
  if (!apiKey || !fromEmail) return null;
  return { apiKey, fromEmail, fromName: env("AGENDA_EMAIL_FROM_NAME") || "Loop Launch" };
}

export interface WhatsAppSender {
  accessToken: string;
  phoneNumberId: string;
  template: string;
  language: string;
  graphVersion: string;
}

/** Meta's WhatsApp Cloud API, with an approved template whose body has two fields: the date, and the day's events. */
export function whatsappSender(): WhatsAppSender | null {
  const accessToken = env("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = env("WHATSAPP_PHONE_NUMBER_ID");
  const template = env("WHATSAPP_AGENDA_TEMPLATE");
  if (!accessToken || !phoneNumberId || !template) return null;
  return {
    accessToken,
    phoneNumberId,
    template,
    language: env("WHATSAPP_TEMPLATE_LANGUAGE") || "en",
    graphVersion: env("WHATSAPP_GRAPH_VERSION") || "v23.0",
  };
}

/** What's set up on this server: connecting needs the Google client and the token key. */
export function calendarFeatures(): { connect: boolean; channels: Record<AgendaChannel, boolean> } {
  return {
    connect: Boolean(googleClient() && tokenKeyFromEnv()),
    channels: { email: Boolean(emailSender()), whatsapp: Boolean(whatsappSender()) },
  };
}

/** Where the agenda's "change or stop these" link points. */
export function manageUrl(): string {
  return `${getSiteUrl()}/profile#settings-calendar`;
}
