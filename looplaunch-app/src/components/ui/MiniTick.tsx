"use client";

import { motion, useReducedMotion } from "motion/react";

const FILL = "#34D399";
const INK = "#04210F";

/**
 * The login tick (src/components/auth/SuccessTick.tsx) at icon size, for small wins: a PDF saved,
 * an answer copied, daily emails switched on. The green disc springs in and the tick draws across it.
 */
export function MiniTick({ size = 16, className = "" }: { size?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={`shrink-0 ${className}`} aria-hidden="true">
      <motion.circle
        cx="12"
        cy="12"
        r="11"
        fill={FILL}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        initial={reduce ? false : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", duration: 0.45, bounce: 0.45 }}
      />
      <motion.path
        d="M7 12.4 10.4 15.8 17 9"
        fill="none"
        stroke={INK}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ delay: 0.18, duration: 0.32, ease: [0.65, 0, 0.35, 1], opacity: { delay: 0.18, duration: 0.01 } }}
      />
    </svg>
  );
}
