/**
 * Google Calendar daily agenda: everything it reads from the environment.
 * See .env.example for each variable. Only the yes/no flags from calendarFeatures() reach the browser.
 */

import { emailSender } from "@/lib/email/brevo";
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

/**
 * Google only lets test users connect until it has verified the app, so the feature shows as
 * "Coming soon" everywhere until GOOGLE_CALENDAR_LAUNCH=on. Flip it once Google approves.
 */
export function calendarLaunched(): boolean {
  return env("GOOGLE_CALENDAR_LAUNCH").toLowerCase() === "on";
}

/** What's set up on this server: connecting needs the launch switch, the Google client and the token key. */
export function calendarFeatures(): { connect: boolean; channels: Record<AgendaChannel, boolean> } {
  return {
    connect: Boolean(calendarLaunched() && googleClient() && tokenKeyFromEnv()),
    channels: { email: Boolean(emailSender()), whatsapp: Boolean(whatsappSender()) },
  };
}

/** Where the agenda's "change or stop these" link points. */
export function manageUrl(): string {
  return `${getSiteUrl()}/profile#settings-calendar`;
}
