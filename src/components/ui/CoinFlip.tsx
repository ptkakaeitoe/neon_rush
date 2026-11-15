"use client";

import { motion, type Transition, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useArcade } from "../ArcadeProvider";

export type Starter = "you" | "ai";

const TOSS_S = 1.5; // toss: rise, tumble, fall, bounce, settle (seconds)
const FLIP_MS = 2300; // toss + a beat to read the result
const STILL_MS = 1000; // later rounds / reduced motion: no toss, just show who starts
const TURNS = 6; // full flips before landing
const COIN = 96; // px
const THICK = 8; // px of edge
const EDGE_LAYERS = 8;

const toss = (): Starter => (Math.random() < 0.5 ? "you" : "ai");

export type CoinPhase = "ready" | "tossing";

/**
 * Who starts each round.
 * Round 0: the coin waits (`phase: "ready"`) until the player calls `toss()` (click / Space / Enter),
 * then animates and lands. Later rounds: the starter alternates automatically after `restart()`.
 * `onDone(first)` fires once per round when the intro ends, or immediately on `skip()` mid-toss.
 */
export function useCoinFlip(onDone: (first: Starter) => void) {
  const reduce = useReducedMotion();
  // games mount only after client-side navigation, so a random first toss is safe
  const [state, setState] = useState<{ first: Starter; flipping: boolean; round: number; phase: CoinPhase }>(() => ({
    first: toss(),
    flipping: true,
    round: 0,
    phase: "ready",
  }));
  const spins = state.round === 0 && !reduce; // only the opening toss is animated
  const done = useRef(onDone);
  const firedFor = useRef(-1); // round whose onDone already fired
  useEffect(() => {
    done.current = onDone;
  });

  const finish = useCallback((round: number, first: Starter) => {
    if (firedFor.current === round) return;
    firedFor.current = round;
    setState((s) => (s.round === round ? { ...s, flipping: false } : s));
    done.current(first);
  }, []);

  // the timer only runs once the coin is actually in the air
  useEffect(() => {
    if (!state.flipping || state.phase !== "tossing") return;
    const t = setTimeout(() => finish(state.round, state.first), spins ? FLIP_MS : STILL_MS);
    return () => clearTimeout(t);
  }, [state.flipping, state.phase, state.round, state.first, spins, finish]);

  /** Throw the coin (round 0 waits for this). */
  const tossCoin = useCallback(() => setState((s) => (s.phase === "ready" ? { ...s, phase: "tossing" } : s)), []);

  // next round: the other side starts, no click needed (restarting before the first flip keeps the coin waiting)
  const restart = useCallback(
    () =>
      setState((s) =>
        s.phase === "ready" ? s : { first: s.first === "you" ? "ai" : "you", flipping: true, round: s.round + 1, phase: "tossing" },
      ),
    [],
  );
  const skip = useCallback(() => finish(state.round, state.first), [finish, state.round, state.first]);

  return { first: state.first, flipping: state.flipping, round: state.round, phase: state.phase, toss: tossCoin, restart, skip };
}

/* ---------------- the coin ---------------- */

function Face({ who, back = false }: { who: Starter; back?: boolean }) {
  const you = who === "you";
  return (
    <span
      className={`absolute inset-0 flex items-center justify-center rounded-full [backface-visibility:hidden] ${
        you ? "bg-accent text-accent-ink" : "bg-ink text-bg"
      }`}
      style={{ transform: back ? `rotateX(180deg) translateZ(${THICK / 2}px)` : `translateZ(${THICK / 2}px)` }}
    >
      {/* milled rim + inner ring, like a real coin face */}
      <span className={`absolute inset-[5px] rounded-full border-2 ${you ? "border-accent-ink/25" : "border-bg/25"}`} />
      <span className={`absolute inset-[11px] rounded-full border border-dashed ${you ? "border-accent-ink/20" : "border-bg/20"}`} />
      <span className="font-pixel relative text-base">{you ? "YOU" : "AI"}</span>
    </span>
  );
}

/** The coin's edge: thin discs stacked through its thickness, visible whenever it's tilted. */
function Edge() {
  return (
    <>
      {Array.from({ length: EDGE_LAYERS }, (_, i) => {
        const z = -THICK / 2 + (i + 0.5) * (THICK / EDGE_LAYERS);
        return (
          <span
            key={i}
            className="absolute inset-0 rounded-full"
            style={{ transform: `translateZ(${z}px)`, background: i % 2 ? "#3a3a40" : "#2c2c31" }}
            aria-hidden
          />
        );
      })}
    </>
  );
}

