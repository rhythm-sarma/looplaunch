"use client";

import { Mascot } from "@/components/onboarding/Mascot";

interface FinalCtaSectionProps {
  onGetStarted: () => void;
}

export function FinalCtaSection({ onGetStarted }: FinalCtaSectionProps) {
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
          Get your strategic intelligence profile in under 2 minutes.
        </p>

        {/* CTA Button */}
        <button
          onClick={onGetStarted}
          className="
            px-8 py-3.5 rounded-full font-medium text-sm sm:text-base
            bg-[#9d5ce6] text-white
            hover:bg-[#ad6ef8] hover:shadow-[0_0_20px_rgba(157,92,230,0.35)] active:scale-95
            transition-all duration-150 whitespace-nowrap
            flex items-center justify-center gap-2 cursor-pointer
          "
        >
          <span>Get Started</span>
          <span>&rarr;</span>
        </button>
      </div>
    </section>
  );
}
