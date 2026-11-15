/** Tic-Tac-Toe AI — plain Minimax (no pruning) so every node is evaluated. */
export type Cell = "X" | "O" | null;

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function winner(b: Cell[]): { who: "X" | "O"; line: number[] } | null {
  for (const l of LINES) {
    const [a, c, d] = l;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { who: b[a]!, line: l };
  }
  return null;
}

export type MinimaxResult = { move: number; score: number; nodes: number; scores: (number | null)[] };

/** Value of board `b` for the AI ("O" maximises). `depth` = plies already played below the root. */
function minimax(b: Cell[], depth: number, isMax: boolean, maxDepth: number, count: { n: number }): number {
  count.n++;
  const w = winner(b);
  if (w) return w.who === "O" ? 10 - depth : depth - 10;
  if (b.every(Boolean) || depth >= maxDepth) return 0;
  let best = isMax ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = isMax ? "O" : "X";
    const s = minimax(b, depth + 1, !isMax, maxDepth, count);
    b[i] = null;
    best = isMax ? Math.max(best, s) : Math.min(best, s);
  }
  return best;
}

/**
 * AI plays "O" (maximiser), human plays "X".
 * maxDepth limits lookahead (Infinity = perfect play). Scores prefer faster wins / slower losses.
 */
export function bestMove(board: Cell[], maxDepth: number): MinimaxResult {
  const count = { n: 0 };
  const scores: (number | null)[] = Array(9).fill(null);
  let move = -1;
  let bestScore = -Infinity;
  const b = [...board];
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = "O";
    const s = minimax(b, 1, false, maxDepth, count);
    b[i] = null;
    scores[i] = s;
    if (s > bestScore) {
      bestScore = s;
      move = i;
    }
  }
  return { move, score: bestScore, nodes: count.n, scores };
}

export type LineStep = {
  move: number;
  by: "X" | "O";
  score: number;
  /** board after this move */
  board: Cell[];
  /** every reply minimax compared at this point (empty for the AI's first move) */
  options: { move: number; score: number }[];
};
/** How a line ends: someone wins, the board fills, or the search hits its depth limit. */
export type LineEnd = "X" | "O" | "draw" | "horizon";

/**
 * The line minimax expects after the AI plays `move`: at each step, the side to move picks its best
 * reply (AI the highest score, you the lowest), down to the end of the game or the depth limit.
 */
export function expectedLine(board: Cell[], move: number, maxDepth: number): { steps: LineStep[]; end: LineEnd } {
  const count = { n: 0 };
  const b = [...board];
  b[move] = "O";
  const steps: LineStep[] = [{ move, by: "O", score: minimax(b, 1, false, maxDepth, count), board: [...b], options: [] }];
  let depth = 1;
  let isMax = false;
  for (;;) {
    const w = winner(b);
    if (w) return { steps, end: w.who };
    if (b.every(Boolean)) return { steps, end: "draw" };
    if (depth >= maxDepth) return { steps, end: "horizon" };
    const options: { move: number; score: number }[] = [];
    let best = -1;
    let bestScore = isMax ? -Infinity : Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = isMax ? "O" : "X";
      const s = minimax(b, depth + 1, !isMax, maxDepth, count);
      b[i] = null;
      options.push({ move: i, score: s });
      if (isMax ? s > bestScore : s < bestScore) {
        bestScore = s;
        best = i;
      }
    }
    b[best] = isMax ? "O" : "X";
    steps.push({ move: best, by: isMax ? "O" : "X", score: bestScore, board: [...b], options });
    depth++;
    isMax = !isMax;
  }
}
