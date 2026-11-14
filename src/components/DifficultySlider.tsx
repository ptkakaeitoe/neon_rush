"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { audio } from "@/lib/audio";
import { DIFFICULTIES, DIFFICULTY_LABEL, type Difficulty } from "@/lib/stats";
import { useArcade } from "./ArcadeProvider";

const BLURB: Record<Difficulty, string> = {
  easy: "Shallow lookahead. Makes mistakes.",
  medium: "Looks a few moves ahead. Slips sometimes.",
  hard: "Deeper search. Rarely blunders.",
  unbeatable: "Full search depth. Good luck.",
};
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Neutral segmented control for AI difficulty; the active level takes the single accent.
 * Mid-game (`inProgress`), picking a new level asks "Restart on Hard?" inline instead of switching.
 */
export function DifficultySlider({
  compact = false,
  fill = false,
  inProgress = false,
  onRestart,
}: {
  compact?: boolean;
  /** stretch to the parent's width (game panel), each level an equal segment */
  fill?: boolean;
  inProgress?: boolean;
  onRestart?: () => void;
}) {
  const { difficulty, setDifficulty } = useArcade();
  const [pending, setPending] = useState<Difficulty | null>(null);

  // Esc cancels an open confirmation (and stops there, so the page doesn't also navigate away)
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      setPending(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [pending]);

  const choose = (d: Difficulty) => {
    if (d === difficulty) return setPending(null);
    if (inProgress && onRestart) return setPending(d);
    setDifficulty(d);
    audio.sfx("move");
  };

  return (
    <div className={fill ? "relative w-full" : compact ? "relative" : "w-full max-w-sm"}>
      {!compact && !fill && <p className="label mb-3">AI difficulty</p>}
      <div role="radiogroup" aria-label="AI difficulty" className={`${fill ? "flex w-full" : "inline-flex"} gap-1 rounded-md border border-line-strong p-1`}>
        {DIFFICULTIES.map((d) => {
          const active = d === difficulty;
          return (
            <button
              key={d}
              role="radio"
              aria-checked={active}
              title={BLURB[d]}
              onClick={() => choose(d)}
              className={`relative rounded text-xs font-medium transition-colors duration-150 ${fill ? "h-8 flex-1" : compact ? "h-8 px-3" : "h-9 px-4"} ${
                active ? "text-accent-ink" : pending === d ? "text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {active && (
                <motion.span
                  layoutId={compact ? "diff-pill-compact" : "diff-pill"}
                  className="absolute inset-0 rounded bg-accent"
                  transition={{ duration: 0.2, ease: EASE }}
                />
              )}
              {pending === d && <span className="absolute inset-0 rounded border border-line-strong" aria-hidden />}
              <span className="relative">{DIFFICULTY_LABEL[d]}</span>
            </button>
          );
        })}
      </div>

      {/* inline confirmation, no modal */}
      <AnimatePresence>
        {pending && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: EASE }}
            role="group"
            aria-label="Confirm difficulty change"
            className="absolute left-0 right-0 top-full z-20 mt-2 flex justify-between items-center gap-2 whitespace-nowrap rounded-md border border-line-strong bg-bg py-1.5 pl-3 pr-1.5 text-xs shadow-2xl shadow-black/60"
          >
            <span className="text-ink">Restart on {DIFFICULTY_LABEL[pending]}?</span>
            <button
              autoFocus
              onClick={() => {
                setDifficulty(pending);
                setPending(null);
                audio.sfx("move");
                onRestart?.();
              }}
              className="h-7 rounded bg-accent px-2.5 font-medium text-accent-ink transition-[filter] duration-150 hover:brightness-110"
            >
              Restart
            </button>
            <button onClick={() => setPending(null)} className="h-7 rounded px-2 text-muted transition-colors duration-150 hover:text-ink">
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {!compact && !fill && <p className="mt-3 text-[13px] text-muted">{BLURB[difficulty]}</p>}
    </div>
  );
}
