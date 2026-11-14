/** Shared Tic-Tac-Toe pieces: drawn as SVG so "O" never reads as a zero. Colour via currentColor. */
export function PieceX({ size = 40, stroke = 3, className }: { size?: number; stroke?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M5 5 19 19M19 5 5 19" stroke="currentColor" strokeWidth={stroke} strokeLinecap="square" fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function PieceO({ size = 40, stroke = 3, className }: { size?: number; stroke?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth={stroke} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
