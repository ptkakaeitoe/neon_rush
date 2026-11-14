# Neon Rush Arena — Tactical Mini-Game Hub

A retro neon arcade hub (Next.js 16 + React 19 + Tailwind 4 + Framer Motion) showcasing five AI algorithms in real-time gameplay.

| Game | AI | File |
| --- | --- | --- |
| Tic-Tac-Toe | Minimax | `src/lib/ai/minimax.ts` |
| Connect Four | Minimax + Alpha-Beta Pruning (centre-first ordering) | `src/lib/ai/alphabeta.ts` |
| Maze Escape | A* with Manhattan heuristic (re-planned every tick) | `src/lib/ai/astar.ts` |
| Othello | Monte Carlo Tree Search (UCT) | `src/lib/ai/othello.ts` |
| Battleship | Probability-density heat map (hunt / target, parity) | `src/lib/ai/battleship.ts` |

## Run

```bash
npm install
npm run dev     # http://localhost:3000
```

Production: `npm run build && npm start`. Fonts are self-hosted (`@fontsource`), so it works offline in class.

## Features

- **Title → hub → game**, with a View Transition that morphs each hub thumbnail into its game board (falls back to a fade).
- **Hub thumbnails** animate each algorithm on hover or focus: a minimax tree, alpha-beta pruning, A* expanding, MCTS visit counts, a Battleship heat map.
- **Difficulty** (Easy / Medium / Hard / Max) sets search depth, time budget, blunder rate, hunter speed or shot randomness.
- **AI panel** in every game: the live search numbers (boards checked, nodes pruned, simulations, placements counted…) plus a "How it works" disclosure.
- **Records**: wins, draws and losses per game and difficulty, saved in `localStorage` (`src/lib/stats.ts`), resettable from settings.
- **Result modal** after each game; Tic-Tac-Toe and Connect Four also have a move-by-move replay.
- **Background music**: chiptune synthesised live with the Web Audio API (`src/lib/audio.ts`). `M` mutes anywhere.
- Respects `prefers-reduced-motion` (no animations, no artificial AI delay).

## Controls

- Title: `Enter` to start · Anywhere: `M` mute
- Tic-Tac-Toe: `1`–`9` (numpad layout) · Connect Four: `1`–`7` · Maze: arrows / WASD (D-pad on mobile) · Othello and Battleship: arrows + Enter
- Every game: `R` restart · `Esc` back to all games

## Structure

```
src/
  app/            layout, page, globals.css (design tokens)
  components/
    Arcade.tsx           screen router + background
    ArcadeProvider.tsx   global state: screen, difficulty, audio, view transitions
    Hud.tsx  TitleScreen.tsx  Hub.tsx  GameFrame.tsx  DifficultySlider.tsx
    games/               TicTacToe, ConnectFour, MazeEscape, Othello, Battleship
    ui/                  Thumbs (animated SVG thumbnails), Stats, Pieces, Replay, PixelButton
  lib/
    audio.ts             chiptune + SFX engine
    stats.ts             the only code that touches stats storage
    ai/                  the five algorithms (pure TS, framework-free)
```
