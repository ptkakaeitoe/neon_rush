# Neon Rush Arena — Tactical Mini-Game Hub

A retro neon arcade hub (Next.js 16 + React 19 + Tailwind 4 + Framer Motion) showcasing four AI algorithms in real-time gameplay.

| Game | AI | File |
| --- | --- | --- |
| Tic-Tac-Toe | Minimax | `src/lib/ai/minimax.ts` |
| Connect Four | Minimax + Alpha-Beta Pruning (centre-first ordering) | `src/lib/ai/alphabeta.ts` |
| Maze Escape | A* with Manhattan heuristic (re-planned every tick) | `src/lib/ai/astar.ts` |
| Rock Paper Scissors | n-gram Markov predictor with back-off | `src/lib/ai/markov.ts` |

## Run

```bash
npm install
npm run dev     # http://localhost:3000
```

Production: `npm run build && npm start`. Fonts are self-hosted (`@fontsource`), so it works offline in class.

## Features

- **Title screen → Hub → Game**, animated screen transitions, parallax pixel starfield, CRT scanlines.
- **HUD**: lives (pixel hearts), animated score counter, persistent high score, music on/off, music/SFX volume, mute (`M`).
- **Background music**: chiptune synthesised live with the Web Audio API (`src/lib/audio.ts`) — no audio files, no licensing issues. Starts on START (browsers need a click before audio).
- **Difficulty slider** (Easy / Hard / Unbeatable) controls search depth, blunder rate, hunter speed and predictor order.
- **AI Insight panel** in every game: nodes searched, pruned branches, path length, prediction probabilities — good for live demos.
- Win confetti, lose screen-shake, spring-animated pieces.

## Controls

- Title: `Enter` to start · Anywhere: `M` mute
- Connect Four: `1`–`7` to drop · Maze: arrows / WASD (D-pad on mobile) · RPS: `1` `2` `3` or `R` `P` `S`

## Structure

```
src/
  app/            layout, page, globals.css (neon theme tokens)
  components/
    Arcade.tsx           screen router + background
    ArcadeProvider.tsx   global state: screen, difficulty, score, lives, audio
    Hud.tsx  TitleScreen.tsx  Hub.tsx  GameFrame.tsx  DifficultySlider.tsx
    games/               TicTacToe, ConnectFour, MazeEscape, RockPaperScissors
    ui/                  PixelButton, PixelSprite (SVG pixel art), Starfield
  lib/
    audio.ts             chiptune + SFX engine
    ai/                  the four algorithms (pure TS, framework-free)
```
