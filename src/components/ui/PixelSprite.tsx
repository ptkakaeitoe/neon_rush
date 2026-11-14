/** Renders ASCII pixel-art maps as crisp SVG. Each char maps to a palette color; "." is transparent. */
export function PixelSprite({
  map,
  palette,
  size = 4,
  className,
  title,
}: {
  map: string[];
  palette: Record<string, string>;
  size?: number;
  className?: string;
  title?: string;
}) {
  const h = map.length;
  const w = Math.max(...map.map((r) => r.length));
  const rects: React.ReactElement[] = [];
  map.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const fill = palette[ch];
      if (fill) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} style={{ fill }} />);
    }),
  );
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w * size}
      height={h * size}
      shapeRendering="crispEdges"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {rects}
    </svg>
  );
}

/** Original arcade bot mascot ("NEO") */
export const BOT = [
  "....CC....",
  "....CC....",
  ".VVVVVVVV.",
  "VVVVVVVVVV",
  "VWWVVVVWWV",
  "VWKVVVVWKV",
  "VVVVVVVVVV",
  "VVPPPPPPVV",
  ".VVVVVVVV.",
  "..V....V..",
  ".VV....VV.",
];
export const BOT_PALETTE = { C: "#8cff73", V: "#fafafa", W: "#0a0a0b", K: "#0a0a0b", P: "#8cff73" };
export const RUNNER_PALETTE = { C: "var(--accent)", V: "var(--accent)", W: "#0b0b0e", K: "#0b0b0e" };
export const GHOST_PALETTE = { P: "#ff6b6b", W: "#0b0b0e", K: "#f2f2f5" };

export const GHOST = [
  "..PPPP..",
  ".PPPPPP.",
  "PPWWPWWP",
  "PPWKPWKP",
  "PPPPPPPP",
  "PPPPPPPP",
  "PPPPPPPP",
  "P.PP.PP.",
];

export const RUNNER = [
  "..CCCC..",
  ".CCCCCC.",
  ".CWKCWK.",
  ".CCCCCC.",
  "..CCCC..",
  ".VVVVVV.",
  "V.VVVV.V",
  "..V..V..",
];
