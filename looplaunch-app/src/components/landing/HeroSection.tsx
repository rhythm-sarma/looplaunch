"use client";

import { useState, type KeyboardEvent } from "react";
import Ferrofluid from "@/components/ui/Ferrofluid";
import { Mascot } from "@/components/onboarding/Mascot";
import { isValidUrl, normalizeUrl } from "@/lib/onboarding/validation";

interface HeroSectionProps {
  initialUrl?: string;
  onSubmit: (url: string) => void;
}

export function HeroSection({ initialUrl = "", onSubmit }: HeroSectionProps) {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState("");

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

  const scrollToExplore = () => {
    const nextSection = document.getElementById("what-is-it");
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative min-h-[92vh] flex flex-col justify-between items-center px-6 pt-16 pb-12 overflow-hidden bg-bg-primary text-text-primary">
      {/* Layer 0: Ferrofluid Background */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        aria-hidden="true"
      >
        <Ferrofluid
          colors={["#ffffff", "#ffffff", "#ffffff"]}
          speed={0.12}
          scale={1.9}
          turbulence={0.8}
          fluidity={0.12}
          rimWidth={0.16}
          sharpness={3}
          shimmer={0.8}
          glow={9}
          flowDirection="down"
          opacity={0.35}
          mouseInteraction={true}
          mouseStrength={0.7}
          mouseRadius={0.9}
          mouseDampening={0.2}
          dpr={typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 1.5) : 1}
        />
      </div>

      {/* Layer 1: Soft dark atmospheric overlay for strong text contrast */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none bg-gradient-to-b from-bg-primary/40 via-transparent to-bg-primary/80"
        aria-hidden="true"
      />

      {/* Layer 2: Main Hero Content */}
      <div className="relative z-[2] w-full max-w-xl mx-auto flex flex-col items-center text-center my-auto py-12">
        {/* Hand-drawn bird mascot */}
        <div className="mb-8">
          <Mascot size={64} />
        </div>

        {/* Confident, editorial headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-normal tracking-tight text-text-primary mb-4 leading-[1.12]">
          What’s your website?
        </h1>

        {/* Short, direct supporting copy */}
        <p className="text-text-secondary text-base sm:text-lg max-w-md mb-10 leading-relaxed font-normal">
          Paste your company website and we&apos;ll take it from there.
        </p>

        {/* Elegant, calm input bar */}
        <div className="w-full max-w-lg mx-auto">
          <div
            className={`
              relative flex items-center w-full px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl
              bg-bg-surface border transition-colors duration-200
              ${error
                ? "border-error"
                : "border-border-subtle hover:border-border-focus focus-within:border-white/30"
              }
            `}
          >
            {/* Input Element */}
            <input
              id="hero-website-input"
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError("");
              }}
              onKeyDown={handleKeyDown}
              placeholder="https://yourwebsite.com"
              spellCheck={false}
              autoComplete="off"
              className="
                flex-1 bg-transparent text-text-primary text-base sm:text-lg
                placeholder:text-text-placeholder focus:outline-none py-1
              "
            />

            {/* Continue Arrow Button */}
            <button
              onClick={handleSubmit}
              aria-label="Continue with website"
              className="
                ml-2 flex items-center justify-center w-9 h-9 rounded-lg
                bg-text-primary text-bg-primary hover:bg-white
                transition-colors duration-200 cursor-pointer
              "
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>
            </button>
          </div>

          {/* Validation Error Message */}
          {error && (
            <p className="mt-2.5 text-xs sm:text-sm text-error text-left pl-2 animate-fade-in-up">
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Subtle, understated scroll indicator */}
      <div className="relative z-[2] w-full flex justify-center mt-auto pt-4">
        <button
          onClick={scrollToExplore}
          className="text-text-tertiary hover:text-text-secondary text-xs tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 focus:outline-none"
        >
          <span>Scroll</span>
          <span>&darr;</span>
        </button>
      </div>
    </section>
  );
}
