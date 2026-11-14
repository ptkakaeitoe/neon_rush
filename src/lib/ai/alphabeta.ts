/** Connect Four AI — Negamax-style Minimax with Alpha-Beta Pruning. */
export const ROWS = 6;
export const COLS = 7;
export type Disc = 0 | 1 | 2; // 0 empty, 1 human, 2 AI
export type Board = Disc[][]; // board[row][col], row 0 = top

export const emptyBoard = (): Board => Array.from({ length: ROWS }, () => Array<Disc>(COLS).fill(0));

export function dropRow(b: Board, col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) if (b[r][col] === 0) return r;
  return -1;
}

export function findWin(b: Board): { who: Disc; cells: [number, number][] } | null {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const p = b[r][c];
      if (!p) continue;
      for (const [dr, dc] of dirs) {
        const cells: [number, number][] = [[r, c]];
        for (let k = 1; k < 4; k++) {
          const rr = r + dr * k, cc = c + dc * k;
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || b[rr][cc] !== p) break;
          cells.push([rr, cc]);
        }
        if (cells.length === 4) return { who: p, cells };
      }
    }
  return null;
}

// Heuristic: score every 4-cell window
function scoreWindow(w: Disc[], me: Disc): number {
  const opp = me === 2 ? 1 : 2;
  const mine = w.filter((x) => x === me).length;
  const theirs = w.filter((x) => x === opp).length;
  const empty = w.filter((x) => x === 0).length;
  if (mine === 3 && empty === 1) return 5;
  if (mine === 2 && empty === 2) return 2;
  if (theirs === 3 && empty === 1) return -4;
  return 0;
}

function evaluate(b: Board, me: Disc): number {
  let s = 0;
  for (let r = 0; r < ROWS; r++) if (b[r][3] === me) s += 3; // center control
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (c + 3 < COLS) s += scoreWindow([b[r][c], b[r][c + 1], b[r][c + 2], b[r][c + 3]], me);
      if (r + 3 < ROWS) s += scoreWindow([b[r][c], b[r + 1][c], b[r + 2][c], b[r + 3][c]], me);
      if (r + 3 < ROWS && c + 3 < COLS) s += scoreWindow([b[r][c], b[r + 1][c + 1], b[r + 2][c + 2], b[r + 3][c + 3]], me);
      if (r + 3 < ROWS && c - 3 >= 0) s += scoreWindow([b[r][c], b[r + 1][c - 1], b[r + 2][c - 2], b[r + 3][c - 3]], me);
    }
  return s;
}

const ORDER = [3, 2, 4, 1, 5, 0, 6]; // centre-first move ordering = more cut-offs

export type ABResult = { col: number; score: number; nodes: number; pruned: number; ms: number };

export function bestColumn(board: Board, depth: number): ABResult {
  const t0 = performance.now();
  let nodes = 0;
  let pruned = 0;
  const b = board.map((r) => [...r]) as Board;

  const search = (d: number, alpha: number, beta: number, maximising: boolean): number => {
    nodes++;
    const w = findWin(b);
    if (w) return w.who === 2 ? 100000 + d : -100000 - d;
    const moves = ORDER.filter((c) => b[0][c] === 0);
    if (moves.length === 0) return 0;
    if (d === 0) return evaluate(b, 2);

    if (maximising) {
      let v = -Infinity;
      for (let i = 0; i < moves.length; i++) {
        const c = moves[i];
        const r = dropRow(b, c);
        b[r][c] = 2;
        v = Math.max(v, search(d - 1, alpha, beta, false));
        b[r][c] = 0;
        alpha = Math.max(alpha, v);
        if (alpha >= beta) { pruned += moves.length - i - 1; break; }
      }
      return v;
    } else {
      let v = Infinity;
      for (let i = 0; i < moves.length; i++) {
        const c = moves[i];
        const r = dropRow(b, c);
        b[r][c] = 1;
        v = Math.min(v, search(d - 1, alpha, beta, true));
        b[r][c] = 0;
        beta = Math.min(beta, v);
        if (alpha >= beta) { pruned += moves.length - i - 1; break; }
      }
      return v;
    }
  };

  let col = ORDER.find((c) => b[0][c] === 0) ?? 0;
  let best = -Infinity;
  let alpha = -Infinity;
  for (const c of ORDER) {
    if (b[0][c] !== 0) continue;
    const r = dropRow(b, c);
    b[r][c] = 2;
    const s = search(depth - 1, alpha, Infinity, false);
    b[r][c] = 0;
    if (s > best) { best = s; col = c; }
    alpha = Math.max(alpha, best);
  }
  return { col, score: best, nodes, pruned, ms: performance.now() - t0 };
}
