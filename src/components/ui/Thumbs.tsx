"use client";

/**
 * One consistent thumbnail system for the four games.
 * Every tile is a 112×112 SVG on the same surface with the same 1px border and 1.5px strokes.
 * At rest it shows the game; while `active` (row hovered / focused) it loops a short
 * animation of the game's algorithm at work. Reduced motion shows the final frame, still.
 */
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import type { GameId } from "../ArcadeProvider";

// Literal values mirroring the tokens in globals.css: Framer Motion can only interpolate
// colour keyframes it can parse, and CSS var() strings break the tween.
const INK = "#fafafa";
const MUTED = "#a1a1aa";
const FAINT = "#63636b";
const LINE = "rgba(255, 255, 255, 0.14)";
const ACCENT = "#8cff73";
const EASE = [0.22, 1, 0.36, 1] as const;
const LOOP_MS = 2600;

/** Re-mounts its animation every LOOP_MS while active so the loop restarts from frame 0. */
function useLoop(active: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setN((x) => x + 1), LOOP_MS);
    return () => clearInterval(id);
  }, [active]);
  return n;
}

function Tile({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 112 112" width="112" height="112" role="img" aria-label={label} className="block h-full w-full">
      {children}
    </svg>
  );
}

/* ---------------- rock / paper / scissors pixel glyphs ---------------- */

// Hand shapes on a 12×12 pixel grid: fist, flat palm, two fingers.
const GLYPHS = {
  R: [
    "............",
    "...XX.XX.XX.",
    "..XXXXXXXXX.",
    "..XXXXXXXXX.",
    ".XXXXXXXXXX.",
    ".XX.XXXXXXX.",
    ".XXX..XXXXX.",
    ".XXXXXXXXXX.",
    "..XXXXXXXX..",
    "...XXXXXXX..",
    "....XXXXXX..",
    "............",
  ],
  P: [
    ".....X.X....",
    "...X.X.X.X..",
    "...X.X.X.X..",
    "...X.X.X.X..",
    "...XXXXXXX..",
    ".X.XXXXXXX..",
    ".XXXXXXXXX..",
    "..XXXXXXXX..",
    "...XXXXXXX..",
    "...XXXXXXX..",
    "....XXXXX...",
    "....XXXXX...",
  ],
  S: [
    "...X.....X..",
    "...XX...XX..",
    "....X...X...",
    "....XX.XX...",
    ".....X.X....",
    "....XXXXX...",
    "...XXXXXXX..",
    "...XXXXXXX..",
    "...XXXXXXX..",
    "....XXXXX...",
    "....XXXXX...",
    "............",
  ],
} as const;
export type RpsMove = keyof typeof GLYPHS;

/** Pixel-art rock / paper / scissors. Used in the thumbnail and in the game itself. */
export function RpsGlyph({ move, size = 64, color = INK, title }: { move: RpsMove; size?: number; color?: string; title?: string }) {
  const map = GLYPHS[move];
  return (
    <svg
      viewBox="0 0 12 12"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {map.flatMap((row, y) =>
        [...row].map((ch, x) =>
          ch === "X" ? (
            <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} style={{ fill: color }} />
          ) : null,
        ),
      )}
    </svg>
  );
}

/* ---------------- game tree (minimax + alpha-beta) ---------------- */

const ROOT = { x: 56, y: 22 };
const MID = [{ x: 24, y: 56 }, { x: 56, y: 56 }, { x: 88, y: 56 }];
const LEAF = [16, 32, 48, 64, 80, 96].map((x) => ({ x, y: 90 }));
const BEST_MID = 1;
const BEST_LEAF = 3;

