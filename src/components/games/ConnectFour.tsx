"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { type Board, bestColumn, COLS, dropRow, emptyBoard, findWin, WIN_SCORE } from "@/lib/ai/alphabeta";
import { type Outcome, useArcade } from "../ArcadeProvider";
import { GameFrame } from "../GameFrame";
import { useCoinFlip } from "../ui/CoinFlip";
import { Replay, type ReplayStep } from "../ui/Replay";

const DEPTH = { easy: 2, medium: 3, hard: 5, unbeatable: 7 } as const;
const COLOR = { 1: "#8cff73", 2: "#fafafa" } as const;
const EASE = [0.22, 1, 0.36, 1] as const;
const AI_DELAY = 420;
const PROBE_STEP = 80; // ms between revealing each column's score

/** Column score from the AI's point of view: "win" / "loss" when forced, else the heuristic value. */
const fmtCol = (v: number) => (v >= WIN_SCORE ? "win" : v <= -WIN_SCORE ? "loss" : v > 0 ? `+${v}` : `${v}`);
// cell size: ≥44px on a 375px phone, 52px max on desktop
const CELL = "min(3.25rem, calc((100vw - 2rem - 32px) / 7))";

type Step = { board: Board; col: number; by: 1 | 2; nodes?: number; pruned?: number };
type Search = { nodes: number; pruned: number; ms: number; col: number };

