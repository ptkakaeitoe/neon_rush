"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { aiShot, allSunk, type Heat, K, N, randomFleet, type Ship, shoot } from "@/lib/ai/battleship";
import { type Outcome, useArcade } from "../ArcadeProvider";
import { GameFrame } from "../GameFrame";
import { coord, gridKeyDown } from "../ui/gridKeys";

const LEVEL = {
  easy: { randomness: 0.7, hitBoost: 30, parity: false },
  medium: { randomness: 0.25, hitBoost: 30, parity: false },
  hard: { randomness: 0, hitBoost: 30, parity: false },
  unbeatable: { randomness: 0, hitBoost: 30, parity: true },
} as const;
const EASE = [0.22, 1, 0.36, 1] as const;
const AIM_MS = 700; // how long the AI's heat map + crosshair stay up before it fires
// 10 columns; grids sit side by side on desktop, stacked on phones
const CELL = "min(1.6rem, calc((100vw - 2rem - 20px) / 10))";

type Shots = Map<number, "hit" | "miss">;

const sunkCells = (fleet: Ship[], hits: Set<number>) =>
  new Set(fleet.filter((s) => s.cells.every((c) => hits.has(c))).flatMap((s) => s.cells));
const shipsLeft = (fleet: Ship[], hits: Set<number>) => fleet.filter((s) => !s.cells.every((c) => hits.has(c))).length;

