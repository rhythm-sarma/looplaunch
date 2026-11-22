"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, X } from "lucide-react";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";
import type { MindMapData } from "@/lib/intelligence/mind-map";

/**
 * A simple mind map of one answer, for people who'd rather not read the whole thing.
 * Sections become branches and each step becomes a short point (parsed in
 * lib/intelligence/mind-map.ts). Tapping a branch opens it; tapping a point shows the full
 * step right inside the map.
 */

export { parseMindMap, type MindMapBranch, type MindMapData, type MindMapLeaf } from "@/lib/intelligence/mind-map";

// ──────────────────────────────────────────────
// Dialog
// ──────────────────────────────────────────────

/** One data hue: branches are told apart by their labels and place in the tree, not by colour. */
const HUE = "#8B5CF6";
const LINE = "#3F3F46";
const ROW_PAD = 8; // vertical padding around every node row
const NODE_H = 40; // one-line node height; longer labels wrap and grow downwards
const ROOT_H = 56;
// Length of each connector arm. The tree grows sideways where it fits (1024px and up); on phones
// and tablets it grows downwards instead (each level indented under its parent), with shorter arms.
const ARM = "var(--arm)";
const TREE = "[--arm:20px] lg:[--arm:32px]";
// Connectors meet each node at the middle of its first line (10px padding + half a 20px line).
const CENTER_Y = ROW_PAD + NODE_H / 2;

/**
 * The elbow lines that join a row to its parent's spine. Sideways, the first row meets its parent
 * head on; downwards, its spine also reaches up to the parent above it.
 */
function Connector({ first, last }: { first: boolean; last: boolean }) {
  return (
    <>
      <span aria-hidden="true" className={`absolute left-0 top-0 w-px ${first ? "lg:hidden" : ""}`} style={{ height: CENTER_Y, background: LINE }} />
      {!last && <span aria-hidden="true" className="absolute left-0 bottom-0 w-px" style={{ top: CENTER_Y, background: LINE }} />}
      <span aria-hidden="true" className="absolute left-0 h-px" style={{ top: CENTER_Y, width: ARM, background: LINE }} />
    </>
  );
}

const Stub = () => (
  <span aria-hidden="true" className="hidden lg:block h-px shrink-0" style={{ width: ARM, marginTop: NODE_H / 2, background: LINE }} />
);

interface MindMapDialogProps {
  open: boolean;
  onClose: () => void;
  data: MindMapData | null;
}