/**
 * Overlay shown over the board before each round.
 * Round 0: the coin waits until you click it (or press Space / Enter), then it's tossed (arc,
 * tumble, shadow, bounce, wobble) and only then shows the result. Click / any key skips the toss.
 * Later rounds: it drops in already showing who starts ("taking turns").
 */
export function CoinOverlay({
  first,
  round,
  phase,
  onToss,
  onSkip,
}: {
  first: Starter;
  round: number;
  phase: CoinPhase;
  onToss: () => void;
  onSkip: () => void;
}) {
  const { play } = useArcade();
  const reduce = useReducedMotion();
  const still = reduce || round > 0;
  const ready = phase === "ready";
  const land = TURNS * 360 + (first === "ai" ? 180 : 0); // AI is the back face

  // flick on toss, clink on landing (nothing while the coin is waiting)
  useEffect(() => {
    if (ready) return;
    if (still) {
      play("coin");
      return;
    }
    play("move");
    const t = setTimeout(() => play("coin"), TOSS_S * 0.72 * 1000);
    return () => clearTimeout(t);
  }, [ready, still, play]);

  // waiting: Space / Enter toss (Esc still leaves the game). In the air: any key skips.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (ready) {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          e.stopImmediatePropagation();
          onToss();
        }
        return;
      }
      e.stopImmediatePropagation();
      onSkip();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [ready, onToss, onSkip]);

  // keyframe times: 0 toss → .34 apex → .72 lands → .82 bounce top → 1 settled
  const times = [0, 0.34, 0.72, 0.82, 1];
  const tossAnim = ready
    ? reduce
      ? { y: 0, rotateX: 0, scale: 1 }
      : { y: [0, -5, 0], rotateX: [0, 8, 0], scale: 1 } // idle: gently hovering, YOU face up
    : still
    ? { y: [-24, 0], rotateX: [land - 20, land], scale: 1 }
    : {
        y: [0, -150, 0, -14, 0],
        rotateX: [0, land * 0.55, land, land + 14, land],
        scale: [1, 1.22, 1, 1.03, 1],
      };
  const phases: Transition["ease"] = ["easeOut", "easeIn", "easeOut", "easeIn"];
  const tossTransition: Transition = ready
    ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
    : still
      ? { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
      : { duration: TOSS_S, times, ease: phases };

  return (
    <motion.div
      key={round}
      className="absolute inset-0 z-20 flex cursor-pointer flex-col items-center justify-center bg-bg/85"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={ready ? onToss : onSkip}
      role="status"
      aria-live="polite"
      aria-label={
        ready
          ? "Coin flip: click the coin or press Space to flip"
          : `${round === 0 ? "Coin flip: " : "Taking turns: "}${first === "you" ? "you go first" : "the AI goes first"}`
      }
    >
      <div className="relative flex flex-col items-center" style={{ perspective: 700 }}>
        <motion.div
          key={phase}
          className="relative"
          style={{ width: COIN, height: COIN, transformStyle: "preserve-3d" }}
          initial={false}
          animate={tossAnim}
          transition={tossTransition}
        >
          <Edge />
          <Face who="you" />
          <Face who="ai" back />
        </motion.div>
        {/* ground shadow: shrinks and fades as the coin rises */}
        <motion.span
          className="mt-3 h-2 rounded-[50%] bg-black"
          style={{ width: COIN * 0.8 }}
          initial={false}
          animate={ready || still ? { opacity: 0.55, scaleX: 1 } : { opacity: [0.55, 0.15, 0.55, 0.45, 0.55], scaleX: [1, 0.45, 1, 0.9, 1] }}
          transition={ready || still ? { duration: 0.3 } : { duration: TOSS_S, times, ease: phases }}
          aria-hidden
        />
      </div>

      {ready ? (
          <button
            autoFocus
            onClick={(e) => {
              e.stopPropagation();
              onToss();
            }}
            className="mt-5 h-9 rounded-md bg-accent px-4 text-[13px] font-medium text-accent-ink transition-[filter] duration-150 hover:brightness-110"
          >
            Flip the coin
          </button>
      ) : (
        <motion.p
          key={`result-${round}`}
          className="mt-5 text-sm"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: still ? 0.15 : TOSS_S * 0.8, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className={first === "you" ? "text-accent" : "text-ink"}>{first === "you" ? "You go first" : "AI goes first"}</span>
          {round > 0 && <span className="text-muted"> · taking turns</span>}
        </motion.p>
      )}
    </motion.div>
  );
}
