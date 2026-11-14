"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { COUNTER, judge, type Move, MOVES, predict, type Prediction } from "@/lib/ai/markov";
import { type Outcome, useArcade } from "../ArcadeProvider";
import { GameFrame } from "../GameFrame";
import { ResultStrip } from "../ui/Stats";
import { RpsGlyph } from "../ui/Thumbs";

const NAME: Record<Move, string> = { R: "Rock", P: "Paper", S: "Scissors" };
const ORDER = { easy: 0, medium: 1, hard: 2, unbeatable: 3 } as const;
const TRUST = { easy: 0.45, medium: 0.65, hard: 0.85, unbeatable: 1 } as const; // chance the AI follows its prediction
const TARGET = 5;
const REVEAL_MS = 700;
const EASE = [0.22, 1, 0.36, 1] as const;

type Round = { you: Move; ai: Move; res: "win" | "lose" | "draw"; hit: boolean };

/** Your most frequent move-to-move transition, e.g. "Rock → Paper". */
function topTransition(history: Move[]) {
  const counts = new Map<string, number>();
  for (let i = 1; i < history.length; i++) {
    const k = `${history[i - 1]}${history[i]}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best: string | null = null;
  let n = 0;
  counts.forEach((v, k) => {
    if (v > n) {
      best = k;
      n = v;
    }
  });
  return best ? `${NAME[(best as string)[0] as Move]} → ${NAME[(best as string)[1] as Move]}` : "—";
}

export function RockPaperScissors() {
  const { difficulty, play } = useArcade();
  const reduce = useReducedMotion();
  const [history, setHistory] = useState<Move[]>([]); // kept across matches: the model keeps learning
  const [rounds, setRounds] = useState<Round[]>([]);
  const [phase, setPhase] = useState<"idle" | "shake" | "reveal">("idle");
  const [current, setCurrent] = useState<Round | null>(null);
  const [pred, setPred] = useState<Prediction | null>(null);
  const [result, setResult] = useState<Outcome | null>(null);

  const you = rounds.filter((r) => r.res === "win").length;
  const ai = rounds.filter((r) => r.res === "lose").length;
  const hits = rounds.filter((r) => r.hit).length;

  const throwMove = useCallback(
    (m: Move) => {
      if (phase === "shake" || result) return;
      const p = predict(history, ORDER[difficulty]);
      const aiMove = Math.random() < TRUST[difficulty] && p.samples > 0 ? COUNTER[p.predicted] : MOVES[Math.floor(Math.random() * 3)];
      const round: Round = { you: m, ai: aiMove, res: judge(m, aiMove), hit: p.samples > 0 && p.predicted === m };
      setPred(p);
      setCurrent(round);
      setPhase("shake");
      play("move");
      setTimeout(() => {
        setPhase("reveal");
        setHistory((h) => [...h, m]);
        const next = [...rounds, round];
        setRounds(next);
        const w = next.filter((r) => r.res === "win").length;
        const l = next.filter((r) => r.res === "lose").length;
        if (w >= TARGET || l >= TARGET) setResult(w >= TARGET ? "win" : "lose");
        else play(round.res === "win" ? "coin" : round.res === "lose" ? "ai" : "hover");
      }, reduce ? 0 : REVEAL_MS);
    },
    [difficulty, history, phase, play, reduce, result, rounds],
  );

  // 1 / 2 / 3 throw (R is restart)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const map: Record<string, Move> = { "1": "R", "2": "P", "3": "S" };
      const m = map[e.key];
      if (m) throwMove(m);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [throwMove]);

  const reset = useCallback(() => {
    setRounds([]);
    setCurrent(null);
    setPhase("idle");
    setResult(null);
    setPred(null);
    play("click");
  }, [play]);

  const shaking = phase === "shake";
  const confidence = pred && pred.samples > 0 ? Math.max(pred.probs.R, pred.probs.P, pred.probs.S) : 0;

  return (
    <GameFrame
      gameId="rps"
      title="Rock Paper Scissors"
      algo="markov chain"
      status={result ? "Match over" : shaking ? "Rock, paper, scissors" : `First to ${TARGET}. You ${you}, AI ${ai}. Pick a hand.`}
      tone={result ? "done" : shaking ? "ai" : "you"}
      inProgress={rounds.length > 0 && !result}
      result={result}
      resultMessage={
        result === "win"
          ? `You out-guessed the Markov chain, ${you}–${ai}.`
          : `The Markov chain read your pattern, ${ai}–${you}. It predicted ${hits} of ${rounds.length} throws.`
      }
      onReset={reset}
      keyHints="1 rock · 2 paper · 3 scissors"
      stats={[
        { label: "Confidence", value: Math.round(confidence * 100), format: (n) => `${Math.round(n)}%` },
        { label: "AI hit rate", value: rounds.length ? Math.round((hits / rounds.length) * 100) : 0, format: (n) => `${Math.round(n)}%` },
        { label: "Your top habit", value: topTransition(history) },
      ]}
      details={
        pred && (
          <div className="space-y-2 text-xs">
            <p className="text-[11px] text-muted">Predicted your last throw</p>
            {MOVES.map((m) => {
              const top = pred.samples > 0 && pred.predicted === m;
              return (
                <div key={m} className="flex items-center gap-3">
                  <span className="flex w-5 justify-center">
                    <RpsGlyph move={m} size={16} title={NAME[m]} color={top ? "#8cff73" : "#fafafa"} />
                  </span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-line-strong">
                    <motion.div
                      className={`h-full rounded-full ${top ? "bg-accent" : "bg-muted"}`}
                      initial={false}
                      animate={{ width: `${pred.probs[m] * 100}%` }}
                      transition={{ duration: 0.25, ease: EASE }}
                    />
                  </div>
                  <span className="w-10 text-right tabular-nums text-ink">{Math.round(pred.probs[m] * 100)}%</span>
                </div>
              );
            })}
          </div>
        )
      }
      howItWorks="A Markov chain finds your recent moves in your history and counters what you usually throw next."
    >
      <div className="flex flex-col items-start gap-6">
        {/* arena */}
        <div className="flex items-start gap-4 sm:gap-6">
          {(["you", "ai"] as const).map((side) => {
            const m = current?.[side];
            return (
              <div key={side} className="flex flex-col items-center gap-3">
                <motion.div
                  className="flex h-32 w-32 items-center justify-center rounded-md border border-line-strong bg-surface sm:h-40 sm:w-40"
                  style={{ transform: side === "ai" ? "scaleX(-1)" : undefined }}
                  animate={shaking && !reduce ? { y: [0, -12, 0, -12, 0] } : { y: 0 }}
                  transition={{ duration: REVEAL_MS / 1000, ease: "easeOut" }}
                >
                  <motion.span
                    key={shaking ? "fist" : `${m}-${rounds.length}`}
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2, ease: EASE }}
                  >
                    <RpsGlyph move={shaking || !m ? "R" : m} size={72} color={side === "you" ? "#8cff73" : "#fafafa"} />
                  </motion.span>
                </motion.div>
                <span className="label">
                  {side === "you" ? "You" : "AI"} · <span className="tabular-nums text-ink">{side === "you" ? you : ai}</span>
                </span>
              </div>
            );
          })}
        </div>

        <p className="h-5 text-sm" aria-live="polite">
          {phase === "reveal" && current && (
            <>
              <span className={current.res === "win" ? "text-accent" : "text-ink"}>
                {current.res === "win" ? "Round won" : current.res === "lose" ? "Round lost" : "Tie"}
              </span>
              <span className="text-muted">
                {" "}
                · {NAME[current.you]} vs {NAME[current.ai]}
                {current.hit && " · AI saw it coming"}
              </span>
            </>
          )}
        </p>

        {/* controls */}
        <div className="flex gap-2">
          {MOVES.map((m, i) => (
            <button
              key={m}
              onClick={() => throwMove(m)}
              disabled={shaking || !!result}
              className="flex w-24 flex-col items-center gap-3 rounded-md border border-line-strong py-4 transition-colors duration-150 hover:border-white/30 hover:bg-white/[0.03] disabled:opacity-35 sm:w-28"
            >
              <RpsGlyph move={m} size={36} />
              <span className="text-xs text-ink">
                {NAME[m]} <span className="text-muted">{i + 1}</span>
              </span>
            </button>
          ))}
        </div>

        {/* rounds this match, newest first */}
        <div className="flex items-center gap-3 text-[11px] text-muted">
          Rounds
          <ResultStrip results={[...rounds].reverse().map((r) => (r.res === "win" ? "w" : r.res === "lose" ? "l" : "d"))} max={9} />
        </div>
      </div>
    </GameFrame>
  );
}
