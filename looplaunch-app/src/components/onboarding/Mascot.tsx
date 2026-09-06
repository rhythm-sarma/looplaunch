"use client";

import Image from "next/image";

export type MascotVariant = "default" | "hero" | "research" | "strategy" | "cta";

interface MascotProps {
  size?: number;
  className?: string;
  variant?: MascotVariant;
}

export function Mascot({
  size = 72,
  className = "",
}: MascotProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Hand-drawn doodle bird brand signature */}
      <div className="relative w-full h-full animate-mascot-float flex items-center justify-center">
        <Image
          src="/mascot/bird.jpg"
          alt="Loop Launch bird mascot"
          width={size}
          height={size}
          className="rounded-full object-cover"
          style={{
            filter: "invert(1) brightness(1.2) contrast(1.1)",
            mixBlendMode: "screen",
          }}
          priority
        />
      </div>
    </div>
  );
}
