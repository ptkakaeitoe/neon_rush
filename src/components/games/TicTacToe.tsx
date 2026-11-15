"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { bestMove, type Cell, winner } from "@/lib/ai/minimax";
import { type Outcome, useArcade } from "../ArcadeProvider";
import { GameFrame } from "../GameFrame";
import { PieceO, PieceX } from "../ui/Pieces";
import { useCoinFlip } from "../ui/CoinFlip";
import { Replay, type ReplayStep } from "../ui/Replay";

const DEPTH = { easy: 1, medium: 2, hard: 3, unbeatable: Infinity } as const;
const BLUNDER = { easy: 0.4, medium: 0.2, hard: 0.1, unbeatable: 0 } as const;
const EASE = [0.22, 1, 0.36, 1] as const;
const AI_DELAY = 420;
const PROBE_STEP = 90; // ms between revealing each candidate's minimax score

// numpad layout: 7 8 9 / 4 5 6 / 1 2 3
const NUMPAD: Record<string, number> = { "7": 0, "8": 1, "9": 2, "4": 3, "5": 4, "6": 5, "1": 6, "2": 7, "3": 8 };
const CELL_NAME = ["Top-left corner", "Top edge", "Top-right corner", "Left edge", "Center", "Right edge", "Bottom-left corner", "Bottom edge", "Bottom-right corner"];

type Scores = (number | null)[];
type Step = { board: Cell[]; move: number; by: "X" | "O"; scores: Scores | null };

const fmtScore = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
const scoreColor = (n: number) => (n > 0 ? "text-accent" : n === 0 ? "text-ink" : "text-muted");

