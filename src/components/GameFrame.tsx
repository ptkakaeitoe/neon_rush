"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { CONTAINER } from "@/lib/layout";
import { DIFFICULTY_LABEL, type GameId, useGameStats } from "@/lib/stats";
import { type Outcome, useArcade } from "./ArcadeProvider";
import { DifficultySlider } from "./DifficultySlider";
import { PixelButton } from "./ui/PixelButton";
import { type CoinPhase, CoinOverlay, type Starter } from "./ui/CoinFlip";
import { CountUp, Scoreboard } from "./ui/Stats";

export type Stat = { label: string; value: number | React.ReactNode; format?: (n: number) => string };

/** Tone of the status line: your turn (accent pulse), AI working, or finished. */
export type StatusTone = "you" | "ai" | "done";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Cycling mono dots for "AI is thinking…" (static with reduced motion). */
function Dots() {
  const reduce = useReducedMotion();
  const [n, setN] = useState(3);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setN((x) => (x % 3) + 1), 300);
    return () => clearInterval(id);
  }, [reduce]);
  return (
    <span aria-hidden className="inline-block w-[3ch] text-left">
      {".".repeat(reduce ? 3 : n)}
    </span>
  );
}

export function GameFrame({
  gameId,
  title,
  algo,
  status,
  tone = "you",
  inProgress,
  stats,
  toggles,
  howItWorks,
  details,
  result,
  resultTitle,
  resultMessage,
  keyHints,
  onReset,
  below,
  tree,
  fullWidthBoard = false,
  coin,
  children,
}: {
  gameId: GameId;
  title: string;
  algo: string;
  status: string;
  tone?: StatusTone;
  /** a game has started and isn't finished (difficulty changes then need confirmation) */
  inProgress: boolean;
  /** up to 3 key-value AI stats */
  stats: Stat[];
  /** view toggles for the panel footer (e.g. "Show move scores") */
  toggles?: React.ReactNode;
  /** short explanation: inline when the panel has nothing else to show, otherwise in the "How it works" pop-over */
  howItWorks: React.ReactNode;
  /** optional extra AI detail shown inside the disclosure (candidate moves, prediction bars…) */
  details?: React.ReactNode;
  result: Outcome | null;
  resultTitle?: string;
  resultMessage: string;
  keyHints: string;
  onReset: () => void;
  /** rendered under the result card, e.g. the post-game replay */
  below?: React.ReactNode;
  /** the AI's search tree, shown under the board */
  tree?: React.ReactNode;
  /** board measures its own width (maze) — give it the full column instead of shrink-wrapping */
  fullWidthBoard?: boolean;
  /** coin flip deciding who starts; the overlay covers the board while `flipping` */
  coin?: { first: Starter; flipping: boolean; round: number; phase: CoinPhase; toss: () => void; skip: () => void };
  children: React.ReactNode;
}) {
  const { go, difficulty, play } = useArcade();
  const statsApi = useGameStats(gameId);
  const reduce = useReducedMotion();
  // the result pops up as a modal shortly after the game ends (so the final move / win line is seen first)
  const [modalOpen, setModalOpen] = useState(false);
  useEffect(() => {
    if (!result) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- close when a new game starts
      setModalOpen(false);
      return;
    }
    const t = setTimeout(() => setModalOpen(true), reduce ? 0 : 450);
    return () => clearTimeout(t);
  }, [result, reduce]);

  // Record each finished game exactly once.
  const recorded = useRef(false);
  useEffect(() => {
    if (!result) {
      recorded.current = false;
      return;
    }
    if (recorded.current) return;
    recorded.current = true;
    statsApi.record(result === "win" ? "w" : result === "lose" ? "l" : "d", difficulty);
    play(result === "win" ? "win" : result === "lose" ? "lose" : "draw");
    // difficulty is read at the moment the result lands
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // R restarts, Esc returns to all games
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") {
        if (modalOpen) setModalOpen(false);
        else go({ name: "hub" });
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        onReset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onReset, modalOpen]);

  const heading = resultTitle ?? (result === "win" ? "You win" : result === "lose" ? "You lost" : "Draw");

  return (
    <div className={`${CONTAINER} flex-1 pb-28`}>
      <header className="pt-1 sm:pt-3">
        {/* toolbar: navigation left, match settings right */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => go({ name: "hub" })}
            className="label-pixel -ml-1 inline-flex h-8 items-center gap-2 rounded px-1 transition-colors duration-150 hover:text-ink"
          >
            <span aria-hidden>←</span> All games
          </button>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="min-w-0 flex-1 sm:w-[300px] sm:flex-none">
              <DifficultySlider fill inProgress={inProgress} onRestart={onReset} />
            </div>
            <button
              onClick={onReset}
              aria-label="Restart (R)"
              title="Restart (R)"
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-md border border-line-strong text-lg text-muted transition-colors duration-150 hover:bg-white/[0.05] hover:text-ink"
            >
              ↻
            </button>
          </div>
        </div>

        {/* title + status, scoreboard opposite */}
        <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-5 sm:mt-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h1 className="font-display text-4xl font-semibold sm:text-5xl">{title}</h1>
              <span className="chip">{algo}</span>
            </div>
            <p className="mt-3 flex items-center gap-2.5 text-sm text-ink" aria-live="polite">
              <motion.span
                className={`h-2 w-2 rounded-full ${tone === "done" ? "bg-faint" : tone === "ai" ? "bg-ink" : "bg-accent"}`}
                animate={tone === "done" ? { opacity: 1 } : { opacity: [1, 0.25, 1] }}
                transition={{ repeat: Infinity, duration: tone === "ai" ? 0.6 : 1.4 }}
              />
              <span>
                {status}
                {tone === "ai" && <Dots />}
              </span>
            </p>
          </div>
          <Scoreboard gameId={gameId} difficulty={difficulty} levelLabel={DIFFICULTY_LABEL[difficulty]} />
        </div>
      </header>

      <div
        className={`mt-10 grid grid-cols-1 items-start gap-10 lg:mt-12 lg:gap-12 ${
          fullWidthBoard ? "lg:grid-cols-[minmax(0,1fr)_380px]" : "lg:grid-cols-[auto_minmax(0,1fr)]"
        }`}
      >
        {/* board column: left-aligned with the title */}
        <div className="flex min-w-0 flex-col items-start">
          <div style={{ viewTransitionName: `board-${gameId}` }} className={`relative ${fullWidthBoard ? "w-full" : "max-w-full"}`}>
            {children}
            <AnimatePresence>{coin?.flipping && <CoinOverlay first={coin.first} round={coin.round} phase={coin.phase} onToss={coin.toss} onSkip={coin.skip} />}</AnimatePresence>
          </div>

          {/* below the board: key hints while playing; after the result modal closes, the replay */}
          <div className="mt-5 w-full max-w-xl">
            {!result && <p className="hidden text-[11px] text-faint sm:block">{keyHints} · R restart · Esc all games</p>}
            {result && !modalOpen && below}
          </div>
        </div>

        {/* AI panel: stats strip, then the AI's live picture (tree / details), or the explanation when there's none */}
        <aside aria-label="Inside the AI" className="w-full min-w-0 lg:max-w-[500px] lg:justify-self-end lg:border-l lg:border-line lg:pl-12">
          <div className="flex min-h-8 items-center justify-between gap-4 text-[13px]">
            <p className="label whitespace-nowrap">Inside the AI</p>
            <div className="flex items-center gap-4 whitespace-nowrap">
              {(tree || details) && <HowItWorks id={`how-${gameId}`}>{howItWorks}</HowItWorks>}
              {toggles}
            </div>
          </div>

          <dl className="mt-3 grid grid-cols-3 border-y border-line py-3" aria-label="AI stats">
            {stats.slice(0, 3).map((s, i) => (
              <div key={s.label} className={`flex min-w-0 flex-col-reverse justify-end gap-1 ${i ? "border-l border-line pl-4" : ""}`}>
                <dt className="text-[11px] leading-snug text-muted">{s.label}</dt>
                <dd className="font-display text-lg font-semibold leading-none text-ink">
                  {typeof s.value === "number" ? <CountUp value={s.value} format={s.format} /> : <span className="tabular-nums">{s.value}</span>}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-6">{tree ?? details ?? <p className="text-[13px] leading-relaxed text-muted">{howItWorks}</p>}</div>
        </aside>
      </div>

      {/* after the modal closes: a small floating card keeps the result and the next step in reach */}
      <AnimatePresence>
        {result && !modalOpen && (
          <motion.div
            role="region"
            aria-label="Round result"
            className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            <div className="flex items-center gap-3 rounded-md border border-line-strong bg-bg py-2 pl-5 pr-2 shadow-2xl shadow-black/60">
              <p className={`font-display text-lg font-semibold ${result === "win" ? "text-accent" : "text-ink"}`}>{heading}</p>
              <PixelButton variant="primary" size="sm" onClick={onReset}>
                Play again
              </PixelButton>
              <PixelButton variant="ghost" size="sm" onClick={() => setModalOpen(true)}>
                Details
              </PixelButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {result && modalOpen && (
          <ResultModal
            win={result === "win"}
            heading={heading}
            message={resultMessage}
            canReview={!!below}
            onAgain={onReset}
            onHub={() => go({ name: "hub" })}
            onClose={() => setModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Centered result dialog: backdrop, focus kept inside, Esc / backdrop click / Review closes it. */
function ResultModal({
  win,
  heading,
  message,
  canReview,
  onAgain,
  onHub,
  onClose,
}: {
  win: boolean;
  heading: string;
  message: string;
  canReview: boolean;
  onAgain: () => void;
  onHub: () => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<Element | null>(null);

  useEffect(() => {
    restoreTo.current = document.activeElement;
    return () => (restoreTo.current as HTMLElement | null)?.focus?.();
  }, []);

  // keep Tab inside the dialog
  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !box.current) return;
    const items = [...box.current.querySelectorAll<HTMLElement>("button")];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: EASE }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-heading"
        aria-describedby="result-message"
        onKeyDown={trap}
        initial={{ opacity: 0, scale: 0.98, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2, ease: EASE }}
        className="w-full max-w-sm rounded-md border border-line-strong bg-bg p-6 text-center shadow-2xl shadow-black/60"
      >
        <p id="result-heading" className={`font-display text-3xl font-semibold ${win ? "text-accent" : "text-ink"}`}>
          {heading}
        </p>
        <p id="result-message" className="mt-2 text-[13px] text-muted">
          {message}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <PixelButton variant="primary" autoFocus onClick={onAgain} className="w-full">
            Play again
          </PixelButton>
          <div className="flex gap-2">
            {canReview && (
              <PixelButton variant="secondary" onClick={onClose} className="flex-1">
                Review moves
              </PixelButton>
            )}
            <PixelButton variant="secondary" onClick={onHub} className="flex-1">
              All games
            </PixelButton>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** "How it works" pop-over: closes on outside click or Esc (without leaving the game). */
function HowItWorks({ id, children }: { id: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => root.current && !root.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);
  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        aria-label="How it works"
        className={`flex h-8 items-center gap-1.5 rounded transition-colors duration-150 hover:text-ink ${open ? "text-ink" : "text-muted"}`}
      >
        <span aria-hidden className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] leading-none">
          i
        </span>
        <span className="hidden sm:inline">How it works</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            role="dialog"
            aria-label="How it works"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: EASE }}
            className="absolute right-0 top-full z-30 mt-2 w-[min(340px,calc(100vw-2rem))] space-y-2 rounded-md border border-line-strong bg-bg p-4 text-[13px] leading-relaxed text-muted shadow-2xl shadow-black/60"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
