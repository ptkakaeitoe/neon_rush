/**
 * Othello rules + Monte Carlo Tree Search (UCT). Pure functions, no UI.
 *
 * MCTS in four steps, repeated until the time / iteration budget runs out:
 *   1. Select   – walk down the tree, picking children by UCB1 (win rate + exploration bonus)
 *   2. Expand   – add one untried move as a new child
 *   3. Simulate – play random moves from there to the end of the game
 *   4. Back up  – add the result to every node on the path
 * The move with the most visits is played.
 */

export const SIZE = 8;
export type Disc = 0 | 1 | 2; // 0 empty, 1 human (moves first), 2 AI
export type Board = Disc[]; // length 64, index = row * 8 + col

const DIRS: [number, number][] = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
export const other = (p: Disc): Disc => (p === 1 ? 2 : 1);

export function initialBoard(): Board {
  const b = Array<Disc>(64).fill(0);
  b[27] = 2;
  b[36] = 2;
  b[28] = 1;
  b[35] = 1;
  return b;
}

/** Discs that would flip if `p` played at `idx` (empty array = illegal). */
export function flipsFor(b: Board, idx: number, p: Disc): number[] {
  if (b[idx] !== 0) return [];
  const r0 = Math.floor(idx / SIZE);
  const c0 = idx % SIZE;
  const opp = other(p);
  const out: number[] = [];
  for (const [dr, dc] of DIRS) {
    let r = r0 + dr;
    let c = c0 + dc;
    const line: number[] = [];
    while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && b[r * SIZE + c] === opp) {
      line.push(r * SIZE + c);
      r += dr;
      c += dc;
    }
    if (line.length && r >= 0 && r < SIZE && c >= 0 && c < SIZE && b[r * SIZE + c] === p) out.push(...line);
  }
  return out;
}

export function legalMoves(b: Board, p: Disc): number[] {
  const moves: number[] = [];
  for (let i = 0; i < 64; i++) if (b[i] === 0 && flipsFor(b, i, p).length) moves.push(i);
  return moves;
}

/** New board after `p` plays `idx` (assumed legal). */
export function play(b: Board, idx: number, p: Disc): Board {
  const nb = b.slice();
  nb[idx] = p;
  for (const f of flipsFor(b, idx, p)) nb[f] = p;
  return nb;
}

export function count(b: Board) {
  let you = 0;
  let ai = 0;
  for (const d of b) {
    if (d === 1) you++;
    else if (d === 2) ai++;
  }
  return { you, ai };
}

export const isOver = (b: Board) => legalMoves(b, 1).length === 0 && legalMoves(b, 2).length === 0;

/* ---------------- MCTS ---------------- */

type Node = {
  move: number; // -1 = pass
  parent: Node | null;
  children: Node[];
  untried: number[];
  toMove: Disc; // player to move at this node
  visits: number;
  wins: number; // from the perspective of the player who made `move` (parent.toMove)
};

const newNode = (b: Board, move: number, parent: Node | null, toMove: Disc): Node => {
  const moves = legalMoves(b, toMove);
  return { move, parent, children: [], untried: moves.length ? moves : isOver(b) ? [] : [-1], toMove, visits: 0, wins: 0 };
};

/** Fast random playout; returns the winner (0 = draw). Mutates a copy. */
function rollout(start: Board, toMove: Disc): Disc {
  const b = start.slice();
  let p = toMove;
  let passes = 0;
  while (passes < 2) {
    const moves = legalMoves(b, p);
    if (!moves.length) {
      passes++;
      p = other(p);
      continue;
    }
    passes = 0;
    const m = moves[(Math.random() * moves.length) | 0];
    const flips = flipsFor(b, m, p);
    b[m] = p;
    for (const f of flips) b[f] = p;
    p = other(p);
  }
  const { you, ai } = count(b);
  return you === ai ? 0 : you > ai ? 1 : 2;
}

export type MoveStat = { move: number; visits: number; winRate: number };
export type MctsResult = { move: number; simulations: number; ms: number; moves: MoveStat[]; winRate: number };

/**
 * Best move for `player` within `budgetMs` (and at most `maxIter` simulations).
 * Returns per-move visit counts / win rates so the UI can show what the search found.
 */
export function mctsMove(board: Board, player: Disc, budgetMs: number, maxIter = Infinity, c = Math.SQRT2): MctsResult {
  const t0 = performance.now();
  const root = newNode(board, -1, null, player);
  let sims = 0;

  while (sims < maxIter && performance.now() - t0 < budgetMs) {
    // 1. select
    let node = root;
    let b = board;
    while (node.untried.length === 0 && node.children.length) {
      const parentVisits = node.visits;
      let best = node.children[0];
      let bestU = -Infinity;
      for (const ch of node.children) {
        const u = ch.wins / ch.visits + c * Math.sqrt(Math.log(parentVisits) / ch.visits);
        if (u > bestU) {
          bestU = u;
          best = ch;
        }
      }
      if (best.move >= 0) b = play(b, best.move, node.toMove);
      node = best;
    }
    // 2. expand
    if (node.untried.length) {
      const i = (Math.random() * node.untried.length) | 0;
      const m = node.untried.splice(i, 1)[0];
      if (m >= 0) b = play(b, m, node.toMove);
      const child = newNode(b, m, node, other(node.toMove));
      node.children.push(child);
      node = child;
    }
    // 3. simulate
    const winner = rollout(b, node.toMove);
    sims++;
    // 4. back up: each node scores for the player who moved into it
    for (let n: Node | null = node; n; n = n.parent) {
      n.visits++;
      const mover = n.parent ? n.parent.toMove : other(player);
      if (winner === 0) n.wins += 0.5;
      else if (winner === mover) n.wins += 1;
    }
  }

  const moves: MoveStat[] = root.children
    .map((ch) => ({ move: ch.move, visits: ch.visits, winRate: ch.visits ? ch.wins / ch.visits : 0 }))
    .sort((a, b) => b.visits - a.visits);
  const best = moves[0] ?? { move: -1, visits: 0, winRate: 0 };
  return { move: best.move, simulations: sims, ms: performance.now() - t0, moves, winRate: best.winRate };
}