export function Battleship() {
  const { difficulty, play: sfx } = useArcade();
  const reduce = useReducedMotion();
  // component mounts only after client navigation, so random fleets are safe initial state
  const [myFleet, setMyFleet] = useState<Ship[]>(randomFleet);
  const [aiFleet, setAiFleet] = useState<Ship[]>(randomFleet);
  const [myShots, setMyShots] = useState<Shots>(new Map()); // my shots on the AI's waters
  const [aiShots, setAiShots] = useState<Shots>(new Map()); // AI shots on my fleet
  const [aiKnow, setAiKnow] = useState<K[]>(() => Array<K>(N * N).fill(K.Unknown));
  const [aiRemaining, setAiRemaining] = useState<number[]>(() => myFleet.map((s) => s.len));
  const [turn, setTurn] = useState<"you" | "ai">("you");
  const [result, setResult] = useState<Outcome | null>(null);
  const [heat, setHeat] = useState<Heat | null>(null);
  const [lastAi, setLastAi] = useState(-1);
  const [odds, setOdds] = useState(0);
  const [showHeat, setShowHeat] = useState(true);
  const [aiming, setAiming] = useState(-1); // cell the AI has picked and is about to fire at

  const myHits = new Set([...myShots].filter(([, v]) => v === "hit").map(([k]) => k));
  const aiHitSet = new Set([...aiShots].filter(([, v]) => v === "hit").map(([k]) => k));
  const aiSunk = sunkCells(aiFleet, myHits);
  const mySunk = sunkCells(myFleet, aiHitSet);
  const myShipCells = new Set(myFleet.flatMap((s) => s.cells));
  const started = myShots.size > 0;

  const fire = (idx: number) => {
    if (turn !== "you" || result || myShots.has(idx)) return;
    const r = shoot(aiFleet, myHits, idx);
    const next = new Map(myShots).set(idx, r.hit ? "hit" : "miss");
    setMyShots(next);
    sfx(r.sunk ? "coin" : r.hit ? "drop" : "hover");
    const hits = new Set([...next].filter(([, v]) => v === "hit").map(([k]) => k));
    if (allSunk(aiFleet, hits)) setResult("win");
    else setTurn("ai");
  };

  // AI turn: build the heat map and aim at the hottest cell (shown on your fleet), then fire
  useEffect(() => {
    if (turn !== "ai" || result) return;
    const shot = aiShot(aiKnow, aiRemaining, LEVEL[difficulty]);
    const aim = setTimeout(() => {
      setHeat(shot.heat);
      setOdds(shot.odds);
      setAiming(shot.idx);
    }, 0);
    const t = setTimeout(() => {
      setAiming(-1);
      setHeat(shot.heat);
      setOdds(shot.odds);
      setLastAi(shot.idx);
      const r = shoot(myFleet, aiHitSet, shot.idx);
      const know = aiKnow.slice();
      know[shot.idx] = r.hit ? K.Hit : K.Miss;
      if (r.sunk) {
        r.sunk.cells.forEach((c) => (know[c] = K.Sunk));
        const i = aiRemaining.indexOf(r.sunk.len);
        setAiRemaining(aiRemaining.filter((_, j) => j !== i));
      }
      setAiKnow(know);
      const next = new Map(aiShots).set(shot.idx, r.hit ? "hit" : "miss");
      setAiShots(next);
      sfx(r.hit ? "ai" : "hover");
      const hits = new Set([...next].filter(([, v]) => v === "hit").map(([k]) => k));
      if (allSunk(myFleet, hits)) setResult("lose");
      else setTurn("you");
    }, reduce ? 0 : AIM_MS);
    return () => {
      clearTimeout(aim);
      clearTimeout(t);
    };
    // aiHitSet is derived from aiShots
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, result, aiKnow, aiRemaining, aiShots, myFleet, difficulty, sfx, reduce]);

  const reset = useCallback(() => {
    const fleet = randomFleet();
    setMyFleet(fleet);
    setAiFleet(randomFleet());
    setMyShots(new Map());
    setAiShots(new Map());
    setAiKnow(Array<K>(N * N).fill(K.Unknown));
    setAiRemaining(fleet.map((s) => s.len));
    setTurn("you");
    setResult(null);
    setHeat(null);
    setLastAi(-1);
    setAiming(-1);
    setOdds(0);
    sfx("click");
  }, [sfx]);

  const shuffle = () => {
    if (started) return;
    const fleet = randomFleet();
    setMyFleet(fleet);
    setAiRemaining(fleet.map((s) => s.len));
    sfx("move");
  };

  const aiTurn = turn === "ai" && !result;
  const aiHitRate = aiShots.size ? aiHitSet.size / aiShots.size : 0;
  const resultMessage =
    result === "win" ? `You sank the whole fleet in ${myShots.size} shots.` : `The heat map found every ship in ${aiShots.size} shots.`;

  return (
    <GameFrame
      gameId="battleship"
      title="Battleship"
      algo="probability map"
      status={result ? "Round over" : aiTurn ? "AI is updating its heat map" : started ? "Your turn. Fire at enemy waters." : "Pick a cell in enemy waters to fire."}
      tone={result ? "done" : aiTurn ? "ai" : "you"}
      inProgress={started && !result}
      result={result}
      resultMessage={resultMessage}
      onReset={reset}
      keyHints="Arrows move · Enter fires"
      stats={[
        { label: "Placements counted", value: heat?.placements ?? 0 },
        { label: "Heat share", value: Math.round(odds * 1000) / 10, format: (n) => `${n.toFixed(1)}%` },
        { label: "AI hit rate", value: Math.round(aiHitRate * 100), format: (n) => `${Math.round(n)}%` },
      ]}
      toggles={
        <label className="flex cursor-pointer items-center gap-2 text-ink">
          <input type="checkbox" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} />
          Show AI thinking
        </label>
      }
      howItWorks="The AI counts every way your remaining ships could still fit, weights the ones touching its hits, and fires where the most placements overlap. The green glow on your fleet is that count; the ring is where it's about to fire."
    >
      <div className="flex flex-col gap-8 sm:flex-row" style={{ ["--bs" as string]: CELL }}>
        {/* enemy waters: where you fire */}
        <section aria-label="Enemy waters">
          <p className="label mb-2 flex justify-between">
            <span>Enemy waters</span>
            <span className="normal-case tracking-normal">{shipsLeft(aiFleet, myHits)} ships left</span>
          </p>
          <div
            className="grid gap-px rounded-md border border-line bg-surface p-px"
            style={{ gridTemplateColumns: `repeat(${N}, var(--bs))` }}
            role="grid"
            onKeyDown={gridKeyDown(N, N)}
          >
            {Array.from({ length: N * N }, (_, i) => {
              const s = myShots.get(i);
              const sunk = aiSunk.has(i);
              return (
                <button
                  key={i}
                  data-cell={i}
                  onClick={() => fire(i)}
                  aria-disabled={!!s || aiTurn || !!result}
                  aria-label={`${coord(i, N)}${s ? `, ${sunk ? "sunk" : s}` : ""}`}
                  className={`relative flex aspect-square w-[var(--bs)] items-center justify-center bg-bg ${
                    !s && !aiTurn && !result ? "cursor-crosshair hover:bg-white/[0.06]" : "cursor-default"
                  }`}
                >
                  {s === "miss" && <span className="h-1 w-1 rounded-full bg-muted" />}
                  {s === "hit" && (
                    <motion.span
                      className={`absolute ${sunk ? "inset-0 bg-accent" : "inset-[25%] bg-accent"}`}
                      initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.18, ease: EASE }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* your fleet: where the AI fires, with its heat map */}
        <section aria-label="Your fleet">
          <p className="label mb-2 flex justify-between">
            <span>Your fleet</span>
            <span className="normal-case tracking-normal">{shipsLeft(myFleet, aiHitSet)} ships left</span>
          </p>
          <div className="grid gap-px rounded-md border border-line bg-surface p-px" style={{ gridTemplateColumns: `repeat(${N}, var(--bs))` }}>
            {Array.from({ length: N * N }, (_, i) => {
              const s = aiShots.get(i);
              const ship = myShipCells.has(i);
              const h = showHeat && heat && !s && heat.max ? heat.counts[i] / heat.max : 0;
              return (
                <div key={i} className={`relative flex aspect-square w-[var(--bs)] items-center justify-center ${ship ? "bg-white/[0.16]" : "bg-bg"}`}>
                  {h > 0 && <span className="absolute inset-0 bg-accent transition-opacity duration-200" style={{ opacity: h * 0.55 }} aria-hidden />}
                  {s === "miss" && <span className="relative h-1 w-1 rounded-full bg-muted" />}
                  {s === "hit" && <span className={`absolute ${mySunk.has(i) ? "inset-0" : "inset-[25%]"} bg-ink`} />}
                  {i === lastAi && <span className="absolute inset-0 ring-1 ring-inset ring-ink" aria-hidden />}
                  {i === aiming && (
                    <motion.span
                      className="absolute -inset-px z-10 ring-2 ring-accent"
                      initial={{ scale: 1.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      aria-label="AI is aiming here"
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 h-8">
            {!started && (
              <button
                onClick={shuffle}
                className="h-8 rounded border border-line-strong px-3 text-xs text-ink transition-colors duration-150 hover:bg-white/[0.04]"
              >
                Shuffle my fleet
              </button>
            )}
          </div>
        </section>
      </div>
    </GameFrame>
  );
}
