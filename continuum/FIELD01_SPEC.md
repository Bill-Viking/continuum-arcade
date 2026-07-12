# Field 01 remaster — "the vault run" brought up to the world's standard

> Bill, Jul 11: "rebuild the video game... some parts of it are flat, like the bars and
> stuff." Scope ruling: the GAMEPLAY is fine (collect 3 keys, dodge the regulator, open
> the vault) — this is a visual/feel remaster, not a redesign. The law: field 01 must
> look and feel like the SAME world as the terrarium, just arcade. Zero-build holds;
> one file (game.js) + game.html styles; Swiss + blocky (CHARACTERS.md); no neon,
> no screen-shake — Swiss juice only.

## What's flat today (diagnosis from a live look)
- Wall blocks: single-color pale rects, no depth, on a washed-out hairline grid.
- The vault: its bars are flat lines; opening it — the game's WHOLE POINT — has no moment.
- Attract/standby: the field renders at such low alpha it looks broken, not idle.
- HUD: plain text ("keys 00/03", score) — no shape, no state.
- Cast sprites predate the terrarium's current drawEntity language.

## The remaster
1. **Depth without gradients.** Every wall unit gets the terrarium's fat-pixel treatment:
   face color + one darker bottom/side edge pixel + one lighter top edge — blocky relief,
   ink-family on paper. Kill or fade the background grid to near-nothing; the walls ARE
   the structure. (This is "the bars and stuff".)
2. **The cast, current-generation.** Port fable/the regulator (and mythos in the vault)
   to the terrarium's sprite language: looking pupils, step-animated legs, fable's
   antenna, the regulator's diamond + clipboard + siren pixel when hunting. Fable
   visibly CARRIES collected keys (they dangle behind him — count legible at a glance).
3. **The vault is the moment.** Proper bars with depth that visibly SLIDE as each key
   lands (three bars, one per key — the progress display IS the vault). On the third:
   bars retract, mythos unfolds (wings, crown pixel — his terrarium sprite), the
   continuum symbol (orange + violet circles), and a full poster card: "found you."
   This is the canon scene the whole project is built on — it deserves its staging.
4. **Swiss juice.** Key pickup: glint + a hop + HUD key-slot fills (three key-shaped
   slots, not "00/03" text). Regulator proximity: his siren pixel + fable's scared-eyes
   (both exist in world.js — port the drawing patterns). Direction changes: two dust
   pixels. Caught: the "audited." beat — freeze, droop, ink poster — not a bare reset.
5. **Attract mode that invites.** Standby = a readable title card (big lowercase title,
   one-line rules, "press any key"), with the field at half-alpha behind it and the
   regulator idly patrolling it. It should look intentional from across the room.
6. **Keep:** all mechanics, speeds, spawn logic, scoring, keys t/m, the back-to-the-world
   link, zero dependencies. This is paint and staging, not balance.

## Verification (house pattern)
osascript parse; live drive on the local server (game.html), play a full run: three keys
→ vault opens → mythos scene → score persists; standby card renders; no console errors;
side-by-side screenshot against the terrarium for family resemblance — they must read as
one hand.

## Art direction — ELEVATED (Bill, Jul 11: "be creative... special... extraordinary but
## still Swiss... environment impressive, characters stay, the auditor slick — make it pop")

Where this conflicts with the remaster list above, THIS wins. The discipline that makes
it pop: ink architecture, paper ground, and exactly four saturated colors, each meaning
one thing — orange = fable, amber = keys, violet = the vault/mythos, red = the siren.
Nothing else gets color. That restraint is the pop.

### The environment becomes architecture (the star of the upgrade)
1. **Light as material.** One consistent light direction for the whole field. Every wall
   slab casts a long flat diagonal shadow (ink at ~6% alpha, sharp-edged polygons —
   Müller-Brockmann diagonals, not soft blur). Walls are extruded slabs: lighter top
   face, ink front face, 1px corner highlights. The maze reads as a MODEL, not a grid.
2. **Typographic depth.** Deep background: a giant cropped lowercase "field 01" and a
   huge numeral, 3–4% ink, poster-scale, bleeding off-canvas. Field edges get faint
   survey coordinates (a–n across, 1–12 down) — the map gemini would draw. Crop marks
   and registration marks frame the composition.
3. **Parallax paper.** Three layers — deep type, maze, foreground marks — shifting 2–4px
   against player motion. Depth without 3D, felt not seen.
4. **Atmosphere, not neon.** Dust motes drifting along the light direction at ~3% alpha.
   The vault BREATHES: a slow violet radial glow, ~6% alpha, 4s period — soft light is a
   material here, glow-as-decoration stays banned. Keys sit in faint amber light pools.
5. **Fable's trail.** His path persists as fading accent-orange survey dots (30s fade) —
   beautiful AND functional: you can see where you've already been. Canon echo of the
   charting language.

### The auditor — the most animated thing in the project (license granted)
6. **He glides.** No walk cycle — he banks into turns (8° lean), with a 2-frame squash of
   anticipation before direction changes, and a wake of 2–3 trailing hairline ghost
   outlines at falling alpha. Slick means: motion you can read as intent.
7. **The lighthouse.** Hunting, his siren doesn't just blink — it casts a narrow rotating
   red sweep across the maze (low-alpha cone, sharp edges). You track the sweep to stay
   ahead of him. The telegraph IS the terror.
