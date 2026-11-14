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

/**
 * AI plays "O" (maximiser), human plays "X".
 * maxDepth limits lookahead (Infinity = perfect play). Scores prefer faster wins / slower losses.
 */
export function bestMove(board: Cell[], maxDepth: number): MinimaxResult {
  let nodes = 0;

  const minimax = (b: Cell[], depth: number, isMax: boolean): number => {
    nodes++;
    const w = winner(b);
    if (w) return w.who === "O" ? 10 - depth : depth - 10;
    if (b.every(Boolean) || depth >= maxDepth) return 0;
    let best = isMax ? -Infinity : Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = isMax ? "O" : "X";
      const s = minimax(b, depth + 1, !isMax);
      b[i] = null;
      best = isMax ? Math.max(best, s) : Math.min(best, s);
    }
    return best;
  };

  const scores: (number | null)[] = Array(9).fill(null);
  let move = -1;
  let bestScore = -Infinity;
  const b = [...board];
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = "O";
    const s = minimax(b, 1, false);
    b[i] = null;
    scores[i] = s;
    if (s > bestScore) {
      bestScore = s;
      move = i;
    }
  }
  return { move, score: bestScore, nodes, scores };
}