function Tree({ pruned, still }: { pruned: number[]; still: boolean }) {
  // edges in reveal order: root→mid, then mid→leaves
  const edges = [
    ...MID.map((m, i) => ({ a: ROOT, b: m, best: i === BEST_MID, pruned: false, step: i })),
    ...LEAF.map((l, i) => {
      const mid = Math.floor(i / 2);
      return { a: MID[mid], b: l, best: i === BEST_LEAF, pruned: pruned.includes(i), step: 3 + i };
    }),
  ];
  const t = (step: number) => (still ? 0 : 0.08 + step * 0.09);
  const highlightAt = still ? 0 : 1.25;
  return (
    <g>
      {edges.map((e, i) => (
        <motion.line
          key={i}
          x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y}
          strokeWidth={1.5}
          strokeDasharray={e.pruned ? "2 3" : undefined}
          initial={{ pathLength: still ? 1 : 0, stroke: LINE }}
          animate={{
            pathLength: 1,
            stroke: e.pruned ? FAINT : e.best ? [LINE, LINE, ACCENT] : MUTED,
          }}
          transition={{
            pathLength: { delay: t(e.step), duration: 0.2, ease: EASE },
            stroke: e.best && !still ? { delay: highlightAt, duration: 0.25, times: [0, 0.01, 1] } : { delay: t(e.step), duration: 0.2 },
          }}
        />
      ))}
      {[ROOT, ...MID, ...LEAF].map((n, i) => {
        const isLeaf = i > 3;
        const leafIdx = i - 4;
        const isPruned = isLeaf && pruned.includes(leafIdx);
        const isBest = i === 0 || i === 1 + BEST_MID || (isLeaf && leafIdx === BEST_LEAF);
        const step = i === 0 ? 0 : i <= 3 ? i - 1 : 3 + leafIdx;
        return (
          <motion.rect
            key={i}
            x={n.x - 3} y={n.y - 3} width={6} height={6}
            initial={{ opacity: still ? 1 : 0, fill: MUTED }}
            animate={{ opacity: isPruned ? 0.35 : 1, fill: isBest ? (still ? ACCENT : [MUTED, MUTED, ACCENT]) : isPruned ? FAINT : MUTED }}
            transition={{
              opacity: { delay: t(step) + 0.15, duration: 0.15 },
              fill: isBest && !still ? { delay: highlightAt, duration: 0.25, times: [0, 0.01, 1] } : { duration: 0 },
            }}
          />
        );
      })}
      {pruned.length > 0 &&
        pruned.map((i) => (
          <motion.text
            key={`x${i}`}
            x={LEAF[i].x} y={LEAF[i].y + 14}
            textAnchor="middle"
            fontSize="9"
            fontFamily="var(--font-mono-face)"
            fill={FAINT}
            initial={{ opacity: still ? 1 : 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: t(3 + i) + 0.2 }}
          >
            ×
          </motion.text>
        ))}
    </g>
  );
}

/* ---------------- tic-tac-toe ---------------- */

function TttStatic() {
  const marks: [number, "X" | "O"][] = [[0, "X"], [1, "O"], [4, "X"], [5, "O"], [8, "X"]];
  const c = (i: number) => ({ x: 22 + (i % 3) * 34, y: 22 + Math.floor(i / 3) * 34 });
  return (
    <g strokeWidth={1.5} strokeLinecap="square" fill="none">
      {[39, 73].map((v) => (
        <g key={v} stroke={LINE}>
          <line x1={v} y1={8} x2={v} y2={104} />
          <line x1={8} y1={v} x2={104} y2={v} />
        </g>
      ))}
      {marks.map(([i, m]) => {
        const { x, y } = c(i);
        return m === "X" ? (
          <g key={i} stroke={i === 8 ? ACCENT : INK}>
            <line x1={x - 8} y1={y - 8} x2={x + 8} y2={y + 8} />
            <line x1={x + 8} y1={y - 8} x2={x - 8} y2={y + 8} />
          </g>
        ) : (
          <circle key={i} cx={x} cy={y} r={8.5} stroke={INK} />
        );
      })}
      {/* winning diagonal */}
      <line x1={14} y1={14} x2={98} y2={98} stroke={ACCENT} strokeOpacity={0.35} />
    </g>
  );
}

/* ---------------- connect four ---------------- */

function C4Static() {
  const cols = 6, rows = 5;
  const filled: Record<string, "you" | "ai"> = {
    "4-2": "you", "4-3": "ai", "4-1": "ai", "3-2": "you", "4-4": "you", "3-3": "ai", "2-2": "you", "3-1": "you",
  };
  return (
    <g>
      {Array.from({ length: rows * cols }, (_, i) => {
        const r = Math.floor(i / cols), c = i % cols;
        const who = filled[`${r}-${c}`];
        return (
          <rect
            key={i}
            x={14 + c * 15} y={20 + r * 15} width={9} height={9}
            fill={who === "you" ? ACCENT : who === "ai" ? INK : "none"}
            stroke={who ? "none" : LINE}
            strokeWidth={1.5}
          />
        );
      })}
      <line x1={10} y1={96} x2={102} y2={96} stroke={LINE} strokeWidth={1.5} />
    </g>
  );
}