export function MindMapDialog({ open, onClose, data }: MindMapDialogProps) {
  const [openBranches, setOpenBranches] = useState<Set<number>>(() => new Set([0]));
  const [openLeaf, setOpenLeaf] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const branchCount = data?.branches.length ?? 0;
  const allOpen = branchCount > 0 && openBranches.size === branchCount;

  const toggleBranch = (i: number) =>
    setOpenBranches((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <AnimatePresence>
      {open && data && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Mind map of this answer"
            className="relative w-full max-w-xl lg:max-w-5xl max-h-full flex flex-col rounded-[20px] bg-[#111114] overflow-hidden"
            initial={{ y: 16, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-[#1F1F24]">
              <div className="flex items-center gap-2.5 min-w-0">
                <LoopyMascot size={30} />
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-[#F4F4F5] truncate">Mind map</h2>
                  <p className="text-[13px] leading-snug text-[#B4B4BC] sm:truncate">Tap a branch to open it. Tap a point to read the full step.</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {branchCount > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenBranches(allOpen ? new Set() : new Set(data.branches.map((_, i) => i)));
                      setOpenLeaf(null);
                    }}
                    className="px-3 h-8 rounded-full text-[13px] font-medium text-[#B4B4BC] hover:text-[#F4F4F5] hover:bg-[#1C1C21] transition-colors cursor-pointer"
                  >
                    {allOpen ? "Close all" : "Open all"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#B4B4BC] hover:text-[#F4F4F5] hover:bg-[#1C1C21] transition-colors cursor-pointer"
                  aria-label="Close mind map"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-auto px-4 sm:px-8 py-6">
              {branchCount === 0 ? (
                <p className="text-[14px] text-[#B4B4BC] text-center py-10">This answer is too short for a mind map.</p>
              ) : (
                <div className={`flex flex-col lg:flex-row lg:items-start w-full lg:w-max mx-auto ${TREE}`}>
                  {/* Centre */}
                  <div className="lg:w-48 shrink-0" style={{ marginTop: CENTER_Y - ROOT_H / 2 }}>
                    <button
                      type="button"
                      onClick={() => data.summary && setShowSummary((s) => !s)}
                      aria-expanded={data.summary ? showSummary : undefined}
                      className={`w-full rounded-2xl bg-[#F4F4F5] text-[#09090B] px-4 text-center text-sm font-semibold leading-snug flex items-center justify-center ${
                        data.summary ? "cursor-pointer hover:bg-white" : "cursor-default"
                      }`}
                      style={{ height: ROOT_H }}
                    >
                      <span className="line-clamp-2">{data.root}</span>
                    </button>
                    {showSummary && data.summary && (
                      <p className="mt-2 rounded-xl bg-[#1C1C21] p-3 text-[13px] leading-relaxed text-[#D4D4D8]">
                        {data.summary}
                      </p>
                    )}
                  </div>
                  <span aria-hidden="true" className="hidden lg:block h-px shrink-0" style={{ width: ARM, marginTop: CENTER_Y, background: LINE }} />

                  {/* Branches */}
                  <ul className="ml-3 lg:ml-0">
                    {data.branches.map((branch, bi) => {
                      const hue = HUE;
                      const isOpen = openBranches.has(bi);
                      return (
                        <li
                          key={bi}
                          className="relative flex flex-col lg:flex-row lg:items-start"
                          style={{ paddingLeft: ARM, paddingTop: ROW_PAD, paddingBottom: ROW_PAD }}
                        >
                          <Connector first={bi === 0} last={bi === branchCount - 1} />
                          <button
                            type="button"
                            onClick={() => toggleBranch(bi)}
                            aria-expanded={isOpen}
                            title={branch.label}
                            className="w-full lg:w-56 shrink-0 flex items-start gap-2 rounded-xl px-3 py-2.5 bg-[#1C1C21] hover:bg-[#232329] border transition-colors cursor-pointer"
                            style={{ minHeight: NODE_H, borderColor: isOpen ? `${hue}99` : "transparent" }}
                          >
                            <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: hue }} />
                            <span className="flex-1 line-clamp-2 text-left text-[13px] leading-5 font-semibold text-[#F4F4F5]">
                              {branch.label}
                            </span>
                            <span className="text-[12px] leading-5 text-[#8B8B94] tabular-nums">{branch.leaves.length}</span>
                            <ChevronRight
                              className={`w-3.5 h-3.5 mt-[3px] text-[#8B8B94] shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                            />
                          </button>

                          {isOpen && (
                            <>
                              <Stub />
                              <motion.ul
                                initial={{ opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.18 }}
                                className="ml-3 lg:ml-0 lg:-mt-2"
                              >
                                {branch.leaves.map((leaf, li) => {
                                  const key = `${bi}-${li}`;
                                  const leafOpen = openLeaf === key;
                                  return (
                                    <li
                                      key={key}
                                      className="relative"
                                      style={{ paddingLeft: ARM, paddingTop: ROW_PAD, paddingBottom: ROW_PAD }}
                                    >
                                      <Connector first={li === 0} last={li === branch.leaves.length - 1} />
                                      <button
                                        type="button"
                                        onClick={() => leaf.detail && setOpenLeaf(leafOpen ? null : key)}
                                        aria-expanded={leaf.detail ? leafOpen : undefined}
                                        className={`w-full lg:w-72 text-left rounded-xl border px-3 py-2.5 transition-colors ${
                                          leaf.detail ? "cursor-pointer hover:border-[#3F3F46]" : "cursor-default"
                                        } ${leafOpen ? "bg-[#17171B]" : "bg-[#111114] border-[#27272A]"}`}
                                        style={{ minHeight: NODE_H, borderColor: leafOpen ? `${hue}99` : undefined }}
                                      >
                                        <span className="flex items-start justify-between gap-2">
                                          <span className="text-[13px] leading-5 text-[#E4E4E7]">{leaf.label}</span>
                                          {leaf.detail && (
                                            <ChevronRight
                                              className={`w-3.5 h-3.5 mt-[3px] text-[#8B8B94] shrink-0 transition-transform ${
                                                leafOpen ? "rotate-90" : ""
                                              }`}
                                            />
                                          )}
                                        </span>
                                        {leafOpen && leaf.detail && (
                                          <span className="block mt-2 pt-2 border-t border-[#2E2E35] text-[13px] leading-relaxed text-[#D4D4D8]">
                                            {leaf.detail}
                                          </span>
                                        )}
                                      </button>
                                    </li>
                                  );
                                })}
                              </motion.ul>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
