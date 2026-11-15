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

export type ABResult = {
  col: number;
  score: number;
  nodes: number;
  pruned: number;
  ms: number;
  /** exact minimax value of each column (null = full); > 0 favours the AI */
  scores: (number | null)[];
  /** the order the root columns were searched in (centre first) */
  order: number[];
};

/** Scores at or beyond this magnitude mean a forced win / loss was found. */
export const WIN_SCORE = 100000;

type Counters = { nodes: number; pruned: number };

/** Alpha-beta search over board `b` (mutated in place and restored). Values are from the AI's view. */
function makeSearch(b: Board, c: Counters) {
  const search = (d: number, alpha: number, beta: number, maximising: boolean): number => {
    c.nodes++;
    const w = findWin(b);
    if (w) return w.who === 2 ? WIN_SCORE + d : -WIN_SCORE - d;
    const moves = ORDER.filter((col) => b[0][col] === 0);
    if (moves.length === 0) return 0;
    if (d === 0) return evaluate(b, 2);

    let v = maximising ? -Infinity : Infinity;
    for (let i = 0; i < moves.length; i++) {
      const col = moves[i];
      const r = dropRow(b, col);
      b[r][col] = maximising ? 2 : 1;
      const s = search(d - 1, alpha, beta, !maximising);
      b[r][col] = 0;
      if (maximising) {
        v = Math.max(v, s);
        alpha = Math.max(alpha, v);
      } else {
        v = Math.min(v, s);
        beta = Math.min(beta, v);
      }
      if (alpha >= beta) {
        c.pruned += moves.length - i - 1;
        break;
      }
    }
    return v;
  };
  return search;
}

export function bestColumn(board: Board, depth: number): ABResult {
  const t0 = performance.now();
  const c: Counters = { nodes: 0, pruned: 0 };
  const b = board.map((r) => [...r]) as Board;
  const search = makeSearch(b, c);

  // Each root column gets a full window so its value is exact (the UI shows every column's score);
  // pruning still happens everywhere below the root.
  let col = ORDER.find((x) => b[0][x] === 0) ?? 0;
  let best = -Infinity;
  const scores: (number | null)[] = Array(COLS).fill(null);
  const order: number[] = [];
  for (const x of ORDER) {
    if (b[0][x] !== 0) continue;
    const r = dropRow(b, x);
    b[r][x] = 2;
    const s = search(depth - 1, -Infinity, Infinity, false);
    b[r][x] = 0;
    scores[x] = s;
    order.push(x);
    if (s > best) { best = s; col = x; }
  }
  return { col, score: best, nodes: c.nodes, pruned: c.pruned, ms: performance.now() - t0, scores, order };
}

/**
 * One reply alpha-beta compared. "exact": a real value. "atMost" / "atLeast": the search stopped as soon as
 * it proved this move was worse than one already found, so only a bound is known. "pruned": never searched.
 */
export type ColOption = { col: number; score: number | null; nodes: number; kind: "exact" | "atMost" | "atLeast" | "pruned" };
export type ColStep = { col: number; by: 1 | 2; score: number; board: Board; options: ColOption[] };
export type ColLineEnd = 1 | 2 | "draw" | "horizon";

/**
 * Replays the search below root column `col` the way `bestColumn` ran it (same move order, same windows)
 * and follows the line it expects: at each step the side to move takes its best reply.
 */
export function expectedColumnLine(board: Board, col: number, depth: number): { steps: ColStep[]; end: ColLineEnd } {
  const c: Counters = { nodes: 0, pruned: 0 };
  const b = board.map((r) => [...r]) as Board;
  const search = makeSearch(b, c);
  b[dropRow(b, col)][col] = 2;
  const snap = () => b.map((r) => [...r]) as Board;
  const steps: ColStep[] = [{ col, by: 2, score: search(depth - 1, -Infinity, Infinity, false), board: snap(), options: [] }];
  let d = depth - 1;
  let alpha = -Infinity;
  let beta = Infinity;
  let maximising = false;
  for (;;) {
    const w = findWin(b);
    if (w) return { steps, end: w.who as 1 | 2 };
    const moves = ORDER.filter((x) => b[0][x] === 0);
    if (moves.length === 0) return { steps, end: "draw" };
    if (d === 0) return { steps, end: "horizon" };

    const options: ColOption[] = [];
    let a = alpha;
    let bt = beta;
    let v = maximising ? -Infinity : Infinity;
    let best = moves[0];
    let bestWindow: [number, number] = [a, bt];
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      const r = dropRow(b, m);
      b[r][m] = maximising ? 2 : 1;
      const before = c.nodes;
      const [wa, wb] = [a, bt];
      const s = search(d - 1, wa, wb, !maximising);
      b[r][m] = 0;
      options.push({ col: m, score: s, nodes: c.nodes - before, kind: s <= wa ? "atMost" : s >= wb ? "atLeast" : "exact" });
      if (maximising ? s > v : s < v) {
        v = s;
        best = m;
        bestWindow = [wa, wb];
      }
      if (maximising) a = Math.max(a, v);
      else bt = Math.min(bt, v);
      if (a >= bt) {
        for (const rest of moves.slice(i + 1)) options.push({ col: rest, score: null, nodes: 0, kind: "pruned" });
        break;
      }
    }
    b[dropRow(b, best)][best] = maximising ? 2 : 1;
    steps.push({ col: best, by: maximising ? 2 : 1, score: v, board: snap(), options });
    [alpha, beta] = bestWindow;
    d--;
    maximising = !maximising;
  }
}