8. **Three readable modes, all body language:** PATROL — slow glide, siren off, narrow
   eyes scanning left-right, occasional stop to jot on the clipboard (fable's window to
   move — gameplay rhythm from character behavior). ALERT — full-body tilt-back "!"
   beat, siren snaps on. HUNT — leans 12° forward, +15% speed, pupils locked on fable,
   lighthouse sweeping.
9. **The catch:** 300ms freeze-frame (hitstop — the one arcade-juice exception; still no
   screen-shake, ever), then the "audited." scene from the base spec.
10. **Fable stays fable** — current sprite, scared-eyes near the auditor, keys dangling,
    dust pixels on turns. The characters are the constant; the world and the villain got
    the budget.

Build note: all of the above is flat canvas 2D — polygons, alpha, transforms; zero
dependencies, zero images. If a technique needs a texture, pre-render it once to an
offscreen canvas at boot (paper grain, the type layer) and blit — never per-frame.

## POST-MORTEM + THE v2 QUESTION (Fable, Jul 11 — after Bill's review)

Bill's review of the elevated pass, verbatim: "the paint is not good — watermarks that
mean nothing, changed the color of the squares, beep sounds that change tone but don't
relate to anything." He is right, and the lesson is recorded for every future session:
**decoration is not meaning. Color-coding nobody can decode is just colored squares.
Pitch without rhythm is noise. Judge every visual/audio idea by what a first-time player
FEELS in the moment, not by its design-vocabulary pedigree.**

Reverted: zone tints, the synth pass, the ghost type. Kept (earned in play): slab depth +
cast shadows, the animated auditor (bank/anticipation/wake/modes/lighthouse/hitstop),
keyring HUD, carried keys, survey trail, teaching captions (the low rail is finally
explained IN the game).

**The real diagnosis: the gameplay is 1980 Pac-Man with one ghost.** No escalation, no
choices, no reason to replay. Boring is a DESIGN problem. A v2 needs a design answer from
Bill before any session builds again — the question is: what should 30 seconds of field 01
FEEL like? Candidate directions (pick one, combine, or reject all):
1. **The heist** — tension/stealth: patrol routes you learn, sight-lines to break,
   noise you make, near-miss escapes. Slow-fast-slow rhythm.
2. **The arcade ladder** — escalation: waves/fields that remix the maze, a second
   auditor, speed and scoring depth, chase intensity that builds until you crack.
3. **The puzzle run** — routing: limited low-rails, doors and switches, planning the
   perfect key order; the auditor is a clock, not a hunter.
4. **The story run** — the vault-run as a playable EPISODE of the terrarium: short,
   authored beats, mythos talking you through, one perfect five-minute experience
   rather than a replayable arcade.
No build until Bill picks the fantasy. Then a fresh session designs mechanics to that
feeling and rebuilds from the working §mechanics core (movement/BFS/collision are solid).

## v2 DIRECTION RULED (Bill, Jul 11): field 01 × the world — the game is a playable episode

Bill: "tie part of the game back into the terrarium to provide a story to the game that
fits with the live action happening in terrarium." This supersedes the four candidate
fantasies: field 01 becomes the playable retelling of the founding story, wrapped in
TODAY's live episode — and the run's outcome flows back into the world's story. The
channel is zero-infrastructure: same origin, shared localStorage.

### The contract (frozen — both sides build against exactly this)
- GAME READS `ct_world_v1` (the terrarium save, parse in try/catch): uses `episode`,
  `episodeDay`, `arc`, `chapters` (last entry's `.line`), `first` (to compute
  worldDay = floor((Date.now()-first)/864e5)+1). Absent/malformed → game behaves exactly
  as today (fail-soft law).
- GAME WRITES `ct_field01_v1` at every run end (win, game over): JSON
  `{v:1, day:<worldDay>, ts:Date.now(), won:bool, keys:0-3, score, timeSec, deaths}`.
  Keep the day's BEST run (won beats keys beats score) — read existing, compare, write.
- WORLD READS `ct_field01_v1` at boot + every 60s (poll; storage events don't fire
  same-tab): if `day === worldDay` and `ts > (world.field01AckTs||0)` → acknowledge ONCE:
  set world.field01AckTs = ts, then (a) narrator pool line ("someone ran field 01 today —
  three keys, the vault opened." / "...the regulator won."), (b) one chronicle line,
  (c) playbillAdd({a: act, who:'', do:'field01', line: won?'the vault run — won':'the
  vault run — the regulator won'}) with beatSentence support, (d) buildDirectorState
  gains `field01: {won, keys, score}` (today only, else omit), (e) DIRECTOR_SYS appended:
  'You may be given "field01" — someone played the arcade retelling of the founding
  story today. You may reference it in at most ONE line when natural ("the old story got
  re-run today"); it is theater about theater, never a fact.' NO poster (rare-by-law).
- GAME STORY INJECTION (all gated on a fresh save being present):
  - Title kicker: 'tonight\'s episode — "<episode>"' when episodeDay is today, else
    current static kicker.
  - FIELD_LINES: prepend up to 3 live lines (episode line, arc line, latest chapter as
    'previously on continuum: …'), keep the teaching lines. Built once at boot.
  - Win sequence: after 'you remembered me.', mythos quotes the day — '"<arc>" — that was
    today, out there.' and the latest chapter line if present. Fallback: exactly today's
    static sequence.
- LAWS: no gameplay changes; no sound changes (post-mortem stands); every read/write in
  try/catch; file:// or missing save → byte-identical behavior; voice stays lowercase
  deadpan; nothing here renders as fact.