/* ---------------- maze + A* ---------------- */

const MAZE = [
  "#########",
  "#S..#...#",
  "#.#.#.#.#",
  "#.#...#.#",
  "#.#####.#",
  "#...#...#",
  "###.#.#.#",
  "#.....#E#",
  "#########",
];
const CELL = 12;
const OFF = 2;
type Pt = { x: number; y: number };
const find = (ch: string): Pt => {
  const y = MAZE.findIndex((r) => r.includes(ch));
  return { x: MAZE[y].indexOf(ch), y };
};
const START = find("S");
const GOAL = find("E");

/** Tiny A* (Manhattan) run once at module load: exploration order + final path. */
const ASTAR = (() => {
  const k = (p: Pt) => `${p.x},${p.y}`;
  const h = (p: Pt) => Math.abs(p.x - GOAL.x) + Math.abs(p.y - GOAL.y);
  const open: { p: Pt; g: number; f: number }[] = [{ p: START, g: 0, f: h(START) }];
  const came = new Map<string, Pt>();
  const best = new Map<string, number>([[k(START), 0]]);
  const explored: Pt[] = [];
  const seen = new Set<string>();
  while (open.length) {
    open.sort((a, b) => a.f - b.f || b.g - a.g);
    const { p, g } = open.shift()!;
    if (seen.has(k(p))) continue;
    seen.add(k(p));
    explored.push(p);
    if (p.x === GOAL.x && p.y === GOAL.y) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: p.x + dx, y: p.y + dy };
      if (MAZE[n.y][n.x] === "#") continue;
      if (g + 1 < (best.get(k(n)) ?? Infinity)) {
        best.set(k(n), g + 1);
        came.set(k(n), p);
        open.push({ p: n, g: g + 1, f: g + 1 + h(n) });
      }
    }
  }
  const path: Pt[] = [GOAL];
  let cur = GOAL;
  while (came.has(k(cur))) {
    cur = came.get(k(cur))!;
    path.unshift(cur);
  }
  return { explored, path };
})();

function MazeWalls() {
  return (
    <g>
      {MAZE.flatMap((row, y) =>
        [...row].map((ch, x) =>
          ch === "#" ? <rect key={`${x}-${y}`} x={OFF + x * CELL} y={OFF + y * CELL} width={CELL} height={CELL} fill="rgb(255 255 255 / 0.1)" /> : null,
        ),
      )}
      <rect x={OFF + GOAL.x * CELL + 2.75} y={OFF + GOAL.y * CELL + 2.75} width={CELL - 5.5} height={CELL - 5.5} fill="none" stroke={INK} strokeWidth={1.5} />
    </g>
  );
}

function MazeStatic() {
  return (
    <g>
      <MazeWalls />
      <rect x={OFF + START.x * CELL + 3} y={OFF + START.y * CELL + 3} width={CELL - 6} height={CELL - 6} fill={ACCENT} />
    </g>
  );
}

function AStarLoop({ still }: { still: boolean }) {
  const step = 0.045;
  const pathStart = still ? 0 : ASTAR.explored.length * step + 0.1;
  return (
    <g>
      <MazeWalls />
      {ASTAR.explored.map((p, i) => (
        <motion.rect
          key={`e${i}`}
          x={OFF + p.x * CELL + 1} y={OFF + p.y * CELL + 1} width={CELL - 2} height={CELL - 2}
          fill={MUTED}
          initial={{ opacity: still ? 0.18 : 0 }}
          animate={{ opacity: still ? 0.18 : [0, 0.45, 0.18] }}
          transition={{ delay: still ? 0 : i * step, duration: 0.3, ease: EASE }}
        />
      ))}
      {ASTAR.path.map((p, i) => (
        <motion.rect
          key={`p${i}`}
          x={OFF + p.x * CELL + 3.5} y={OFF + p.y * CELL + 3.5} width={CELL - 7} height={CELL - 7}
          fill={ACCENT}
          initial={{ opacity: still ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: pathStart + i * 0.035, duration: 0.15 }}
        />
      ))}
    </g>
  );
}

/* ---------------- rock paper scissors + markov ---------------- */

function RpsStatic() {
  return (
    <g>
      {(["R", "P", "S"] as const).map((m, i) => (
        <svg key={m} x={8 + i * 33} y={41} width={30} height={30} overflow="visible">
          <RpsGlyph move={m} size={30} color={i === 1 ? ACCENT : INK} />
        </svg>
      ))}
    </g>
  );
}

