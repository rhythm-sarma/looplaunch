/** Shapes shared by the calendar server code and the Settings section. No secrets in any of them. */

export type AgendaChannel = "email" | "whatsapp";

/** "reconnect": Google stopped accepting our token (revoked, expired, or calendar access removed). */
export type ConnectionStatus = "active" | "reconnect";

/** One person's Google Calendar connection, as Settings shows it. The token itself never leaves the server. */
export interface CalendarConnection {
  googleEmail: string | null;
  timeZone: string;
  /** Local hour (0–23) the agenda is sent at, in timeZone */
  sendHour: number;
  channel: AgendaChannel;
  /** "+" and digits, or null */
  whatsapp: string | null;
  status: ConnectionStatus;
  /** Local date (YYYY-MM-DD) of the last daily send */
  lastSentOn: string | null;
}

export interface CalendarSettingsData {
  /** False until the server has the Google client, the token key and the database table */
  available: boolean;
  /** Which ways of sending the server is set up for */
  channels: Record<AgendaChannel, boolean>;
  connection: CalendarConnection | null;
}
