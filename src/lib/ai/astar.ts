/** A* pathfinding on a 4-connected grid using Manhattan distance. */
export type P = { x: number; y: number };
export const key = (p: P) => `${p.x},${p.y}`;
export const manhattan = (a: P, b: P) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export type AStarResult = { path: P[]; explored: P[] };

export function astar(grid: number[][], start: P, goal: P): AStarResult {
  const H = grid.length, W = grid[0].length;
  const open: { p: P; f: number; g: number }[] = [{ p: start, f: manhattan(start, goal), g: 0 }];
  const came = new Map<string, P>();
  const g = new Map<string, number>([[key(start), 0]]);
  const closed = new Set<string>();
  const explored: P[] = [];

  while (open.length) {
    // small grids: linear scan for lowest f is plenty fast
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f || (open[i].f === open[bi].f && open[i].g > open[bi].g)) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.p);
    if (closed.has(ck)) continue;
    closed.add(ck);
    explored.push(cur.p);

    if (cur.p.x === goal.x && cur.p.y === goal.y) {
      const path: P[] = [cur.p];
      let k = ck;
      while (came.has(k)) {
        const prev = came.get(k)!;
        path.unshift(prev);
        k = key(prev);
      }
      return { path, explored };
    }

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: cur.p.x + dx, y: cur.p.y + dy };
      if (n.x < 0 || n.y < 0 || n.x >= W || n.y >= H || grid[n.y][n.x] === 1) continue;
      const nk = key(n);
      if (closed.has(nk)) continue;
      const ng = cur.g + 1;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        came.set(nk, cur.p);
        open.push({ p: n, g: ng, f: ng + manhattan(n, goal) });
      }
    }
  }
  return { path: [], explored };
}

/** Randomised DFS maze with extra openings so there are loops to juke the AI. W,H must be odd. */
export function generateMaze(W: number, H: number, loops = 0.08): number[][] {
  const g = Array.from({ length: H }, () => Array(W).fill(1));
  const stack: P[] = [{ x: 1, y: 1 }];
  g[1][1] = 0;
  while (stack.length) {
    const c = stack[stack.length - 1];
    const nbrs = [[2, 0], [-2, 0], [0, 2], [0, -2]]
      .map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy, mx: c.x + dx / 2, my: c.y + dy / 2 }))
      .filter((n) => n.x > 0 && n.y > 0 && n.x < W - 1 && n.y < H - 1 && g[n.y][n.x] === 1);
    if (!nbrs.length) { stack.pop(); continue; }
    const n = nbrs[Math.floor(Math.random() * nbrs.length)];
    g[n.my][n.mx] = 0;
    g[n.y][n.x] = 0;
    stack.push({ x: n.x, y: n.y });
  }
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++)
      if (g[y][x] === 1 && Math.random() < loops) {
        const horiz = g[y][x - 1] === 0 && g[y][x + 1] === 0;
        const vert = g[y - 1][x] === 0 && g[y + 1][x] === 0;
        if (horiz !== vert) g[y][x] = 0;
      }
  return g;
}
