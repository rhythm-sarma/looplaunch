"use client";

import { motion, useReducedMotion } from "motion/react";

export const LOOPY_SRC = "/loopy.png";

interface LoopyMascotProps {
  size?: number;
  className?: string;
  /**
   * "hover" rests and waves when pointed at. "float" bobs on its own, for while Loopy is working.
   * "wave" loops a head tilt beside a speech bubble. "still" never moves.
   * "cheer" hops and wiggles once as it appears (a new answer from Loopy), then stays still.
   */
  mood?: "hover" | "float" | "wave" | "still" | "cheer";
}

const LOOPS = {
  float: { y: [0, -5, 0], rotate: [-2, 2, -2] },
  wave: { y: [0, -6, 0], rotate: [0, -6, 4, 0] },
};

const CHEER = {
  y: [0, -7, 0, -2.5, 0],
  rotate: [0, -12, 9, -4, 0],
  scale: [1, 1.12, 0.98, 1.03, 1],
  transition: { delay: 0.2, duration: 0.85, ease: "easeInOut" as const },
};

const HOVER_WAVE = { rotate: [0, -8, 6, 0], y: [0, -4, 0], transition: { duration: 0.8, ease: "easeInOut" as const } };

/** Loopy, the Loop Launch mascot. Respects prefers-reduced-motion. */
export function LoopyMascot({ size = 64, className = "", mood = "hover" }: LoopyMascotProps) {
  const reduce = useReducedMotion();
  const loop = !reduce && (mood === "float" || mood === "wave") ? LOOPS[mood] : undefined;
  const cheer = !reduce && mood === "cheer" ? CHEER : undefined;

  return (
    <motion.div
      className={`relative shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
      animate={cheer ?? loop}
      transition={cheer ? undefined : { duration: mood === "wave" ? 2.2 : 3.6, repeat: Infinity, ease: "easeInOut" }}
      whileHover={!reduce && mood === "hover" ? HOVER_WAVE : undefined}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOOPY_SRC}
        alt=""
        width={size}
        height={size}
        draggable={false}
        className="w-full h-full object-contain rounded-full"
      />
    </motion.div>
  );
}
