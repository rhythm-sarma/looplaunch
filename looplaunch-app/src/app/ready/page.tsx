"use client";

import Link from "next/link";
import Image from "next/image";

export default function ReadyPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-bg-primary px-6">
      {/* Mascot — celebrating */}
      <div className="mb-8 animate-mascot-float">
        <Image
          src="/mascot/bird.jpg"
          alt="Loop Launch mascot celebrating"
          width={80}
          height={80}
          className="rounded-full"
          style={{
            filter: "invert(1)",
            mixBlendMode: "screen",
          }}
        />
      </div>

      {/* Heading */}
      <h1 className="text-3xl sm:text-4xl font-semibold text-text-primary text-center leading-tight mb-3 animate-fade-in-up">
        Your Loop Launch workspace is ready.
      </h1>

      <p
        className="text-text-secondary text-base sm:text-lg text-center max-w-md leading-relaxed mb-12 animate-fade-in-up"
        style={{ animationDelay: "100ms" }}
      >
        We&apos;ve captured everything we need. The analysis pipeline will connect here.
      </p>

      {/* Placeholder status */}
      <div
        className="animate-fade-in-up w-full max-w-sm"
        style={{ animationDelay: "200ms" }}
      >
        <div className="rounded-lg border border-border-subtle bg-bg-surface p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-shimmer" />
            <span className="text-sm font-medium text-text-secondary">
              Workspace active
            </span>
          </div>
          <p className="text-xs text-text-tertiary leading-relaxed">
            When the analysis backend is connected, your strategic diagnosis, competitor research, and actionable recommendations will appear here.
          </p>
        </div>
      </div>

      {/* Back link */}
      <div
        className="mt-10 animate-fade-in-up"
        style={{ animationDelay: "300ms" }}
      >
        <Link
          href="/"
          className="text-sm text-text-tertiary hover:text-text-primary transition-colors duration-200"
        >
          &larr; Edit onboarding answers
        </Link>
      </div>
    </main>
  );
}
