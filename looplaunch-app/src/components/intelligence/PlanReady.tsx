"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const FILL = "#34D399";
const INK = "#04210F";
const SHOW_MS = 3600;

/**
 * The moment the first strategy lands after the research wait: a card springs up above the
 * question bar, the green tick draws itself with one ripple (as at login), then it slips away.
 * Rendered inside the fixed bottom bar, so it follows the sidebar's offset.
 */
export function PlanReady({ show, title, detail, onDone }: { show: boolean; title: string; detail?: string; onDone: () => void }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(onDone, SHOW_MS);
    return () => window.clearTimeout(t);
  }, [show, onDone]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="plan-ready"
          role="status"
          className="pointer-events-none absolute left-0 right-0 bottom-full mb-4 flex justify-center px-4"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97, transition: { duration: 0.25, ease: [0.4, 0, 1, 1] } }}
          transition={{ type: "spring", duration: 0.55, bounce: 0.3 }}
        >
          <div className="flex items-center gap-3.5 max-w-md rounded-2xl bg-[#141418] border border-[#27272A] pl-3.5 pr-5 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
            <div className="relative w-10 h-10 shrink-0">
              {!reduce && (
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full border-2"
                  style={{ borderColor: FILL }}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: [0.7, 1.7], opacity: [0.7, 0] }}
                  transition={{ delay: 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
              <svg viewBox="0 0 40 40" className="relative w-full h-full" aria-hidden="true">
                <motion.circle
                  cx="20"
                  cy="20"
                  r="19"
                  fill={FILL}
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                  initial={reduce ? false : { scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.12, type: "spring", duration: 0.5, bounce: 0.45 }}
                />
                <motion.path
                  d="M12 20.8 17.4 26.2 28 15"
                  fill="none"
                  stroke={INK}
                  strokeWidth="3.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ delay: 0.34, duration: 0.4, ease: [0.65, 0, 0.35, 1], opacity: { delay: 0.34, duration: 0.01 } }}
                />
              </svg>
            </div>
            <motion.div
              className="min-w-0"
              initial={reduce ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-[15px] font-semibold text-[#F4F4F5]">{title}</p>
              {detail && <p className="text-[13px] text-[#B4B4BC] truncate">{detail}</p>}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
