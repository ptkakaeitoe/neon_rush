/**
 * Battleship rules + a probability-density targeting AI. Pure functions, no UI.
 *
 * The AI never sees your ships. For every ship still afloat it counts every placement
 * that fits what it knows (no misses, no sunk cells), and weights placements that cover
 * known-but-unsunk hits much higher. Each cell's total = how many plausible placements
 * cover it. It fires at the cell with the highest total: a heat map of where your ships could be.
 */

export const N = 10;
export const FLEET = [5, 4, 3, 3, 2];
export type Ship = { cells: number[]; len: number };

/** What the shooter knows about each cell. */
export const K = {
  Unknown: 0,
  Miss: 1,
  Hit: 2, // hit, ship not sunk yet
  Sunk: 3,
} as const;
export type K = (typeof K)[keyof typeof K];

/** Random fleet (classic rules: ships may touch, never overlap). */
export function randomFleet(): Ship[] {
  for (;;) {
    const taken = new Set<number>();
    const ships: Ship[] = [];
    let ok = true;
    for (const len of FLEET) {
      let placed = false;
      for (let tries = 0; tries < 200 && !placed; tries++) {
        const horiz = Math.random() < 0.5;
        const r = Math.floor(Math.random() * (horiz ? N : N - len + 1));
        const c = Math.floor(Math.random() * (horiz ? N - len + 1 : N));
        const cells = Array.from({ length: len }, (_, k) => (horiz ? r * N + c + k : (r + k) * N + c));
        if (cells.some((x) => taken.has(x))) continue;
        cells.forEach((x) => taken.add(x));
        ships.push({ cells, len });
        placed = true;
      }
      if (!placed) {
        ok = false;
        break;
      }
    }
    if (ok) return ships;
  }
}

/** Result of a shot against a fleet, given the set of cells already hit. */
export function shoot(fleet: Ship[], hits: Set<number>, idx: number): { hit: boolean; sunk: Ship | null } {
  const ship = fleet.find((s) => s.cells.includes(idx));
  if (!ship) return { hit: false, sunk: null };
  const sunk = ship.cells.every((c) => c === idx || hits.has(c));
  return { hit: true, sunk: sunk ? ship : null };
}

export const allSunk = (fleet: Ship[], hits: Set<number>) => fleet.every((s) => s.cells.every((c) => hits.has(c)));

export type Heat = { counts: number[]; placements: number; max: number };

/**
 * Probability density over the board.
 * `know` is the shooter's knowledge per cell, `remaining` the lengths of ships not yet sunk.
 * `hitBoost` multiplies placements that cover open hits (target mode). 1 = pure hunt density.
 */
export function heatmap(know: K[], remaining: number[], hitBoost = 30): Heat {
  const counts = Array<number>(N * N).fill(0);
  let placements = 0;
  for (const len of remaining) {
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++)
        for (const horiz of [true, false]) {
          if (horiz ? c + len > N : r + len > N) continue;
          let blocked = false;
          let covered = 0;
          for (let k = 0; k < len; k++) {
            const i = horiz ? r * N + c + k : (r + k) * N + c;
            const v = know[i];
            if (v === K.Miss || v === K.Sunk) {
              blocked = true;
              break;
            }
            if (v === K.Hit) covered++;
          }
          if (blocked) continue;
          placements++;
          const w = covered ? 1 + covered * hitBoost : 1;
          for (let k = 0; k < len; k++) {
            const i = horiz ? r * N + c + k : (r + k) * N + c;
            if (know[i] === K.Unknown) counts[i] += w;
          }
        }
  }
  let max = 0;
  for (const v of counts) if (v > max) max = v;
  return { counts, placements, max };
}

/** `odds` = the target cell's share of all heat on the board (how concentrated the AI's belief is). */
export type AiShot = { idx: number; heat: Heat; odds: number };

/**
 * Pick the AI's next shot.
 * - randomness: chance of an untargeted random shot (easy levels)
 * - parity: in hunt mode only fire on a checkerboard (ships ≥2 long can't hide between)
 */
export function aiShot(know: K[], remaining: number[], opts: { randomness: number; hitBoost: number; parity: boolean }): AiShot {
  const heat = heatmap(know, remaining, opts.hitBoost);
  const unknown = know.map((v, i) => (v === K.Unknown ? i : -1)).filter((i) => i >= 0);
  const hunting = !know.includes(K.Hit);

  let idx: number;
  if (Math.random() < opts.randomness) {
    idx = unknown[Math.floor(Math.random() * unknown.length)];
  } else {
    let candidates = unknown;
    if (opts.parity && hunting) {
      const even = unknown.filter((i) => (Math.floor(i / N) + (i % N)) % 2 === 0);
      if (even.length) candidates = even;
    }
    let best = -1;
    let ties: number[] = [];
    for (const i of candidates) {
      if (heat.counts[i] > best) {
        best = heat.counts[i];
        ties = [i];
      } else if (heat.counts[i] === best) ties.push(i);
    }
    idx = ties[Math.floor(Math.random() * ties.length)];
  }
  const total = heat.counts.reduce((a, b) => a + b, 0);
  return { idx, heat, odds: total ? heat.counts[idx] / total : 0 };
}
