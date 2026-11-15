"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { astar, generateMaze, key, manhattan, type P } from "@/lib/ai/astar";
import { type Outcome, useArcade } from "../ArcadeProvider";
import { GameFrame } from "../GameFrame";

/** m:ss.t */
const fmtClock = (ms: number) => {
  const t = Math.floor(ms / 100);
  const s = Math.floor(t / 10);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}.${t % 10}`;
};
import { GHOST, GHOST_PALETTE, PixelSprite, RUNNER, RUNNER_PALETTE } from "../ui/PixelSprite";

const W = 21;
const H = 15;
const MAX_T = 26; // tile px on wide screens; shrinks to fit narrow ones
const SPEED = { easy: 520, medium: 420, hard: 330, unbeatable: 210 } as const; // ms per hunter step
const WANDER = { easy: 0.35, medium: 0.18, hard: 0.08, unbeatable: 0 } as const;

type State = { grid: number[][]; player: P; hunter: P; coins: Set<string>; exit: P };

function newLevel(): State {
  const grid = generateMaze(W, H);
  const open: P[] = [];
  grid.forEach((row, y) => row.forEach((v, x) => v === 0 && open.push({ x, y })));
  const player = { x: 1, y: 1 };
  const exit = { x: W - 2, y: H - 2 };
  const hunter = { x: W - 2, y: 1 };
  const coins = new Set<string>();
  const candidates = open.filter((p) => manhattan(p, player) > 5 && manhattan(p, exit) > 2);
  while (coins.size < 6 && candidates.length) {
    const i = Math.floor(Math.random() * candidates.length);
    coins.add(key(candidates.splice(i, 1)[0]));
  }
  return { grid, player, hunter, coins, exit };
}

export function MazeEscape() {
  const { difficulty, play } = useArcade();
  // component only mounts after user navigation (client-side), so a random initial level is safe
  const [s, setS] = useState<State | null>(newLevel);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Outcome | null>(null);
  const [path, setPath] = useState<P[]>([]);
  const [explored, setExplored] = useState<P[]>([]);
  const [collected, setCollected] = useState(0);
  const [showSearch, setShowSearch] = useState(true);
  // timer: starts on the first move
  const startAt = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [finalMs, setFinalMs] = useState<number | undefined>(undefined);
  const [T, setT] = useState(MAX_T);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setT(Math.max(12, Math.min(MAX_T, Math.floor(e.contentRect.width / W)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // ref is the source of truth (read by key handler + AI loop); state mirrors it for rendering
  const sRef = useRef<State | null>(s);
  const commit = useCallback((next: State) => {
    sRef.current = next;
    setS(next);
  }, []);

  const end = useCallback(
    (o: Outcome) => {
      const ms = startAt.current !== null ? performance.now() - startAt.current : 0;
      setFinalMs(ms);
      setElapsed(ms);
      setRunning(false);
      setResult(o);
    },
    [],
  );

  // player movement
  const move = useCallback(
    (dx: number, dy: number) => {
      const cur = sRef.current;
      if (!cur || result) return;
      const n = { x: cur.player.x + dx, y: cur.player.y + dy };
      if (cur.grid[n.y]?.[n.x] !== 0) return;
      if (!running) {
        startAt.current = performance.now();
        setRunning(true);
      }
      const coins = new Set(cur.coins);
      let got = collected;
      if (coins.delete(key(n))) {
        got += 1;
        setCollected(got);
        play("coin");
      } else play("hover");
      commit({ ...cur, player: n, coins });
      if (n.x === cur.hunter.x && n.y === cur.hunter.y) end("lose");
      else if (n.x === cur.exit.x && n.y === cur.exit.y) end("win");
    },
    [collected, commit, end, play, result, running],
  );

  // live timer while running
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (startAt.current !== null) setElapsed(performance.now() - startAt.current);
    }, 100);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const d: Record<string, [number, number]> = {
        arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1],
        arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0],
      };
      if (d[k]) {
        e.preventDefault();
        move(...d[k]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  // hunter AI loop: recompute A* every step
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const cur = sRef.current;
      if (!cur) return;
      const res = astar(cur.grid, cur.hunter, cur.player);
      setPath(res.path);
      setExplored(res.explored);
      let step = res.path[1] ?? cur.hunter;
      if (Math.random() < WANDER[difficulty]) {
        const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]]
          .map(([dx, dy]) => ({ x: cur.hunter.x + dx, y: cur.hunter.y + dy }))
          .filter((p) => cur.grid[p.y]?.[p.x] === 0);
        step = opts[Math.floor(Math.random() * opts.length)];
      }
      commit({ ...cur, hunter: step });
      if (step.x === cur.player.x && step.y === cur.player.y) end("lose");
    }, SPEED[difficulty]);
    return () => clearInterval(id);
  }, [running, difficulty, end, commit]);

  const reset = () => {
    commit(newLevel());
    setRunning(false);
    setResult(null);
    setPath([]);
    setExplored([]);
    setCollected(0);
    startAt.current = null;
    setElapsed(0);
    setFinalMs(undefined);
    play("click");
  };

  const pathSet = new Set(path.map(key));
  const exploredSet = new Set(explored.map(key));

  return (
    <GameFrame
      gameId="maze"
      title="Maze Escape"
      algo="A* search"
      status={result ? "Round over" : running ? "The hunter is re-planning" : "Move to start. Reach the exit square."}
      tone={result ? "done" : running ? "ai" : "you"}
      inProgress={running}
      result={result}
      resultTitle={result === "win" ? "You escaped" : result === "lose" ? "Caught" : undefined}
      resultMessage={
        result === "win"
          ? `Out in ${fmtClock(finalMs ?? 0)}, with ${collected} coin${collected === 1 ? "" : "s"}.`
          : "A* found the shortest path to you."
      }
      onReset={reset}
      keyHints="Arrows / WASD move"
      fullWidthBoard
      stats={[
        { label: "Time", value: elapsed, format: fmtClock },
        { label: "Nodes expanded", value: explored.length },
        { label: "Path length", value: Math.max(0, path.length - 1) },
      ]}
      toggles={
        <label className="flex cursor-pointer items-center gap-2 text-ink">
          <input type="checkbox" checked={showSearch} onChange={(e) => setShowSearch(e.target.checked)} />
          Show AI thinking
        </label>
      }
      howItWorks="Every step, the hunter re-plans the shortest path to you with A*, ranking tiles by f = g + h."
    >
      {s && (
        <div ref={boxRef} className="flex w-full flex-col items-start gap-6">
          <div className="rounded-md border border-line bg-surface p-2">
          <div className="relative" style={{ width: W * T, height: H * T }}>
            {s.grid.map((row, y) =>
              row.map((v, x) => {
                const k = `${x},${y}`;
                const isExit = x === s.exit.x && y === s.exit.y;
                let bg = v ? "rgb(255 255 255 / 0.13)" : "transparent";
                if (!v && showSearch && exploredSet.has(k)) bg = "rgb(140 255 115 / 0.07)";
                return (
                  <div key={k} className="absolute" style={{ left: x * T, top: y * T, width: T, height: T, background: bg }}>
                    {!v && showSearch && pathSet.has(k) && (
                      <motion.div
                        className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-danger"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                      />
                    )}
                    {s.coins.has(k) && (
                      <motion.div
                        className="absolute inset-[30%] rounded-[2px] bg-ink"
                        animate={{ rotateY: [0, 180, 360] }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                      />
                    )}
                    {isExit && (
                      <motion.div
                        className="absolute inset-0.5 rounded-sm border-2 border-accent"
                        animate={{ opacity: [1, 0.35, 1] }}
                        transition={{ repeat: Infinity, duration: 1.4 }}
                        aria-label="Exit"
                      >
                      </motion.div>
                    )}
                  </div>
                );
              }),
            )}
            <motion.div
              className="absolute z-10"
              initial={false}
              animate={{ left: s.player.x * T + T * 0.08, top: s.player.y * T + T * 0.08 }}
              transition={{ type: "tween", duration: 0.09 }}
            >
              <PixelSprite map={RUNNER} palette={RUNNER_PALETTE} size={(T * 0.84) / 8} title="You" />
            </motion.div>
            <motion.div
              className="absolute z-10"
              initial={false}
              animate={{ left: s.hunter.x * T + T * 0.08, top: s.hunter.y * T + T * 0.08 }}
              transition={{ type: "tween", duration: SPEED[difficulty] / 1000 * 0.8 }}
            >
              <motion.div animate={{ y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 0.4 }}>
                <PixelSprite map={GHOST} palette={GHOST_PALETTE} size={(T * 0.84) / 8} title="Hunter" />
              </motion.div>
            </motion.div>
          </div>
          </div>

          {/* touch D-pad */}
          <div className="grid grid-cols-3 gap-2 lg:hidden" aria-label="Direction pad">
            {([["", 0, 0], ["▲", 0, -1], ["", 0, 0], ["◀", -1, 0], ["▼", 0, 1], ["▶", 1, 0]] as const).map(([lbl, dx, dy], i) =>
              lbl ? (
                <button
                  key={i}
                  onClick={() => move(dx, dy)}
                  aria-label={["", "Up", "", "Left", "Down", "Right"][i]}
                  className="h-14 w-14 rounded-lg bg-surface text-lg text-ink transition-colors active:bg-accent active:text-accent-ink"
                >
                  {lbl}
                </button>
              ) : (
                <span key={i} />
              ),
            )}
          </div>
        </div>
      )}
    </GameFrame>
  );
}
