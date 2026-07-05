# Guardrail Breakout v0.2 — Simple Arcade Prototype

A deliberately simpler one-screen retro arcade version.

## Run
Open `index.html` in Chrome, Edge, Firefox, or Safari.

## Controls
- Arrow keys / WASD: move
- Space: start / restart
- T: Live Wire status screen
- M: mute

## Goal
Collect 3 keys and reach Mythos' vault while avoiding The Regulator.

## Notes
The playfield is intentionally simple: Pac-Man-era readability, black background, neon maze, one enemy, three keys, one vault, and a live AI ticker at the top.

The ticker attempts to fetch public OpenAI and Claude status feeds while the game is open. Browser CORS/network rules may block some status checks; if so, the game falls back to cached/arcade status text.
