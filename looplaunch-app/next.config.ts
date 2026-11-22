import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (pitch deck uploads) loads pdf.js and its worker from node_modules at run time;
  // bundling them breaks the worker path.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
