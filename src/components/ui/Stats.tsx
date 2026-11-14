"use client";

import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { type Difficulty, type GameId, type Result, type Tally, useGameStats } from "@/lib/stats";

/* ---------------- result strip (in-match rounds) ---------------- */

/** Played results only, newest first: win = accent, draw = white, loss = 1px outline. 6px squares, 3px gap. */
export function ResultStrip({ results, max }: { results: Result[]; max: number }) {
  const shown = results.slice(0, max);
  if (!shown.length) return null;
  return (
    <span
      className="inline-flex gap-[3px]"
      role="img"
      aria-label={`${shown.length} rounds, newest first: ${shown.map((r) => ({ w: "win", d: "tie", l: "loss" })[r]).join(", ")}`}
    >
      {shown.map((r, i) => (
        <span key={i} className={`h-1.5 w-1.5 ${r === "w" ? "bg-accent" : r === "d" ? "bg-ink" : "border border-muted"}`} />
      ))}
    </span>
  );
}

/* ---------------- W · D · L ---------------- */

/** Games that can end in a draw show the D column; maze and RPS matches always end in a win or a loss. */
const CAN_DRAW: Record<GameId, boolean> = { tictactoe: true, connect4: true, maze: false, rps: false };

const n = (v: number, one: string, many = `${one}s`) => `${v} ${v === 1 ? one : many}`;

function Part({ k, v }: { k: string; v: number }) {
  return (
    <span>
      <span className="text-muted">{k}</span>
      <span className="ml-1 text-ink">{v.toLocaleString()}</span>
    </span>
  );
}

/** "W 2 · D 1 · L 3": one nowrap unit; letters muted, numbers bright, tabular. */
export function Record({ s, draws }: { s: Tally; draws: boolean }) {
  return (
    <span
      className="whitespace-nowrap tabular-nums"
      aria-label={`${n(s.w, "win")}, ${draws ? `${n(s.d, "draw")}, ` : ""}${n(s.l, "loss", "losses")}`}
    >
      <Part k="W" v={s.w} />
      {draws && (
        <>
          <span className="mx-2 text-faint">·</span>
          <Part k="D" v={s.d} />
        </>
      )}
      <span className="mx-2 text-faint">·</span>
      <Part k="L" v={s.l} />
    </span>
  );
}

/** Landing row: totals across difficulties, or a muted dash before the first game. */
export function RecordStat({ gameId }: { gameId: GameId }) {
  const { totals } = useGameStats(gameId);
  return (
    <span className="block text-right text-xs">
      {totals.w + totals.d + totals.l === 0 ? <span className="text-muted">—</span> : <Record s={totals} draws={CAN_DRAW[gameId]} />}
    </span>
  );
}

/** Game panel: the record at the selected difficulty. */
export function RecordRow({ gameId, difficulty }: { gameId: GameId; difficulty: Difficulty }) {
  const { byDifficulty } = useGameStats(gameId);
  return (
    <div className="text-sm">
      <Record s={byDifficulty[difficulty]} draws={CAN_DRAW[gameId]} />
    </div>
  );
}

/* ---------------- count-up number ---------------- */

/** Tweens to the new value over ~400ms (instant with reduced motion). Tabular, thousands separators. */
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString() }: { value: number; format?: (n: number) => string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (reduce) {
      from.current = value;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync display with value when motion is off
      setShown(value);
      return;
    }
    const controls = animate(from.current, value, {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        from.current = v;
        setShown(v);
      },
    });
    return () => controls.stop();
  }, [value, reduce]);

  return <span className="tabular-nums">{format(shown)}</span>;
}