export function ConnectFour() {
  const { difficulty, play } = useArcade();
  const reduce = useReducedMotion();
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [aiTurn, setAiTurn] = useState(false);
  const [result, setResult] = useState<Outcome | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [search, setSearch] = useState<Search>({ nodes: 0, pruned: 0, ms: 0, col: -1 });
  const [lastAi, setLastAi] = useState<[number, number] | null>(null);
  const [history, setHistory] = useState<Step[]>([]);
  const [replayAt, setReplayAt] = useState<number | null>(null);
  const [colScores, setColScores] = useState<(number | null)[] | null>(null);
  const [probeCol, setProbeCol] = useState(-1);
  const [showThinking, setShowThinking] = useState(true);
  // coin flip decides the first round's starter, then it alternates; the AI opens if it starts
  const coin = useCoinFlip((first) => first === "ai" && setAiTurn(true));
  const restartCoin = coin.restart;

  const finish = useCallback((b: Board) => {
    const w = findWin(b);
    if (w) {
      setResult(w.who === 1 ? "win" : "lose");
      return true;
    }
    if (b[0].every((x) => x !== 0)) {
      setResult("draw");
      return true;
    }
    return false;
  }, []);

  const drop = (col: number) => {
    if (coin.flipping || aiTurn || result || replayAt !== null) return;
    const r = dropRow(board, col);
    if (r < 0) return;
    const nb = board.map((row) => [...row]) as Board;
    nb[r][col] = 1;
    setBoard(nb);
    setHistory((h) => [...h, { board: nb, col, by: 1 }]);
    play("drop");
    if (!finish(nb)) setAiTurn(true);
  };

  useEffect(() => {
    if (!aiTurn) return;
    // search now, then reveal each column's score in the order alpha-beta tried them (centre first)
    const res = bestColumn(board, DEPTH[difficulty]);
    const commit = () => {
      const r = dropRow(board, res.col);
      const nb = board.map((row) => [...row]) as Board;
      nb[r][res.col] = 2;
      setProbeCol(-1);
      setColScores(res.scores);
      setSearch({ nodes: res.nodes, pruned: res.pruned, ms: res.ms, col: res.col });
      setLastAi([r, res.col]);
      setBoard(nb);
      setHistory((h) => [...h, { board: nb, col: res.col, by: 2, nodes: res.nodes, pruned: res.pruned }]);
      play("drop");
      setAiTurn(false);
      finish(nb);
    };
    if (reduce) {
      const t = setTimeout(commit, 0);
      return () => clearTimeout(t);
    }
    const timers = res.order.map((c, k) =>
      setTimeout(() => {
        setProbeCol(c);
        setColScores((prev) => {
          const next = k === 0 || !prev ? Array<number | null>(COLS).fill(null) : [...prev];
          next[c] = res.scores[c];
          return next;
        });
      }, k * PROBE_STEP),
    );
    timers.push(setTimeout(commit, Math.max(AI_DELAY, res.order.length * PROBE_STEP + 260)));
    return () => timers.forEach(clearTimeout);
  }, [aiTurn, board, difficulty, finish, play, reduce]);

  // 1–7 drop
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 7) drop(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const reset = useCallback(() => {
    setBoard(emptyBoard());
    setResult(null);
    setAiTurn(false);
    setSearch({ nodes: 0, pruned: 0, ms: 0, col: -1 });
    setLastAi(null);
    setHistory([]);
    setReplayAt(null);
    setColScores(null);
    setProbeCol(-1);
    restartCoin();
    play("click");
  }, [play, restartCoin]);

  const view = replayAt !== null ? history[replayAt] : null;
  const shown = view ? view.board : board;
  const win = findWin(shown);
  const winCells = new Set(win?.cells.map(([r, c]) => `${r}-${c}`));
  const marker = view ? (view.by === 2 ? [dropRowOf(view.board, view.col), view.col] : null) : lastAi;
  const interactive = !coin.flipping && !aiTurn && !result && replayAt === null;
  const ghostRow = hover !== null && interactive ? dropRow(board, hover) : -1;

  const resultMessage =
    result === "win"
      ? "You beat alpha-beta."
      : result === "lose"
        ? "Alpha-beta found a forced win."
        : "Draw. The board filled up with no four in a row.";

  const prunedShare = search.nodes + search.pruned ? search.pruned / (search.nodes + search.pruned) : 0;

  const steps: ReplayStep[] = history.map((h, n) => ({
    label: `${h.by === 1 ? "You" : "AI"} → column ${h.col + 1}`,
    detail: h.by === 2 && h.nodes !== undefined ? `${h.nodes.toLocaleString()} positions, ${h.pruned?.toLocaleString()} cut` : undefined,
    n,
  }));

  return (
    <GameFrame
      gameId="connect4"
      title="Connect Four"
      algo="α-β pruning"
      status={coin.flipping
        ? coin.phase === "ready"
          ? "Flip the coin to decide who starts"
          : coin.round === 0
            ? "Flipping the coin"
            : "Taking turns: switching who starts"
        : result ? "Round over" : aiTurn ? "AI is searching" : "Your turn. Drop a disc."}
      coin={coin}
      tone={result ? "done" : aiTurn ? "ai" : "you"}
      inProgress={history.length > 0 && !result}
      result={result}
      resultMessage={resultMessage}
      onReset={reset}
      keyHints="1–7 drop"
      stats={[
        { label: "Nodes searched", value: search.nodes },
        { label: "Branches pruned", value: search.pruned },
        { label: "Depth", value: `${DEPTH[difficulty]} ply` },
      ]}
      details={
        search.col >= 0 && (
          <div className="text-xs">
            <div className="flex justify-between">
              <span className="text-muted">Search tree cut by pruning</span>
              <span className="tabular-nums text-ink">{Math.round(prunedShare * 100)}%</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line-strong">
              <motion.div
                className="h-full rounded-full bg-muted"
                initial={false}
                animate={{ width: `${prunedShare * 100}%` }}
                transition={{ duration: 0.25, ease: EASE }}
              />
            </div>
            <p className="mt-3 text-muted">
              Chose <span className="text-ink">column {search.col + 1}</span>
            </p>
          </div>
        )
      }
      toggles={
        <label className="flex cursor-pointer items-center gap-2 text-ink">
          <input type="checkbox" checked={showThinking} onChange={(e) => setShowThinking(e.target.checked)} />
          Show AI thinking
        </label>
      }
      howItWorks="Alpha-beta searches ahead like minimax but skips branches that can't change the decision. While it thinks, each column shows its score for the AI, tried centre-first."
      below={history.length > 0 && result ? <Replay steps={steps} at={replayAt} onChange={setReplayAt} /> : null}
    >
      <div style={{ ["--cell" as string]: CELL }}>
        {/* AI thinking: each column's alpha-beta score (AI's view), revealed in search order */}
        <ColumnScores scores={showThinking && !view ? colScores : null} probe={probeCol} chosen={aiTurn ? -1 : search.col} />
        {/* drop indicator row */}
        <div className="mb-2 grid gap-1 px-1 sm:gap-1.5 sm:px-2.5" style={{ gridTemplateColumns: `repeat(${COLS}, var(--cell))` }} aria-hidden>
          {Array.from({ length: COLS }, (_, c) => (
            <div key={c} className="flex h-4 items-end justify-center">
              {hover === c && interactive && (
                <motion.div layoutId="c4-hover" className="h-1 w-[50%] rounded-full bg-accent" transition={{ duration: 0.15, ease: "easeOut" }} />
              )}
            </div>
          ))}
        </div>
        <div
          className="relative grid gap-1 rounded-md border border-line bg-surface p-1 sm:gap-1.5 sm:p-2.5"
          style={{ gridTemplateColumns: `repeat(${COLS}, var(--cell))` }}
          onMouseLeave={() => setHover(null)}
          role="grid"
          aria-label="Connect Four board"
        >
          {shown.map((row, r) =>
            row.map((cell, c) => {
              const inWin = winCells.has(`${r}-${c}`);
              const dim = win && !inWin;
              const isMarker = marker && marker[0] === r && marker[1] === c;
              return (
                <button
                  key={`${r}-${c}`}
                  onMouseEnter={() => setHover(c)}
                  onFocus={() => setHover(c)}
                  onClick={() => drop(c)}
                  disabled={!interactive}
                  aria-label={`Column ${c + 1}, row ${r + 1}${cell === 1 ? ", yours" : cell === 2 ? ", AI" : ""}`}
                  className="relative aspect-square w-[var(--cell)] rounded-full bg-bg"
                >
                  {/* ghost disc where yours would land */}
                  {cell === 0 && r === ghostRow && hover === c && (
                    <span className="absolute inset-1 rounded-full bg-accent opacity-20" aria-hidden />
                  )}
                  {cell !== 0 && (
                    <motion.span
                      className="absolute inset-1 rounded-full"
                      style={{ background: COLOR[cell], opacity: dim ? 0.3 : 1 }}
                      initial={view || reduce ? false : { y: `-${(r + 1) * 115}%` }}
                      animate={{ y: 0 }}
                      transition={{ duration: 0.25, ease: "easeIn" }}
                    >
                      {isMarker && <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 bg-bg" aria-label="AI's last move" />}
                    </motion.span>
                  )}
                  {inWin && <span className="absolute inset-0 rounded-full ring-2 ring-accent" aria-hidden />}
                </button>
              );
            }),
          )}
        </div>
        <p className="mt-4 flex gap-6 text-xs text-muted">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            You
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-ink" />
            AI
          </span>
        </p>
      </div>
    </GameFrame>
  );
}

/** row index of the top disc in a column (for replay markers) */
function dropRowOf(b: Board, col: number) {
  for (let r = 0; r < b.length; r++) if (b[r][col] !== 0) return r;
  return -1;
}

/** Score strip above the board: a bar + value per column, the column being searched outlined, the pick in accent. */
function ColumnScores({ scores, probe, chosen }: { scores: (number | null)[] | null; probe: number; chosen: number }) {
  const finite = (scores ?? []).filter((v): v is number => v !== null && Math.abs(v) < WIN_SCORE);
  const span = Math.max(1, ...finite.map((v) => Math.abs(v)));
  return (
    <div
      className="mb-1 grid gap-1 px-1 sm:gap-1.5 sm:px-2.5"
      style={{ gridTemplateColumns: `repeat(${COLS}, var(--cell))` }}
      aria-label="AI column scores"
      role="list"
    >
      {Array.from({ length: COLS }, (_, c) => {
        const v = scores?.[c] ?? null;
        const h = v === null ? 0 : Math.abs(v) >= WIN_SCORE ? 1 : Math.abs(v) / span;
        const pick = c === chosen && v !== null;
        return (
          <div key={c} role="listitem" className={`flex h-9 flex-col items-center justify-end gap-1 rounded-sm ${probe === c ? "ring-1 ring-ink/50" : ""}`}>
            {v !== null && (
              <>
                <motion.span
                  className={`w-[30%] rounded-sm ${pick ? "bg-accent" : v >= 0 ? "bg-muted" : "bg-line-strong"}`}
                  initial={{ height: 0 }}
                  animate={{ height: Math.max(2, h * 14) }}
                  transition={{ duration: 0.2, ease: EASE }}
                />
                <span className={`text-[10px] leading-none tabular-nums ${pick ? "text-accent" : "text-muted"}`}>{fmtCol(v)}</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
