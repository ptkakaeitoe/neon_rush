"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { audio } from "@/lib/audio";
import { CONTAINER } from "@/lib/layout";
import { resetAllStats } from "@/lib/stats";
import { useArcade } from "./ArcadeProvider";

function SpeakerIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      {off ? <path d="m22 9-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
    </svg>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className="flex h-11 w-full items-center justify-between text-[13px] text-ink"
    >
      {label}
      <span className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-accent" : "bg-line-strong"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-bg transition-[left] ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function AudioMenu() {
  const { music, setMusic, sfxVol, setSfxVol, muted, toggleMute } = useArcade();
  const [open, setOpen] = useState(false);
  const [musicOn, setMusicOn] = useState(audio.playing);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggleMusic = () => {
    if (audio.playing) audio.stopMusic();
    else audio.startMusic();
    setMusicOn(audio.playing);
  };

  return (
    <div ref={ref} className="relative flex items-center gap-1">
      <button
        onClick={toggleMute}
        aria-pressed={!muted}
        title={muted ? "Turn sound on (M)" : "Mute (M)"}
        className="flex h-9 items-center gap-2 rounded-md px-2.5 text-xs text-muted transition-colors duration-150 hover:bg-white/[0.05] hover:text-ink"
      >
        <span className={muted ? "text-faint" : "text-accent"}>
          <SpeakerIcon off={muted} />
        </span>
        <span className="hidden sm:inline">Sound {muted ? "off" : "on"}</span>
      </button>
      <button
        onClick={() => {
          setMusicOn(audio.playing);
          setConfirmReset(false);
          setResetDone(false);
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-label="Settings"
        title="Settings"
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-white/[0.05] hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
          <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
          <circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 z-50 w-64 rounded-lg border border-line-strong bg-bg px-4 py-2 shadow-2xl shadow-black/60"
          >
            <Toggle label="Music" on={musicOn} onChange={toggleMusic} />
            <div className="my-2 h-px bg-line" />
            {(
              [
                ["Music volume", music, setMusic],
                ["Effects volume", sfxVol, setSfxVol],
              ] as const
            ).map(([label, v, set]) => (
              <label key={label} className="block py-2">
                <span className="mb-2 flex justify-between text-xs text-muted">
                  {label} <span className="text-ink">{Math.round(v * 100)}</span>
                </span>
                <input
                  type="range" min={0} max={1} step={0.05} value={v}
                  onChange={(e) => set(Number(e.target.value))}
                  onPointerUp={() => audio.sfx("coin")}
                  className="range w-full"
                />
              </label>
            ))}
            <div className="my-2 h-px bg-line" />
            {resetDone ? (
              <p className="flex h-11 items-center text-[13px] text-muted" role="status">
                Stats cleared.
              </p>
            ) : confirmReset ? (
              <div className="py-2" role="group" aria-label="Confirm reset">
                <p className="text-[13px] text-ink">Clear every game&apos;s record?</p>
                <div className="mt-2 flex gap-2">
                  <button
                    autoFocus
                    onClick={() => {
                      resetAllStats();
                      setConfirmReset(false);
                      setResetDone(true);
                    }}
                    className="h-8 rounded border border-danger/60 px-3 text-xs text-danger transition-colors duration-150 hover:bg-danger/10"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="h-8 rounded px-3 text-xs text-muted transition-colors duration-150 hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                className="flex h-11 w-full items-center text-[13px] text-ink transition-colors duration-150 hover:text-danger"
              >
                Reset stats…
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Hud() {
  const { screen, go } = useArcade();
  const onTitle = screen.name === "title";

  return (
    <header className={`${CONTAINER} relative z-40 flex items-center justify-between gap-4 py-5`}>
      <button
        onClick={() => !onTitle && go({ name: "title" })}
        className={`font-pixel flex items-center gap-1.5 text-[15px] text-ink transition-opacity duration-150 ${onTitle ? "invisible" : "hover:opacity-70"}`}
        tabIndex={onTitle ? -1 : 0}
        aria-label="Neon Rush, back to title"
      >
        NEON RUSH
        <span className="blink inline-block h-3.5 w-2 bg-accent" aria-hidden />
      </button>

      <div className="flex items-center">
        <AudioMenu />
      </div>
    </header>
  );
}
