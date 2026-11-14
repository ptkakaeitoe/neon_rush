/** Rock-Paper-Scissors predictor using Markov chains over the player's move history. */
export type Move = "R" | "P" | "S";
export const MOVES: Move[] = ["R", "P", "S"];
export const BEATS: Record<Move, Move> = { R: "S", P: "R", S: "P" }; // key beats value
export const COUNTER: Record<Move, Move> = { R: "P", P: "S", S: "R" }; // what beats key

export type Prediction = { predicted: Move; probs: Record<Move, number>; order: number; samples: number };

/**
 * Looks at the last `order` moves, counts what the player threw next after that same
 * pattern in the past, and returns the probability distribution. Falls back to lower
 * orders (and finally raw frequency) when the pattern hasn't been seen yet.
 */
export function predict(history: Move[], maxOrder: number): Prediction {
  for (let order = Math.min(maxOrder, history.length - 1); order >= 0; order--) {
    const ctx = history.slice(history.length - order).join("");
    const counts: Record<Move, number> = { R: 0, P: 0, S: 0 };
    let samples = 0;
    for (let i = order; i < history.length; i++) {
      if (history.slice(i - order, i).join("") === ctx) {
        counts[history[i]]++;
        samples++;
      }
    }
    if (samples > 0) {
      const probs = { R: counts.R / samples, P: counts.P / samples, S: counts.S / samples };
      const predicted = MOVES.reduce((a, b) => (probs[b] > probs[a] ? b : a));
      return { predicted, probs, order, samples };
    }
  }
  return { predicted: MOVES[Math.floor(Math.random() * 3)], probs: { R: 1 / 3, P: 1 / 3, S: 1 / 3 }, order: -1, samples: 0 };
}

export function judge(player: Move, ai: Move): "win" | "lose" | "draw" {
  if (player === ai) return "draw";
  return BEATS[player] === ai ? "win" : "lose";
}
