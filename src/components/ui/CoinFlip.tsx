"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

export type Starter = "you" | "ai";

const FLIP_MS = 1700; // spin + a beat to read the result
const STILL_MS = 900; // no spin (later rounds, or reduced motion): just show who starts
const EASE = [0.22, 1, 0.36, 1] as const;

const toss = (): Starter => (Math.random() < 0.5 ? "you" : "ai");

/**
 * Who starts each round. A coin flip decides the first round (on mount); after that the
 * starter alternates every time `restart()` is called, so neither side always goes first.
 * `onDone(first)` fires once the intro is over (e.g. let the AI make the opening move).
 */
export function useCoinFlip(onDone: (first: Starter) => void) {
  const reduce = useReducedMotion();
  // games mount only after client-side navigation, so a random first toss is safe
  const [state, setState] = useState<{ first: Starter; flipping: boolean; round: number }>(() => ({
    first: toss(),
    flipping: true,
    round: 0,
  }));
  const spins = state.round === 0 && !reduce; // only the opening toss spins
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    if (!state.flipping) return;
    const t = setTimeout(() => {
      setState((s) => ({ ...s, flipping: false }));
      done.current(state.first);
    }, spins ? FLIP_MS : STILL_MS);
    return () => clearTimeout(t);
  }, [state.flipping, state.round, state.first, spins]);

  // next round: the other side starts
  const restart = useCallback(
    () => setState((s) => ({ first: s.first === "you" ? "ai" : "you", flipping: true, round: s.round + 1 })),
    [],
  );

  return { first: state.first, flipping: state.flipping, round: state.round, restart };
}

/** Overlay shown over the board before each round: the spinning coin on round 0, then "taking turns". */
export function CoinOverlay({ first, round }: { first: Starter; round: number }) {
  const reduce = useReducedMotion() || round > 0;
  // 4 full turns, landing on the right face (AI is the back face)
  const end = 1440 + (first === "ai" ? 180 : 0);
  const face = "absolute inset-0 flex items-center justify-center rounded-full font-pixel text-sm [backface-visibility:hidden]";

  return (
    <motion.div
      key={round}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-bg/80 backdrop-blur-[1px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      role="status"
      aria-live="polite"
      aria-label={`${round === 0 ? "Coin flip: " : "Taking turns: "}${first === "you" ? "you go first" : "the AI goes first"}`}
    >
      <div className="[perspective:600px]">
        <motion.div
          className="relative h-20 w-20 [transform-style:preserve-3d]"
          initial={{ rotateY: reduce ? end : 0, y: 0 }}
          animate={{ rotateY: end, y: reduce ? 0 : [0, -36, 0] }}
          transition={{ duration: reduce ? 0 : 1.05, ease: EASE }}
        >
          <span className={`${face} bg-accent text-accent-ink`}>YOU</span>
          <span className={`${face} bg-ink text-bg [transform:rotateY(180deg)]`}>AI</span>
        </motion.div>
      </div>
      <motion.p
        className={`text-sm ${first === "you" ? "text-accent" : "text-ink"}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : 1.1, duration: 0.2, ease: EASE }}
      >
        {first === "you" ? "You go first" : "AI goes first"}
        {round > 0 && <span className="text-muted"> · taking turns</span>}
      </motion.p>
    </motion.div>
  );
}
