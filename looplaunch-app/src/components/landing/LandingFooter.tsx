"use client";

export function LandingFooter() {
  return (
    <footer className="w-full bg-bg-primary border-t border-border-subtle/40 py-12 px-6 sm:px-8 text-text-secondary text-sm">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Brand */}
        <div className="flex items-center gap-2 select-none">
          <span className="font-semibold text-text-primary tracking-tight">
            Loop Launch
          </span>
          <span className="text-xs text-text-tertiary ml-2">
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
