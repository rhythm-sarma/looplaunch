"use client";

import { useState, type KeyboardEvent } from "react";
import { Mascot } from "@/components/onboarding/Mascot";
import { isValidUrl, normalizeUrl } from "@/lib/onboarding/validation";

interface FinalCtaSectionProps {
  initialUrl?: string;
  onSubmit: (url: string) => void;
}

export function FinalCtaSection({
  initialUrl = "",
  onSubmit,
}: FinalCtaSectionProps) {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Please enter your company website.");
      return;
    }
    if (!isValidUrl(trimmed)) {
      setError("Please enter a valid website URL (e.g. yourcompany.com)");
      return;
    }
    setError("");
    onSubmit(normalizeUrl(trimmed));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <section className="relative py-32 sm:py-44 px-6 sm:px-8 border-b border-border-subtle bg-bg-primary text-text-primary">
      <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center text-center">
        {/* Bird Mascot */}
        <div className="mb-8">
          <Mascot size={64} variant="cta" />
        </div>

        {/* Heading */}
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-text-primary mb-4 leading-tight">
          Ready to launch?
        </h2>

        {/* Supporting copy */}
        <p className="text-text-secondary text-base sm:text-lg mb-10 max-w-lg leading-relaxed">
          Start your strategic onboarding analysis.
        </p>

        {/* Input bar + Button */}
        <div className="w-full max-w-xl mx-auto">
          <div
            className={`
              relative flex flex-col sm:flex-row items-center w-full p-1.5 rounded-full
              bg-bg-surface
              border transition-colors duration-200 gap-2
              ${
                error
                  ? "border-error"
                  : isFocused
                  ? "border-text-secondary"
                  : "border-border-subtle hover:border-border-focus"
              }
            `}
          >
            {/* Input Element */}
            <div className="flex items-center w-full px-4 py-2 flex-1">
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (error) setError("");
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder="https://yourwebsite.com"
                spellCheck={false}
                autoComplete="off"
                className="w-full bg-transparent text-text-primary text-sm sm:text-base placeholder:text-text-placeholder focus:outline-none"
              />
            </div>

            {/* Action Button */}
            <button
              onClick={handleSubmit}
              className="
                w-full sm:w-auto px-6 py-2.5 rounded-full font-medium text-sm
                bg-text-primary text-bg-primary
                hover:bg-white active:scale-98
                transition-all duration-150 whitespace-nowrap
                flex items-center justify-center gap-2 cursor-pointer
              "
            >
              <span>Start with your website</span>
              <span>&rarr;</span>
            </button>
          </div>

          {/* Validation error */}
          {error && (
            <p className="mt-3 text-sm text-error text-left pl-4">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

