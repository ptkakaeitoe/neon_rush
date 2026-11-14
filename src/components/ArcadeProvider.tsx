"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { audio, type Sfx } from "@/lib/audio";
import type { Difficulty, GameId } from "@/lib/stats";

export type { Difficulty, GameId } from "@/lib/stats";
export type Screen = { name: "title" } | { name: "hub" } | { name: "game"; game: GameId };
export type Outcome = "win" | "lose" | "draw";

type Ctx = {
  screen: Screen;
  go: (s: Screen) => void;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  music: number;
  setMusic: (v: number) => void;
  sfxVol: number;
  setSfxVol: (v: number) => void;
  muted: boolean;
  toggleMute: () => void;
  play: (s: Sfx) => void;
  /** true while the current screen arrived through a View Transition (skip the framer page fade) */
  viaViewTransition: boolean;
  /** the new screen calls this once mounted, so the View Transition can snapshot it */
  screenReady: () => void;
};

const ArcadeCtx = createContext<Ctx | null>(null);

function readLS(key: string, fallback: number) {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : Number(v);
  } catch {
    return fallback;
  }
}
function writeLS(key: string, v: number) {
  try {
    window.localStorage.setItem(key, String(v));
  } catch {
    /* storage unavailable — fine */
  }
}

type DocWithVT = Document & { startViewTransition?: (cb: () => Promise<void> | void) => unknown };

/** True when the browser supports the View Transitions API and the user allows motion. */
export function canViewTransition() {
  if (typeof document === "undefined") return false;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return !reduce && typeof (document as DocWithVT).startViewTransition === "function";
}

export function ArcadeProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<Screen>({ name: "title" });
  const [difficulty, setDifficulty] = useState<Difficulty>("hard");
  const [music, setMusicState] = useState(0.5);
  const [sfxVol, setSfxState] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const [viaViewTransition, setViaVT] = useState(false);
  const pendingVT = useRef<(() => void) | null>(null);
  const screenReady = useCallback(() => {
    pendingVT.current?.();
    pendingVT.current = null;
  }, []);

  useEffect(() => {
    const m = readLS("nra.music", 0.5);
    const s = readLS("nra.sfx", 0.7);
    const mu = readLS("nra.muted", 0) === 1;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage after mount
    setMusicState(m);
    setSfxState(s);
    setMuted(mu);
    audio.setMusicVolume(m);
    audio.setSfxVolume(s);
    audio.setMuted(mu);
  }, []);

  const play = useCallback((s: Sfx) => audio.sfx(s), []);

  // Navigation morphs shared elements (thumbnail → board) with the View Transitions API when available.
  const go = useCallback((s: Screen) => {
    audio.sfx("click");
    const doc = document as DocWithVT;
    if (canViewTransition() && doc.startViewTransition) {
      doc.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            pendingVT.current = resolve;
            setTimeout(resolve, 800); // never hang the transition
            flushSync(() => {
              setViaVT(true);
              setScreen(s);
            });
          }),
      );
    } else {
      setViaVT(false);
      setScreen(s);
    }
  }, []);

  const setMusic = useCallback((v: number) => {
    setMusicState(v);
    audio.setMusicVolume(v);
    writeLS("nra.music", v);
  }, []);
  const setSfxVol = useCallback((v: number) => {
    setSfxState(v);
    audio.setSfxVolume(v);
    writeLS("nra.sfx", v);
  }, []);
  const toggleMute = useCallback(() => {
    setMuted((m) => {
      audio.setMuted(!m);
      writeLS("nra.muted", m ? 0 : 1);
      return !m;
    });
  }, []);

  // "M" toggles mute anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === "m" && !(e.target instanceof HTMLInputElement)) toggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleMute]);

  const value = useMemo(
    () => ({ screen, go, difficulty, setDifficulty, music, setMusic, sfxVol, setSfxVol, muted, toggleMute, play, viaViewTransition, screenReady }),
    [screen, go, difficulty, music, setMusic, sfxVol, setSfxVol, muted, toggleMute, play, viaViewTransition, screenReady],
  );

  return <ArcadeCtx.Provider value={value}>{children}</ArcadeCtx.Provider>;
}

export function useArcade() {
  const c = useContext(ArcadeCtx);
  if (!c) throw new Error("useArcade must be used inside <ArcadeProvider>");
  return c;
}
