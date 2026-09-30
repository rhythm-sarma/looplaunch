"use client";

import Image from "next/image";

export function LandingFooter() {
  return (
    <footer className="w-full bg-bg-primary border-t border-border-subtle/40 py-12 px-6 sm:px-8 text-text-secondary text-sm">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Brand */}
        <div className="flex items-center gap-3 select-none">
          <Image
            src="/logo.png"
            alt="Loop Launch"
            width={120}
            height={40}
            className="h-7 w-auto object-contain"
          />
          <span className="text-xs text-text-tertiary ml-1">
            &copy; {new Date().getFullYear()}
          </span>
        </div>

        {/* Links */}
        <nav className="flex items-center gap-6 sm:gap-8 text-xs sm:text-sm">
          <a
            href="#what-is-it"
            className="hover:text-text-primary transition-colors"
          >
            Product
          </a>
          <a
            href="#how-it-works"
            className="hover:text-text-primary transition-colors"
          >
            How it works
          </a>
          <a
            href="#strategy-output"
            className="hover:text-text-primary transition-colors"
          >
            Pricing
          </a>
          <a
            href="mailto:contact@looplaunch.ai"
            className="hover:text-text-primary transition-colors"
          >
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
