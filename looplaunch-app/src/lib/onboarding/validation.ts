/**
 * Validation utilities for onboarding fields.
 */

/**
 * Validates a URL string. Accepts with or without protocol.
 * Returns true if the URL looks plausible.
 */
export function isValidUrl(value: string): boolean {
  if (!value.trim()) return false;

  // Add protocol if missing
  let url = value.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    // Must have at least a dot in the hostname (e.g. example.com)
    return parsed.hostname.includes(".");
  } catch {
    return false;
  }
}

/**
 * Normalizes a URL — adds https:// if missing.
 */
export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Checks if a textarea value has meaningful content.
 */
export function hasContent(value: string): boolean {
  return value.trim().length > 0;
}
