"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { audio } from "@/lib/audio";
import { useArcade } from "./ArcadeProvider";
import { PixelButton } from "./ui/PixelButton";
import { BOT, BOT_PALETTE, PixelSprite } from "./ui/PixelSprite";
import { CONTAINER } from "@/lib/layout";

const ALGOS = ["minimax", "α-β pruning", "A* search", "markov chain"];

export function TitleScreen() {
  const { go } = useArcade();
  const [about, setAbout] = useState(false);

  const start = () => {
    audio.unlock();
    audio.startMusic();
    audio.sfx("start");
    go({ name: "hub" });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`${CONTAINER} flex flex-1 flex-col items-center justify-center pb-24 text-center`}>
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <PixelSprite map={BOT} palette={BOT_PALETTE} size={5} title="NEO, the arcade bot" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.25, ease: "easeOut" }}
        className="font-pixel mt-10 text-[40px] leading-[1.1] text-ink sm:text-[72px]"
      >
        NEON RUSH
        <br />
        ARENA
        <span className="blink ml-2 inline-block h-[0.7em] w-[0.4em] translate-y-[0.05em] bg-accent align-baseline" aria-hidden />
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.16, duration: 0.25 }}
        className="mt-6 max-w-md text-[15px] text-muted"
      >
        Four arcade games. Four AI opponents. Watch each one think as it plays.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24, duration: 0.25, ease: "easeOut" }}
        className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
      >
        <PixelButton variant="primary" size="lg" onClick={start} className="w-56 sm:w-auto">
          Start game
        </PixelButton>
        <PixelButton
          variant="ghost"
          size="lg"
          className="w-56 sm:w-auto"
          aria-expanded={about}
          onClick={() => {
            audio.sfx("click");
            setAbout((a) => !a);
          }}
        >
          {about ? "Hide details" : "What's inside"}
        </PixelButton>
      </motion.div>

      <AnimatePresence initial={false}>
        {about && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-8 flex flex-wrap justify-center gap-2 overflow-hidden"
          >
            {ALGOS.map((a) => (
              <li key={a} className="chip">
                {a}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      <p className="label blink mt-16 hidden sm:block">Press Enter</p>
    </div>
  );
}
