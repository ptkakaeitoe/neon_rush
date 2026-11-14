/**
 * Arrow-key navigation for a grid of buttons (roving focus).
 * Each cell button needs `data-cell={index}`; Enter / Space activate it natively.
 */
export function gridKeyDown(cols: number, rows: number) {
  return (e: React.KeyboardEvent<HTMLElement>) => {
    const d: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const step = d[e.key];
    if (!step) return;
    const cur = (document.activeElement as HTMLElement | null)?.dataset.cell;
    if (cur === undefined) return;
    e.preventDefault();
    const i = Number(cur);
    const r = Math.min(rows - 1, Math.max(0, Math.floor(i / cols) + step[0]));
    const c = Math.min(cols - 1, Math.max(0, (i % cols) + step[1]));
    e.currentTarget.querySelector<HTMLElement>(`[data-cell="${r * cols + c}"]`)?.focus();
  };
}

/** "D3"-style coordinate: column letter + row number. */
export const coord = (i: number, cols: number) => `${String.fromCharCode(65 + (i % cols))}${Math.floor(i / cols) + 1}`;
