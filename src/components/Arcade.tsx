"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useLayoutEffect } from "react";
import { ArcadeProvider, type GameId, useArcade } from "./ArcadeProvider";
import { ConnectFour } from "./games/ConnectFour";
import { MazeEscape } from "./games/MazeEscape";
import { Battleship } from "./games/Battleship";
import { Othello } from "./games/Othello";
import { TicTacToe } from "./games/TicTacToe";
import { Hub } from "./Hub";
import { Hud } from "./Hud";
import { TitleScreen } from "./TitleScreen";

const GAMES: Record<GameId, React.ComponentType> = {
  tictactoe: TicTacToe,
  connect4: ConnectFour,
  maze: MazeEscape,
  othello: Othello,
  battleship: Battleship,
};

/** Tells a pending View Transition that the new screen is in the DOM. */
function Mounted() {
  const { screenReady } = useArcade();
  useLayoutEffect(() => {
    screenReady();
  }, [screenReady]);
  return null;
}

// When a View Transition drives navigation, skip the framer fade so the shared board can morph.
const pageVariants = {
  initial: (vt: boolean) => (vt ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }),
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" as const } },
  exit: (vt: boolean) => (vt ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -8, transition: { duration: 0.22, ease: "easeOut" as const } }),
};

function Screens() {
  const { screen, viaViewTransition } = useArcade();
  const k = screen.name === "game" ? `game-${screen.game}` : screen.name;
  const Game = screen.name === "game" ? GAMES[screen.game] : null;

  return (
    <AnimatePresence mode="wait" custom={viaViewTransition}>
      <motion.main
        key={k}
        className="flex flex-1 flex-col"
        custom={viaViewTransition}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <Mounted />
        {screen.name === "title" && <TitleScreen />}
        {screen.name === "hub" && <Hub />}
        {Game && <Game />}
      </motion.main>
    </AnimatePresence>
  );
}

export function Arcade() {
  return (
    <ArcadeProvider>
      {/* every framer animation follows the OS "reduce motion" setting */}
      <MotionConfig reducedMotion="user">
        <div className="relative z-10 flex min-h-screen flex-col">
          <Hud />
          <Screens />
        </div>
      </MotionConfig>
    </ArcadeProvider>
  );
}
