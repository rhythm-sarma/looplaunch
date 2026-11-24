import type { NextConfig } from "next";

/**
 * Security headers on every page and API response.
 * - Content-Security-Policy: no other site may show Loop Launch in a frame (clickjacking), no
 *   plugins, and no <base> or form posts to other sites. Scripts and styles aren't restricted
 *   here: that needs a per-request nonce, and the pages work without one.
 * - Strict-Transport-Security: browsers only ever use HTTPS for looplaunch.co (2 years).
 * - The rest: no guessing file types, a short referrer to other sites, no camera, microphone
 *   or location access.
 */
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  // pdf-parse (pitch deck uploads) loads pdf.js and its worker from node_modules at run time;
  // bundling them breaks the worker path.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  // The X-Powered-By header only tells attackers which framework to aim at.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
