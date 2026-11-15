"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

/** good = favours the AI, bad = favours you */
export type Tone = "good" | "even" | "bad";
export const toneOf = (n: number): Tone => (n > 0 ? "good" : n < 0 ? "bad" : "even");
const TONE_TEXT: Record<Tone, string> = { good: "text-accent", even: "text-ink", bad: "text-muted" };

/** One of the AI's candidate moves (top row of the tree). */
export type TreeRoot = { key: number; label: string; score: string | null; tone: Tone; mini?: ReactNode; title?: string };
/** A reply compared at a step. `cut`: "bound" = stopped early once proven worse, "pruned" = never searched. */
export type TreeOption = { key: number; label: string; score: string; tone: Tone; cut?: "bound" | "pruned"; title?: string };
/** One step of the expected line. */
export type TreeStep = { who: "you" | "ai"; label: string; score: string; tone: Tone; mini: ReactNode; options: TreeOption[]; pick: number };

/**
 * The AI's search as a tree: its candidate moves across the top, and under the selected one the line it
 * expects (each side taking its best reply), with the replies it compared branching off each step.
 */
export function ThinkTree({
  title,
  roots,
  probing,
  played,
  selected,
  onSelect,
  steps,
  end,
  legend,
  runId,
}: {
  title: string;
  roots: TreeRoot[];
  /** root being searched right now (-1 = none) */
  probing: number;
  /** root the AI actually played (-1 while thinking) */
  played: number;
  selected: number;
  onSelect: (key: number) => void;
  /** null while the AI is still searching */
  steps: TreeStep[] | null;
  end: { text: string; tone: Tone } | null;
  legend: ReactNode;
  /** changes whenever a new line is shown, to replay the reveal */
  runId: string;
}) {
  return (
    <section aria-label={title}>
      <div className="flex items-baseline justify-between gap-4">
        <p className="label">{title}</p>
        {played >= 0 && <p className="text-[11px] text-faint">Pick a move to see its line</p>}
      </div>

      {/* level 0: every move the AI considered */}
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" role="listbox" aria-label="AI's candidate moves">
        {roots.map((r) => {
          const sel = r.key === selected && played >= 0;
          return (
            <button
              key={r.key}
              role="option"
              aria-selected={sel}
              disabled={played < 0}
              onClick={() => onSelect(r.key)}
              title={r.title}
              className={`relative flex min-w-11 flex-1 flex-col items-center gap-1 rounded-md border px-1 py-1.5 transition-colors duration-150 ${
                sel ? "border-accent bg-accent/[0.06]" : "border-line enabled:hover:border-line-strong"
              } ${probing === r.key ? "ring-1 ring-ink/60" : ""}`}
            >
              {r.mini}
              <span className="text-[10px] leading-none text-muted">{r.label}</span>
              <span className={`text-[11px] leading-none tabular-nums ${r.score === null ? "text-faint" : TONE_TEXT[r.tone]}`}>{r.score ?? "·"}</span>
              {r.key === played && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" aria-label="played" />}
            </button>
          );
        })}
      </div>

      {/* the expected line under the selected move */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.ol
          key={runId}
          className="relative mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          {steps === null ? (
            <li className="text-[12px] text-muted">Scoring each move…</li>
          ) : (
            <>
              {/* rail through the step boards */}
              <span className="absolute bottom-3 left-[19px] top-3 w-px bg-line-strong" aria-hidden />
              {steps.map((s, i) => (
                <motion.li
                  key={i}
                  className="relative flex items-start gap-3 py-1.5"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07, duration: 0.2, ease: EASE }}
                >
                  <span className="relative flex w-10 shrink-0 justify-center bg-bg py-0.5">{s.mini}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3 text-[12px]">
                      <span className="min-w-0 truncate">
                        <span className={s.who === "ai" ? "text-ink" : "text-accent"}>{s.who === "ai" ? "AI" : "You"}</span>
                        <span className="text-muted"> · {s.label}</span>
                      </span>
                      <span className={`shrink-0 tabular-nums ${TONE_TEXT[s.tone]}`}>{s.score}</span>
                    </div>
                    {s.options.length > 1 && (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="mr-0.5 text-[10px] text-faint">{s.who === "ai" ? "max of" : "min of"}</span>
                        {s.options.map((o) => (
                          <span
                            key={o.key}
                            title={o.title}
                            className={`rounded-sm border px-1 py-px text-[10px] tabular-nums leading-tight ${
                              o.key === s.pick
                                ? "border-line-strong text-ink"
                                : o.cut
                                  ? "border-dashed border-line text-faint"
                                  : "border-line text-muted"
                            }`}
                          >
                            {o.label} <span className={o.key === s.pick ? TONE_TEXT[o.tone] : ""}>{o.score}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.li>
              ))}
              {end && (
                <motion.li
                  className="relative flex items-center gap-3 py-1.5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: steps.length * 0.07, duration: 0.2 }}
                >
                  <span className="relative flex w-10 shrink-0 justify-center bg-bg py-1">
                    <span className={`h-2 w-2 ${end.tone === "good" ? "bg-ink" : end.tone === "bad" ? "bg-accent" : "bg-muted"}`} aria-hidden />
                  </span>
                  <span className="text-[12px] text-ink">{end.text}</span>
                </motion.li>
              )}
            </>
          )}
        </motion.ol>
      </AnimatePresence>

      <p className="mt-3 text-[11px] leading-relaxed text-faint">{legend}</p>
    </section>
  );
}
