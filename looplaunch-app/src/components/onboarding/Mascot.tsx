"use client";

import Image from "next/image";

export type MascotVariant = "default" | "hero" | "research" | "strategy" | "cta";

interface MascotProps {
  size?: number;
  className?: string;
  variant?: MascotVariant;
}

/**
 * Loop Launch Brand Logo Component
 * Replaces old mascot with the official Loop Launch static mark/logo without animation.
 */
export function Mascot({
  size = 54,
  className = "",
}: MascotProps) {
  // Original logo aspect ratio is approx 605 x 200 (3.025 : 1)
  const width = Math.round(size * 3.025);
  const height = size;

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
    >
      <Image
        src="/logo.png"
        alt="Loop Launch"
        width={width}
        height={height}
        className="h-auto w-auto max-h-[80px] object-contain"
        priority
      />
    </div>
  );
}
