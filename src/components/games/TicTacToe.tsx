"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { bestMove, type Cell, winner } from "@/lib/ai/minimax";
import { type Outcome, useArcade } from "../ArcadeProvider";
import { GameFrame } from "../GameFrame";
import { PieceO, PieceX } from "../ui/Pieces";
import { Replay, type ReplayStep } from "../ui/Replay";

const DEPTH = { easy: 1, medium: 2, hard: 3, unbeatable: Infinity } as const;
const BLUNDER = { easy: 0.4, medium: 0.2, hard: 0.1, unbeatable: 0 } as const;
const EASE = [0.22, 1, 0.36, 1] as const;
const AI_DELAY = 420;

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
  lastAi,
  winLine,
  interactive,
  onCell,
}: {
  board: Cell[];
  scores: Scores | null;
  showScores: boolean;
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
  const [showScores, setShowScores] = useState(true);
  const [history, setHistory] = useState<Step[]>([]);
  const [replayAt, setReplayAt] = useState<number | null>(null);

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
    if (board[i] || aiTurn || result) return;
    const nb = [...board];
    nb[i] = "X";
    setBoard(nb);
    setHistory((h) => [...h, { board: nb, move: i, by: "X", scores: null }]);
    play("move");
    if (!finish(nb)) setAiTurn(true);
  };

  // AI move, with a short minimum "thinking" delay (none with reduced motion)
  useEffect(() => {
    if (!aiTurn) return;
    const t = setTimeout(() => {
      const res = bestMove(board, DEPTH[difficulty]);
      let move = res.move;
      if (Math.random() < BLUNDER[difficulty]) {
        const empty = board.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
        move = empty[Math.floor(Math.random() * empty.length)];
      }
      const nb = [...board];
      nb[move] = "O";
      setScores(res.scores);
      setNodes((n) => n + res.nodes);
      setLastAi(move);
      setBoard(nb);
      setHistory((h) => [...h, { board: nb, move, by: "O", scores: res.scores }]);
      play("ai");
      setAiTurn(false);
      finish(nb);
    }, reduce ? 0 : AI_DELAY);
    return () => clearTimeout(t);
  }, [aiTurn, board, difficulty, finish, play, reduce]);

  const reset = useCallback(() => {
    setBoard(Array(9).fill(null));
    setResult(null);
    setAiTurn(false);
    setScores(null);
    setNodes(0);
    setLastAi(-1);
    setHistory([]);
    setReplayAt(null);
    play("click");
  }, [play]);

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
      status={result ? "Round over" : aiTurn ? "AI is thinking" : "Your turn. You play X."}
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
          Show move scores
        </label>
      }
      howItWorks="Minimax plays out every future board and picks the move with the best guaranteed outcome."
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
        lastAi={view ? (view.by === "O" ? view.move : -1) : lastAi}
        winLine={shownWin?.line ?? null}
        interactive={!aiTurn && !result && replayAt === null}
        onCell={click}
      />
    </GameFrame>
  );
}
