"use client";

import { useEffect } from "react";

export type ReplayStep = { label: string; detail?: string; n: number };

/**
 * Post-game replay scrubber. `at === null` means "live" (final board).
 * ← / → step through moves; the parent renders the board for the chosen step.
 */
export function Replay({ steps, at, onChange }: { steps: ReplayStep[]; at: number | null; onChange: (i: number | null) => void }) {
  const last = steps.length - 1;
  const cur = at ?? last;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onChange(Math.max(0, cur - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = Math.min(last, cur + 1);
        onChange(next === last ? null : next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cur, last, onChange]);

  const s = steps[cur];
  return (
    <div className="mt-4 flex items-center gap-3 text-xs" aria-label="Replay">
      <span className="label !text-[10px]">Replay</span>
      <button
        onClick={() => onChange(Math.max(0, cur - 1))}
        disabled={cur === 0}
        aria-label="Previous move (←)"
        className="h-8 w-8 rounded border border-line-strong text-ink transition-colors duration-150 hover:bg-white/[0.04] disabled:opacity-35"
      >
        ←
      </button>
      <span className="tabular-nums text-muted">
        {cur + 1}/{steps.length}
      </span>
      <button
        onClick={() => {
          const next = Math.min(last, cur + 1);
          onChange(next === last ? null : next);
        }}
        disabled={cur === last}
        aria-label="Next move (→)"
        className="h-8 w-8 rounded border border-line-strong text-ink transition-colors duration-150 hover:bg-white/[0.04] disabled:opacity-35"
      >
        →
      </button>
      <span className="min-w-0 truncate text-ink" aria-live="polite">
        {s?.label}
        {s?.detail && <span className="text-muted"> · {s.detail}</span>}
      </span>
    </div>
  );
}
