"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { type Board, count, type Disc, initialBoard, isOver, legalMoves, type MctsResult, mctsMove, play } from "@/lib/ai/othello";
import { type Outcome, useArcade } from "../ArcadeProvider";
import { GameFrame } from "../GameFrame";
import { coord, gridKeyDown } from "../ui/gridKeys";

// thinking budget per level; easy also plays a random legal move some of the time
const LEVEL = {
  easy: { ms: 60, random: 0.3 },
  medium: { ms: 200, random: 0.05 },
  hard: { ms: 600, random: 0 },
  unbeatable: { ms: 1200, random: 0 },
} as const;
const COLOR = { 1: "#8cff73", 2: "#fafafa" } as const;
const EASE = [0.22, 1, 0.36, 1] as const;
const AI_DELAY = 380;
// 8 columns: ~40px on a 375px phone, 48px max on desktop
const CELL = "min(3rem, calc((100vw - 2rem - 18px) / 8))";

type Search = Pick<MctsResult, "simulations" | "winRate" | "ms" | "moves"> & { move: number };
const EMPTY_SEARCH: Search = { simulations: 0, winRate: 0, ms: 0, moves: [], move: -1 };

export function Othello() {
  const { difficulty, play: sfx } = useArcade();
  const reduce = useReducedMotion();
  const [board, setBoard] = useState<Board>(initialBoard);
  const [turn, setTurn] = useState<Disc>(1);
  const [result, setResult] = useState<Outcome | null>(null);
  const [lastAi, setLastAi] = useState(-1);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState<Search>(EMPTY_SEARCH);
  const [showMoves, setShowMoves] = useState(true);
  const [hover, setHover] = useState(-1);
  const [passNote, setPassNote] = useState<string | null>(null);
  const [moves, setMoves] = useState(0);

  const legal = turn === 1 && !result ? legalMoves(board, 1) : [];
  const { you, ai } = count(board);

  const settle = useCallback((b: Board) => {
    if (!isOver(b)) return false;
    const c = count(b);
    setResult(c.you > c.ai ? "win" : c.you < c.ai ? "lose" : "draw");
    return true;
  }, []);

  /** Apply a move and hand the turn over, passing automatically when the next player is stuck. */
  const apply = useCallback(
    (b: Board, idx: number, p: Disc) => {
      const nb = play(b, idx, p);
      setFlipped(new Set(nb.map((v, i) => (v !== b[i] && i !== idx ? i : -1)).filter((i) => i >= 0)));
      setBoard(nb);
      setMoves((m) => m + 1);
      if (settle(nb)) return;
      const next: Disc = p === 1 ? 2 : 1;
      if (legalMoves(nb, next).length) {
        setPassNote(null);
        setTurn(next);
      } else {
        setPassNote(next === 1 ? "You have no legal move, so you pass." : "The AI has no legal move and passes.");
        setTurn(p);
      }
    },
    [settle],
  );

  const place = (idx: number) => {
    if (turn !== 1 || result || !legal.includes(idx)) return;
    sfx("drop");
    apply(board, idx, 1);
  };

  // AI turn
  useEffect(() => {
    if (turn !== 2 || result) return;
    const t = setTimeout(() => {
      const lvl = LEVEL[difficulty];
      const res = mctsMove(board, 2, lvl.ms);
      let move = res.move;
      const options = legalMoves(board, 2);
      if (Math.random() < lvl.random && options.length) move = options[Math.floor(Math.random() * options.length)];
      setSearch({ simulations: res.simulations, winRate: res.winRate, ms: res.ms, moves: res.moves, move });
      setLastAi(move);
      sfx("ai");
      apply(board, move, 2);
    }, reduce ? 0 : AI_DELAY);
    return () => clearTimeout(t);
  }, [turn, result, board, difficulty, apply, sfx, reduce]);

  const reset = useCallback(() => {
    setBoard(initialBoard());
    setTurn(1);
    setResult(null);
    setLastAi(-1);
    setFlipped(new Set());
    setSearch(EMPTY_SEARCH);
    setPassNote(null);
    setMoves(0);
    sfx("click");
  }, [sfx]);

  const aiTurn = turn === 2 && !result;
  const resultMessage =
    result === "win" ? `You out-counted MCTS, ${you}–${ai}.` : result === "lose" ? `MCTS out-counted you, ${ai}–${you}.` : `Even board, ${you}–${ai}.`;
  const top = search.moves.slice(0, 3);

  return (
    <GameFrame
      gameId="othello"
      title="Othello"
      algo="MCTS"
      status={result ? "Round over" : aiTurn ? "AI is simulating" : passNote ?? "Your turn. You play green."}
      tone={result ? "done" : aiTurn ? "ai" : "you"}
      inProgress={moves > 0 && !result}
      result={result}
      resultMessage={resultMessage}
      onReset={reset}
      keyHints="Arrows move · Enter places"
      stats={[
        { label: "Simulations", value: search.simulations },
        { label: "Chosen move wins", value: Math.round(search.winRate * 100), format: (n) => `${Math.round(n)}%` },
        { label: "Think time", value: search.ms, format: (n) => `${Math.round(n)} ms` },
      ]}
      toggles={
        <label className="flex cursor-pointer items-center gap-2 text-ink">
          <input type="checkbox" checked={showMoves} onChange={(e) => setShowMoves(e.target.checked)} />
          Show legal moves
        </label>
      }
      howItWorks="MCTS plays thousands of random games from each move and picks the one that wins most often."
      details={
        top.length > 0 && (
          <div className="text-xs">
            <p className="text-[11px] text-muted">Most-simulated moves</p>
            <ul className="mt-2 space-y-2">
              {top.map((m) => {
                const pick = m.move === search.move;
                return (
                  <li key={m.move}>
                    <div className="flex justify-between">
                      <span className={pick ? "text-accent" : "text-ink"}>
                        {coord(m.move, 8)}
                        <span className="ml-2 text-muted">{m.visits.toLocaleString()} sims</span>
                      </span>
                      <span className="tabular-nums text-ink">{Math.round(m.winRate * 100)}%</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-line-strong">
                      <motion.div
                        className={`h-full rounded-full ${pick ? "bg-accent" : "bg-muted"}`}
                        initial={false}
                        animate={{ width: `${m.winRate * 100}%` }}
                        transition={{ duration: 0.25, ease: EASE }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )
      }
    >
      <div style={{ ["--cell" as string]: CELL }}>
        <div
          className="grid gap-[2px] rounded-md border border-line bg-surface p-[3px]"
          style={{ gridTemplateColumns: "repeat(8, var(--cell))" }}
          role="grid"
          aria-label="Othello board"
          onKeyDown={gridKeyDown(8, 8)}
          onMouseLeave={() => setHover(-1)}
        >
          {board.map((v, i) => {
            const canPlay = legal.includes(i);
            return (
              <button
                key={i}
                data-cell={i}
                onClick={() => place(i)}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                aria-disabled={!canPlay}
                aria-label={`${coord(i, 8)}${v === 1 ? ", yours" : v === 2 ? ", AI" : canPlay ? ", legal move" : ""}`}
                className={`relative flex aspect-square w-[var(--cell)] items-center justify-center rounded-sm bg-bg ${canPlay ? "cursor-pointer" : "cursor-default"}`}
              >
                {v !== 0 && (
                  <motion.span
                    key={`${i}-${v}`}
                    className="absolute inset-[14%] rounded-full"
                    style={{ background: COLOR[v] }}
                    initial={reduce ? false : { scale: flipped.has(i) ? 0.6 : 0.4, opacity: 0.4 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2, ease: EASE }}
                  >
                    {i === lastAi && v === 2 && (
                      <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 bg-bg" aria-hidden />
                    )}
                  </motion.span>
                )}
                {/* legal move dot, or a ghost disc on hover */}
                {v === 0 && canPlay && (hover === i ? (
                  <span className="absolute inset-[14%] rounded-full bg-accent opacity-20" aria-hidden />
                ) : (
                  showMoves && <span className="h-1.5 w-1.5 rounded-full bg-muted" aria-hidden />
                ))}
              </button>
            );
          })}
        </div>
        <p className="mt-4 flex gap-6 text-xs text-muted">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            You <span className="tabular-nums text-ink">{you}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-ink" />
            AI <span className="tabular-nums text-ink">{ai}</span>
          </span>
        </p>
      </div>
    </GameFrame>
  );
}
