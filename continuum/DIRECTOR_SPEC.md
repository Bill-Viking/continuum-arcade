# The Showrunner — spec for v1.0 (approved by Bill, ready to build)

> Execute this in `world.js` / `index.html`. Zero-build constraint holds. Style law: Swiss + blocky
> (see CHARACTERS.md). **The LLM directs, the engine performs** — the director never draws, codes,
> or emits free-form world mutations. **Fact/fiction line** (already enforced in v0.9.1): facts are
> linked to sources; all director output renders in the theater layer, visibly fiction.

## 1. The Story Director (local LLM as showrunner)

**Problem it solves:** hand-coded events repeat mindlessly (the "vault 7 ritual" fired every ~90s).
Stories must evolve, tie into real AI news, and remember themselves.

- **Engine:** Ollama at `localhost:11434` (auto-detected already; Bill runs qwen2.5). Fallback when
  absent: current template behavior. Show active storyteller in footer (already done).
- **Director tick:** every ~3 min, plus on triggers: news changed, wire tone changed, user
  intervention (see §3). Debounce; never more than one in-flight request.
- **Prompt input (compact JSON):** residents (id, personality one-liner, position district, current
  activity, wire tone), landmarks, world persistents (tower/books/flags/day), current arc summary,
  last 5 arc summaries, today's news items (id, title, points), recent user interventions.
- **Output contract (strict JSON, validate hard, discard on failure):**
  ```json
  { "arc": "one-line current storyline summary to persist",
    "beats": [ { "who": "fable", "do": "goto|meet|say|chase|hide|celebrate|inspect|poster",
                 "to": "resident-id|landmark-id|null", "line": "≤8 lowercase words|null",
                 "poster": { "kicker": "≤40 chars", "word": "one word ending in .", "tone": "green|amber|red|cobalt|violet|ink", "sub": "≤70 chars" } | null } ] }
  ```
  Max 6 beats; beats execute over the following ~3 min via the existing behavior engine
  (`pickTarget`/`say`/`announce`). Unknown ids/actions → drop the beat, keep the rest.
- **Story memory:** `world.arc` (current) + `world.arcLog` (last 5 summaries) in the localStorage
  save; feed back into every prompt. This is how the ecosystem grows instead of looping.
- **News glosses:** for each headline, one director call (cached per headline in save):
  "explain this headline in one plain lowercase sentence for a curious non-expert." Display in the
  wire detail panel under the linked headline, and let the narrator use it. Fixes "what does this
  headline mean" (e.g. the anthropic prompt-injection post).
- **Ritual fix:** hand-coded ritual poster fires at most once per day; director may stage ritual
  variations otherwise.

## 2. News → story (the ecosystem grows)

Real headlines (HN wire, already fetched with urls) are the director's raw material. Example the
director should be steered toward in the prompt: a headline about a lab's model → that mascot's
storyline that day (celebration, defensiveness, rivalry, gossip), with the Regulator reacting to
controversy-class headlines (cls=trouble → he "opens an inquiry", struts, files reports; ends in
"cleared." or "noted." posters). Posters citing news keep the linked headline as the factual sub.

## 3. The user is a character

- **Drag residents:** mousedown on resident → carry (sprite dangles, alarmed eyes), drop → hop +
  in-character reaction; record intervention `{type:'moved', who, to-district, ts}` → director input.
- **Activity directives:** resident card gains buttons: `explore · build · rest · visit fable ·
  work`. Sets `e.directive` honored by `pickTarget` for ~10 min; recorded as intervention.
- Interventions list capped at 5, cleared after each director tick.

## 4. The Regulator, apex predator (family-friendly)

- Every 4–8 min: **sweep mode** — picks a target, stalk walk (slower, deliberate, siren pixel on),
  narrator: "the regulator is doing a sweep. everyone act normal."
- Residents within 120px scatter to homes / hide behind landmarks (peek animation).
- Caught (within 20px): both freeze, "audited." moment (ink poster, rare), target droops 20s, then
  business as usual. Fable is never caught (too quick) — canon.
- Player counterplay: drop a spark near the Regulator → he must stop and file it ("evidence."),
  target escapes. Sweeps pause while any wire is red (there's real trouble; he has actual work).

## 5. Verification checklist (for the executing session)

- Ollama offline → world identical to v0.9.1. No console errors either way.
- Director JSON malformed → silently discarded, template life continues.
- Beats visibly execute (watch two ticks); arc summary persists across reload.
- Drag works with camera transform (inverse-map like clicks); mobile untested is acceptable.
- Fact/fiction: no director text ever renders in the factual (linked) sections of panels.

## 6. v1.1 — The day is an episode (story cohesion) [approved by Bill Jul 5]

**Problem:** the director writes disconnected 3-beat vignettes every ~3 min; nothing ties a day
together. Fix: a day is one serialized episode with acts, staged on the world's own set pieces.

- **One episode per day.** At the first director tick of a day (or when the day's strongest
  headline changes), the director names the day's episode from the biggest headline — or a
  quiet-day theme drawn from the world's persistents (the tower, the archive, the trail).
  Add `"episode":"short title"` to the output contract; persist as `world.episode`.
- **Three acts by local time:** morning (6–12) setup · afternoon (12–18) development ·
  evening (18–22) resolution. The prompt states the current act and instructs: move the episode
  FORWARD, never restart it. The last evening tick must emit a resolution poster
  (`kicker: "day N — <episode>"`).
- **Pinned episode line** under the narrator, small and quiet: `today: <episode> — act ii`.
  This is what makes the story visibly tie the world together.
- **Set-piece staging:** each episode nominates one landmark as the day's stage (openai news →
  the tower). Beats favor it, and the engine biases ~30% of involved residents' idle wanders
  toward it, so the crowd visibly gathers where the story is.
