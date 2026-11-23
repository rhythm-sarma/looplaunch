/**
 * Google refresh tokens are encrypted (AES-256-GCM) before they're stored, so a copy of the
 * database alone can't read anyone's calendar. The key lives only in the environment.
 *
 * Make a key once with:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const FORMAT = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** The 32-byte key from CALENDAR_TOKEN_KEY (base64), or null when it's missing or the wrong size. */
export function tokenKeyFromEnv(raw: string | undefined = process.env.CALENDAR_TOKEN_KEY): Buffer | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const key = Buffer.from(trimmed, "base64");
  return key.length === 32 ? key : null;
}

/** "v1:" + base64url(iv | auth tag | ciphertext) */
export function encryptToken(plain: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${FORMAT}:${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url")}`;
}

/** Throws if the value was changed, was made with another key, or isn't in our format. */
export function decryptToken(stored: string, key: Buffer): string {
  const [format, data] = stored.split(":", 2);
  if (format !== FORMAT || !data) throw new Error("Stored token isn't in a known format.");
  const raw = Buffer.from(data, "base64url");
  if (raw.length <= IV_BYTES + TAG_BYTES) throw new Error("Stored token is too short.");
  const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, IV_BYTES));
  decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
}
