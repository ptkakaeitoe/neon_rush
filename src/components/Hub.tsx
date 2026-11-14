"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { CONTAINER } from "@/lib/layout";
import { REPO_URL } from "@/lib/site";
import { type GameId, useArcade } from "./ArcadeProvider";
import { RecordStat } from "./ui/Stats";
import { GameThumb } from "./ui/Thumbs";

const EASE = [0.22, 1, 0.36, 1] as const;

type Game = { id: GameId; title: string; algo: string; desc: string };

const GAMES: Game[] = [
  { id: "tictactoe", title: "Tic-Tac-Toe", algo: "minimax", desc: "Scores every possible future board to pick a perfect move." },
  { id: "connect4", title: "Connect Four", algo: "α-β pruning", desc: "Searches several moves ahead and skips branches that can’t matter." },
  { id: "maze", title: "Maze Escape", algo: "A* search", desc: "Reach the exit before a hunter finds the shortest path to you." },
  { id: "othello", title: "Othello", algo: "MCTS", desc: "Plays thousands of random games ahead and picks the move that wins most." },
  { id: "battleship", title: "Battleship", algo: "probability map", desc: "Keeps a heat map of where your ships could be and fires at the likeliest cell." },
];

function GameRow({ g, i }: { g: Game; i: number }) {
  const { go } = useArcade();
  const [active, setActive] = useState(false);
  const on = () => setActive(true);
  const off = () => setActive(false);

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 + i * 0.05, duration: 0.25, ease: EASE }}
    >
      {/* the whole row is one control */}
      <button
        onClick={() => go({ name: "game", game: g.id })}
        onMouseEnter={on}
        onMouseLeave={off}
        onFocus={on}
        onBlur={off}
        className="group relative grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-3 py-6 text-left sm:grid-cols-[auto_minmax(0,1fr)_176px] sm:gap-x-6"
      >
        {/* accent bar on hover / focus */}
        <span
          aria-hidden
          className="absolute -left-4 bottom-6 top-6 w-[2px] scale-y-0 bg-accent transition-transform duration-200 ease-out group-hover:scale-y-100 group-focus-visible:scale-y-100 sm:-left-6"
        />
        <span className="flex items-center gap-3">
          <span className="label hidden w-5 sm:block">{String(i + 1).padStart(2, "0")}</span>
          <GameThumb id={g.id} active={active} />
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-display text-xl font-medium text-ink sm:text-2xl">{g.title}</span>
            <span className="chip">{g.algo}</span>
          </span>
          <span className="mt-2 block max-w-[60ch] text-[13px] leading-relaxed tracking-[-0.01em] text-muted">{g.desc}</span>
          <span className="mt-3 flex sm:hidden">
            <RecordStat gameId={g.id} />
          </span>
        </span>
        {/* right column: fixed width so every row's arrow shares one x */}
        <span className="hidden grid-cols-[minmax(0,1fr)_24px] items-center gap-x-4 self-stretch sm:grid">
          <RecordStat gameId={g.id} />
          <span
            aria-hidden
            className="text-center text-lg text-faint transition-[color,transform] duration-200 ease-out group-hover:translate-x-1 group-hover:text-accent group-focus-visible:translate-x-1 group-focus-visible:text-accent"
          >
            →
          </span>
        </span>
      </button>
    </motion.li>
  );
}

export function Hub() {
  return (
    <div className={`${CONTAINER} flex flex-1 flex-col pt-10 sm:pt-16`}>
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: EASE }}>
        <p className="label-pixel">Arcade · 5 games</p>
        <h1 className="font-display mt-4 text-5xl font-semibold text-ink sm:text-7xl">Choose a game</h1>
        <p className="mt-5 max-w-[60ch] text-[15px] tracking-[-0.01em] text-muted">
          Five opponents, five AI algorithms. Hover or focus a game to watch its algorithm think.
        </p>
      </motion.section>

      <nav aria-label="Games" className="mt-12">
        <ol className="divide-y divide-line border-y border-line">
          {GAMES.map((g, i) => (
            <GameRow key={g.id} g={g} i={i} />
          ))}
        </ol>
      </nav>

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-4 pb-10 pt-16 text-xs text-muted">
        <span>Five algorithms. No libraries.</span>
        {REPO_URL && (
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="rounded transition-colors duration-150 hover:text-ink">
            Source on GitHub ↗
          </a>
        )}
      </footer>
    </div>
  );
}
