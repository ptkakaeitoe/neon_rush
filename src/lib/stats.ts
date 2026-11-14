"use client";

/**
 * Minimal per-game record: wins, draws and losses per difficulty. Nothing else is saved.
 *
 * - One versioned localStorage key; this module is the ONLY place that touches storage for stats.
 * - A tiny external store keeps the landing page and game pages in sync, and
 *   `useSyncExternalStore` keeps SSR / hydration consistent (the server snapshot is empty).
 * - Reads and writes are wrapped in try/catch and parsed data is validated, so corrupted
 *   storage falls back to empty stats. Older saves with extra fields still load (only w / d / l are read).
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";

export type GameId = "tictactoe" | "connect4" | "maze" | "rps";
export type Difficulty = "easy" | "medium" | "hard" | "unbeatable";
export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "unbeatable"];
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard", unbeatable: "Max" };

/** A finished game's outcome. */
export type Result = "w" | "l" | "d";
export type Tally = { w: number; d: number; l: number };
export type GameStats = Record<Difficulty, Tally>;
type Store = Record<GameId, GameStats>;

const KEY = "neonrush:stats:v1";
const GAME_IDS: GameId[] = ["tictactoe", "connect4", "maze", "rps"];

const zero = (): Tally => ({ w: 0, d: 0, l: 0 });
const emptyGame = (): GameStats => ({ easy: zero(), medium: zero(), hard: zero(), unbeatable: zero() });
const emptyStore = (): Store => ({ tictactoe: emptyGame(), connect4: emptyGame(), maze: emptyGame(), rps: emptyGame() });

/* ---------------- validation ---------------- */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

function parseStore(raw: string | null): Store {
  const store = emptyStore();
  if (!raw) return store;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return store;
  }
  if (!isObj(data)) return store;
  for (const id of GAME_IDS) {
    const g = data[id];
    if (!isObj(g)) continue;
    // accept both the current shape and the older { byDifficulty: {...} } shape
    const by = isObj(g.byDifficulty) ? g.byDifficulty : g;
    for (const d of DIFFICULTIES) {
      const s = by[d];
      if (isObj(s)) store[id][d] = { w: count(s.w), d: count(s.d), l: count(s.l) };
    }
  }
  return store;
}

/* ---------------- external store ---------------- */

const SERVER_SNAPSHOT: Store = emptyStore();
let snapshot: Store | null = null;
const listeners = new Set<() => void>();

function read(): Store {
  if (snapshot) return snapshot;
  try {
    snapshot = parseStore(window.localStorage.getItem(KEY));
  } catch {
    snapshot = emptyStore();
  }
  return snapshot;
}

function write(next: Store) {
  snapshot = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked: keep the in-memory copy */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      snapshot = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Clear every game's record. */
export function resetAllStats() {
  write(emptyStore());
}

/* ---------------- hook ---------------- */

export function useGameStats(gameId: GameId) {
  const store = useSyncExternalStore(subscribe, read, () => SERVER_SNAPSHOT);
  const game = store[gameId];

  /** Save a finished game. */
  const record = useCallback(
    (result: Result, difficulty: Difficulty) => {
      const cur = read();
      const prev = cur[gameId][difficulty];
      write({ ...cur, [gameId]: { ...cur[gameId], [difficulty]: { ...prev, [result]: prev[result] + 1 } } });
    },
    [gameId],
  );

  return useMemo(() => {
    const totals = DIFFICULTIES.reduce<Tally>((t, d) => ({ w: t.w + game[d].w, d: t.d + game[d].d, l: t.l + game[d].l }), zero());
    return { record, totals, byDifficulty: game };
  }, [game, record]);
}