// transition probabilities "after R → next" etc. Two frames the matrix morphs between.
const MATRIX_A = [[0.2, 0.6, 0.2], [0.3, 0.2, 0.5], [0.5, 0.3, 0.2]];
const MATRIX_B = [[0.15, 0.7, 0.15], [0.2, 0.15, 0.65], [0.6, 0.25, 0.15]];
const LAST_ROW = 0; // you just threw Rock…
const PREDICT_COL = 1; // …so you'll probably throw Paper

function MarkovLoop({ still }: { still: boolean }) {
  // origins measured so labels + grid + highlight sit centred in the 112 tile (equal margins)
  const x0 = 24.35, y0 = 28.1, s = 22, g = 3;
  const decideAt = still ? 0 : 1.3;
  return (
    <g fontFamily="var(--font-mono-face)" fontSize="9">
      {["R", "P", "S"].map((m, i) => (
        <g key={m} fill={MUTED}>
          <text x={x0 + i * (s + g) + s / 2} y={y0 - 7} textAnchor="middle">{m}</text>
          <text x={x0 - 9} y={y0 + i * (s + g) + s / 2 + 3} textAnchor="middle">{m}</text>
        </g>
      ))}
      {MATRIX_A.flatMap((row, r) =>
        row.map((v, c) => {
          const pick = r === LAST_ROW && c === PREDICT_COL;
          const x = x0 + c * (s + g), y = y0 + r * (s + g);
          return (
            <g key={`${r}-${c}`}>
              <motion.rect
                x={x} y={y} width={s} height={s} fill={MUTED}
                initial={{ opacity: still ? MATRIX_B[r][c] * 0.6 : v }}
                animate={{ opacity: still ? MATRIX_B[r][c] * 0.6 : [v, MATRIX_B[r][c], v * 0.9, MATRIX_B[r][c] * 0.6] }}
                transition={{ duration: decideAt, times: [0, 0.35, 0.7, 1], ease: EASE }}
              />
              {pick && (
                /* the prediction lights up once the model has decided */
                <motion.rect
                  x={x} y={y} width={s} height={s} fill={ACCENT}
                  initial={{ opacity: still ? 1 : 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: decideAt, duration: 0.2, ease: EASE }}
                />
              )}
            </g>
          );
        }),
      )}
      {/* row the model is reading from */}
      <motion.rect
        x={x0 - 3} y={y0 + LAST_ROW * (s + g) - 3} width={3 * s + 2 * g + 6} height={s + 6}
        fill="none" stroke={INK} strokeWidth={1.5}
        initial={{ opacity: still ? 1 : 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: still ? 0 : 0.5, duration: 0.2 }}
      />
    </g>
  );
}

/* ---------------- public component ---------------- */

const LABELS: Record<GameId, string> = {
  tictactoe: "Tic-tac-toe board; on hover, a minimax game tree",
  connect4: "Connect Four grid; on hover, an alpha-beta tree with pruned branches",
  maze: "Maze; on hover, A* search exploring then drawing the path",
  rps: "Rock, paper, scissors glyphs; on hover, a Markov transition matrix",
};

export function GameThumb({ id, active }: { id: GameId; active: boolean }) {
  const reduce = useReducedMotion() ?? false;
  const n = useLoop(active && !reduce);
  const still = reduce;

  let rest: React.ReactNode;
  let algo: React.ReactNode;
  switch (id) {
    case "tictactoe":
      rest = <TttStatic />;
      algo = <Tree key={n} pruned={[]} still={still} />;
      break;
    case "connect4":
      rest = <C4Static />;
      algo = <Tree key={n} pruned={[0, 5]} still={still} />;
      break;
    case "maze":
      rest = <MazeStatic />;
      algo = <AStarLoop key={n} still={still} />;
      break;
    case "rps":
      rest = <RpsStatic />;
      algo = <MarkovLoop key={n} still={still} />;
      break;
  }

  return (
    <div
      className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md border border-line-strong bg-surface sm:h-28 sm:w-28"
      style={{ viewTransitionName: `board-${id}` }}
    >
      <Tile label={LABELS[id]}>
        <motion.g animate={{ opacity: active ? 0 : 1 }} transition={{ duration: 0.18, ease: EASE }}>
          {rest}
        </motion.g>
        {active && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18, ease: EASE }}>
            {algo}
          </motion.g>
        )}
      </Tile>
    </div>
  );
}