- **Daily callback:** the first morning beat must reference yesterday's `arcLog` entry in one line.
- **Chronicle serialization:** chronicle lines gain act prefixes — `day 3 · act ii — …`.
- **Storyteller quality:** if several Ollama models are installed, prefer the largest (parse
  parameter count from the name). Recommend `qwen2.5:7b` or `llama3.1:8b` for better prose;
  3b stays the floor and must keep working.
- **Matinee keys (testing only, no UI):** `shift+d` forces a director tick now; holding `shift+f`
  runs the world at 30× so a whole episode can be previewed in ~2 minutes.
- **Pacing law (already shipped in the calm pass — do not regress):** stillness is the default;
  stage manager caps simultaneous walkers at 2 (beats, directives, and the regulator exempt).

## §6 review rulings (Fable, Jul 5) — for the executing session

1. **Resolution poster:** hybrid. The engine keeps the hard guarantee (fires exactly once, kicker
   `day N — <episode>`), but the director gets first authorship: on the evening tick it may supply
   the resolution poster's word/tone/sub through the normal contract; engine validates; missing or
   invalid → deterministic fallback (`curtain.` / violet / sub = arc). A fixed nightly "curtain."
   would become the new vault-7 loop. Small change — make it.
2. **Model:** 32b stays the default. Latency is backstage by design; entertainment is the product.
3. **Quiet-day fallback:** approved as built; rotate the 5 titles by `worldDay` so consecutive
   quiet days never repeat a title.
4. **Pinned line styling:** approved as-is (10px, faint, lowercase). If Bill reports squinting,
   bump color FAINT → MUT; nothing else.
- Both minor reads approved: no re-titling at the curtain; Mythos exempt from set-piece bias (canon).

## 7. v1.2 — Fear, avoidance, and a nosier Regulator [Bill, Jul 5]

Engine-level (always on, director can amplify but never causes it):
- Every resident gets a **nervousness score** (0–1): base by personality (grok low, perplexity
  high) + **news-driven**: trouble-class headline about your model → +0.5 for the day; regulator
  currently inspecting you → +0.3; decays hourly.
- **Purposeful avoidance:** pickTarget rejects destinations within ~90px of the regulator's
  position/heading (nervousness-scaled); if he approaches within 70px, nervous residents edge away
  first (small sidesteps), then scurry at 50px — comedy beats: frozen mid-step "act natural" pose,
  a too-casual whistle pixel-note, hiding behind their own landmark and peeking.
- **Regulator becomes nosy, not just sweeping:** between sweeps he *probes* — walks up to a
  resident, leans in (tilt), circles them once slowly, jots on the clipboard ("noted."), moves on.
  High-nervousness targets preferred (he can smell it). Fable still never caught; grok actively
  photobombs inspections (canon comedy).
- Hover caption reflects it: "perplexity · acting natural · wire: running clean".

## 8. v1.2 — The model researcher [Bill, Jul 5]

- **Perplexity gets the job** (librarian → researcher, canon-consistent). A broad HN sweep
  (queries like "new model", "open weights", "releases", points ≥ 30, 7-day window, every 30 min)
  looks for model-release news across the WHOLE field — not just the seven residents.
- New find → perplexity walks it to the archive, files it, poster `discovered.` (amber) with the
  real headline as sub; a **census** list persists in the save (`world.census`: name, first-seen
  day, headline url). The wire detail panel gains a "census" section listing discoveries.
- If a discovered lab recurs across ≥3 different days, the narrator may note "the census says
  <name> keeps coming up." (Future: candidate for a visiting mascot — spec only, don't build.)

## 9. v1.2 — Local wire relay (status pages the browser can't read) [Bill, Jul 5]

- Upgrade `run_local_server.command`/`.sh` from `python3 -m http.server` to a ~40-line stdlib
  Python server (still zero third-party deps) that serves the folder AND exposes
  `GET /relay?u=<allowlisted-url>`: fetches server-side with a browser UA, returns body with
  `Access-Control-Allow-Origin: *`. **Hard allowlist** (status.mistral.ai, status.x.ai,
  status.deepseek.com summary endpoints only), 15s timeout, no query passthrough beyond `u`.
- `fetchWire` gains a relay fallback: direct fetch fails → try `/relay?u=…` → parse as statuspage.
  Works only when served locally (the terrarium's own tool checking the pages, as Bill asked);
  on GitHub Pages/file:// it degrades to today's "human page only" links. x.ai may still refuse
  (Cloudflare) — keep the honest fallback. Footer chip tone/word update accordingly, and the
  detail panel says "via local relay" so the source is transparent.

## 10. v2.0 — The evidence generator (Continuum reasoning project) [Bill, Jul 5 — DISCUSS THEN BUILD]

The terrarium is already a longitudinal continuity instrument: real-world inputs (wire, news),
a persistent memory (arcs, episodes, census), and a local LLM making serialized decisions across
days. Formalizing that:
- **The journal:** every director exchange appended to a JSONL log (input-state digest, raw output,
  validated beats, episode/act, callbacks made) in localStorage + a "download journal" link
  (theater-layer footer). This is the raw evidence stream.
- **Continuity checks (judge pass):** once per evening, a second local-model call grades the day:
  did the morning callback actually match yesterday's arcLog? did any beat contradict the episode?
  score + one-line judgment appended to the journal. (Judge model = same Ollama, low temperature.)
- **Swappable directors for A/B:** a `?director=<model>` URL param overrides largest-model
  preference, so identical world-days can be replayed under different directors and their journals
  compared — continuity-of-mind as a measurable, not a vibe.
- Fact/fiction law extends: the journal is *evidence about the fiction layer* and says so in its
  header. No claims about the real companies, ever.