function Board({
  board,
  scores,
  showScores,
  probing,
  lastAi,
  winLine,
  interactive,
  onCell,
}: {
  board: Cell[];
  scores: Scores | null;
  showScores: boolean;
  /** cell the AI is evaluating right now (-1 = none) */
  probing: number;
  lastAi: number;
  winLine: number[] | null;
  interactive: boolean;
  onCell: (i: number) => void;
}) {
  const reduce = useReducedMotion();
  const c = (i: number) => ({ x: (i % 3) * 2 + 1, y: Math.floor(i / 3) * 2 + 1 }); // centres in a 6×6 box
  return (
    <div className="relative">
      <div className="grid grid-cols-3 gap-2" role="grid" aria-label="Tic-tac-toe board">
        {board.map((v, i) => {
          const dim = winLine && !winLine.includes(i);
          const s = scores?.[i];
          return (
            <button
              key={i}
              onClick={() => onCell(i)}
              disabled={!interactive || !!v}
              aria-label={`Cell ${[7, 8, 9, 4, 5, 6, 1, 2, 3][i]}${v ? `, ${v}` : ", empty"}`}
              className="group relative flex h-24 w-24 items-center justify-center rounded-md border border-line bg-surface transition-[background-color,opacity] duration-200 ease-out enabled:hover:bg-white/[0.04] sm:h-28 sm:w-28"
              style={{ opacity: dim ? 0.35 : 1 }}
            >
              {/* AI thinking: tint by how good the move is for the AI, outline the cell being evaluated */}
              {showScores && !v && s !== null && s !== undefined && s > 0 && (
                <span className="absolute inset-0 rounded-md bg-accent transition-opacity duration-200" style={{ opacity: Math.min(0.18, 0.04 + s / 60) }} aria-hidden />
              )}
              {probing === i && <span className="absolute inset-0 rounded-md ring-1 ring-inset ring-ink/60" aria-hidden />}
              {/* ghost X on hover */}
              {!v && interactive && (
                <span className="text-ink opacity-0 transition-opacity duration-150 group-hover:opacity-20 group-focus-visible:opacity-20">
                  <PieceX size={44} stroke={2.5} />
                </span>
              )}
              <AnimatePresence>
                {v && (
                  <motion.span
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2, ease: EASE }}
                    className={`absolute ${v === "X" ? "text-accent" : "text-ink"}`}
                  >
                    {v === "X" ? <PieceX size={48} stroke={3} /> : <PieceO size={48} stroke={3} />}
                  </motion.span>
                )}
              </AnimatePresence>
              {/* last AI move marker */}
              {i === lastAi && v === "O" && <span className="absolute left-2 top-2 h-1.5 w-1.5 bg-muted" aria-label="AI's last move" />}
              {/* minimax score overlay */}
              <AnimatePresence>
                {showScores && !v && s !== null && s !== undefined && (
                  <motion.span
                    key={`${i}-${s}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: EASE }}
                    className={`absolute bottom-1.5 right-2 text-[11px] tabular-nums ${scoreColor(s)}`}
                  >
                    {fmtScore(s)}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </div>
      {/* winning line */}
      {winLine && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 6 6" preserveAspectRatio="none" aria-hidden>
          <motion.line
            x1={c(winLine[0]).x} y1={c(winLine[0]).y} x2={c(winLine[2]).x} y2={c(winLine[2]).y}
            stroke={board[winLine[0]] === "X" ? "#8cff73" : "#fafafa"} strokeWidth={0.05} strokeLinecap="square"
            initial={{ pathLength: reduce ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.25, ease: EASE }}
          />
        </svg>
      )}
    </div>
  );
}

export function TicTacToe() {
  const { difficulty, play } = useArcade();
  const reduce = useReducedMotion();
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [aiTurn, setAiTurn] = useState(false);
  const [result, setResult] = useState<Outcome | null>(null);
  const [scores, setScores] = useState<Scores | null>(null);
  const [nodes, setNodes] = useState(0);
  const [lastAi, setLastAi] = useState(-1);
  const [probing, setProbing] = useState(-1);
  const [showScores, setShowScores] = useState(true);
  const [history, setHistory] = useState<Step[]>([]);
  const [replayAt, setReplayAt] = useState<number | null>(null);
  // coin flip decides the first round's starter, then it alternates; the AI opens if it starts
  const coin = useCoinFlip((first) => first === "ai" && setAiTurn(true));
  const restartCoin = coin.restart;

  const win = winner(board);

  const finish = useCallback((b: Cell[]) => {
    const w = winner(b);
    if (w) {
      setResult(w.who === "X" ? "win" : "lose");
      return true;
    }
    if (b.every(Boolean)) {
      setResult("draw");
      return true;
    }
    return false;
  }, []);

  const click = (i: number) => {
    if (coin.flipping || board[i] || aiTurn || result) return;
    const nb = [...board];
    nb[i] = "X";
    setBoard(nb);
    setHistory((h) => [...h, { board: nb, move: i, by: "X", scores: null }]);
    play("move");
    if (!finish(nb)) setAiTurn(true);
  };

  // AI turn: run minimax now, then reveal each candidate's score cell by cell before moving
  // ("watching it think"). Reduced motion skips the reveal and the delay.
  useEffect(() => {
    if (!aiTurn) return;
    const res = bestMove(board, DEPTH[difficulty]);
    let move = res.move;
    if (Math.random() < BLUNDER[difficulty]) {
      const empty = board.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
      move = empty[Math.floor(Math.random() * empty.length)];
    }
    const commit = () => {
      const nb = [...board];
      nb[move] = "O";
      setProbing(-1);
      setScores(res.scores);
      setNodes((n) => n + res.nodes);
      setLastAi(move);
      setBoard(nb);
      setHistory((h) => [...h, { board: nb, move, by: "O", scores: res.scores }]);
      play("ai");
      setAiTurn(false);
      finish(nb);
    };
    if (reduce) {
      const t = setTimeout(commit, 0);
      return () => clearTimeout(t);
    }
    const empties = board.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
    const timers = empties.map((cell, k) =>
      setTimeout(() => {
        setProbing(cell);
        setScores((prev) => {
          const next: Scores = k === 0 || !prev ? Array(9).fill(null) : [...prev];
          next[cell] = res.scores[cell];
          return next;
        });
      }, k * PROBE_STEP),
    );
    timers.push(setTimeout(commit, Math.max(AI_DELAY, empties.length * PROBE_STEP + 260)));
    return () => timers.forEach(clearTimeout);
  }, [aiTurn, board, difficulty, finish, play, reduce]);

  const reset = useCallback(() => {
    setBoard(Array(9).fill(null));
    setResult(null);
    setAiTurn(false);
    setScores(null);
    setNodes(0);
    setLastAi(-1);
    setProbing(-1);
    setHistory([]);
    setReplayAt(null);
    restartCoin();
    play("click");
  }, [play, restartCoin]);

  // 1–9 on the numpad layout place a piece
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const i = NUMPAD[e.key];
      if (i !== undefined) click(i);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // what the board shows: live game, or a replay step
  const view: Step | null = replayAt !== null ? history[replayAt] ?? null : null;
  const shownBoard = view ? view.board : board;
  const shownScores = view ? view.scores : scores;
  const shownWin = view ? winner(view.board) : win;

  // top 3 candidate moves from the last evaluation
  const evalFor = shownScores;
  const chosen = view ? (view.by === "O" ? view.move : -1) : lastAi;
  const candidates = evalFor
    ? evalFor
        .map((s, i) => ({ i, s }))
        .filter((c): c is { i: number; s: number } => c.s !== null)
        .sort((a, b) => b.s - a.s)
        .slice(0, 3)
    : [];

  const resultMessage =
    result === "win"
      ? "You beat minimax."
      : result === "draw"
        ? difficulty === "unbeatable"
          ? "Draw. Minimax can't be beaten on Max, so this is a perfect game."
          : "Draw. Neither side found a way through."
        : "Minimax found a forced win.";

  const replaySteps: ReplayStep[] = history.map((h, n) => ({
    label: `${h.by === "X" ? "You" : "AI"} → ${CELL_NAME[h.move].toLowerCase()}`,
    detail: h.scores ? `AI rated it ${fmtScore(h.scores[h.move] ?? 0)}` : undefined,
    n,
  }));

  return (
    <GameFrame
      gameId="tictactoe"
      title="Tic-Tac-Toe"
      algo="minimax"
      status={coin.flipping
        ? coin.phase === "ready"
          ? "Flip the coin to decide who starts"
          : coin.round === 0
            ? "Flipping the coin"
            : "Taking turns: switching who starts"
        : result ? "Round over" : aiTurn ? "AI is thinking" : "Your turn. You play X."}
      coin={coin}
      tone={result ? "done" : aiTurn ? "ai" : "you"}
      inProgress={board.some(Boolean) && !result}
      result={result}
      resultMessage={resultMessage}
      onReset={reset}
      keyHints="1–9 place (numpad layout)"
      stats={[
        { label: "Boards checked", value: nodes },
        { label: "Depth", value: DEPTH[difficulty] === Infinity ? "Full" : `${DEPTH[difficulty]} ply` },
        { label: "Blunder rate", value: `${BLUNDER[difficulty] * 100}%` },
      ]}
      details={
        candidates.length > 0 && (
          <div>
            <p className="text-[11px] text-muted">Top candidate moves</p>
            <ul className="mt-2 space-y-2">
              {candidates.map((c) => {
                const pick = c.i === chosen;
                return (
                  <li key={c.i} className="text-xs">
                    <div className="flex justify-between">
                      <span className={pick ? "text-accent" : "text-ink"}>
                        {CELL_NAME[c.i]}
                        {pick && <span className="ml-1.5 text-[11px] text-muted">chosen</span>}
                      </span>
                      <span className={`tabular-nums ${scoreColor(c.s)}`}>{fmtScore(c.s)}</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-line-strong">
                      <motion.div
                        className={`h-full rounded-full ${pick ? "bg-accent" : "bg-muted"}`}
                        initial={false}
                        animate={{ width: `${Math.max(4, ((c.s + 10) / 20) * 100)}%` }}
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
      toggles={
        <label className="flex cursor-pointer items-center gap-2 text-ink">
          <input type="checkbox" checked={showScores} onChange={(e) => setShowScores(e.target.checked)} />
          Show AI thinking
        </label>
      }
      howItWorks="Minimax plays out every future board and picks the move with the best guaranteed outcome. While it thinks, each empty cell shows its score for the AI: positive means good for the AI."
      below={
        result && history.length > 0 ? (
          <Replay steps={replaySteps} at={replayAt} onChange={setReplayAt} />
        ) : null
      }
    >
      <Board
        board={shownBoard}
        scores={shownScores}
        showScores={showScores && !shownWin}
        probing={view ? -1 : probing}
        lastAi={view ? (view.by === "O" ? view.move : -1) : lastAi}
        winLine={shownWin?.line ?? null}
        interactive={!coin.flipping && !aiTurn && !result && replayAt === null}
        onCell={click}
      />
    </GameFrame>
  );
}
