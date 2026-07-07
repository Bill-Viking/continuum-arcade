# HANDOFF — read this first in any new session

**Project:** Continuum — a living AI world (terrarium). This file is the session-independent
source of truth. If you are an AI session reading this: read `DIRECTOR_SPEC.md`, `CHARACTERS.md`,
and `README.md` next, then check `git log --oneline -10` for anything newer than this file.

## State as of Jul 6, 2026 (v1.2 + §10 rulings)

SHIPPED and pushed to github.com/Bill-Viking/continuum-arcade (main):
- v0.x: the terrarium (blocky residents, persistence, posters, news wire, live status wire)
- v1.0 showrunner §1–§5: local-LLM director (Ollama; prefers largest model — Bill has
  qwen2.5:32b/7b/3b), news→story, drag residents + directives, Regulator sweeps
- v1.1 §6: one episode per day, three acts, pinned episode line, matinee keys
  (`shift+d` tick now, hold `shift+f` 30×) + Fable's review rulings applied
- v1.2 §7–§9: fear/avoidance + nosy probing Regulator; perplexity = model researcher
  (census already logged deepseek/qwen/kimi); local wire relay in `server.py`
  (built, secure, currently idle — mistral/x.ai/deepseek expose no readable JSON; honest
  "human page only" fallback stands). Server now starts via `run_local_server.command` → `server.py`.
- Jul 6 (Fable session): **§10 discussed and RULED** — two-tier Continuum integration,
  rulings appended to DIRECTOR_SPEC.md ("§10 review rulings"). The reasoning project was
  read from source; Fable's external review + rev 1 amendments live in THAT repo
  (`/Users/bill/Projects/continuum/docs/EXTERNAL_REVIEW_FABLE5_V0_7_0_ALPHA_1.md`).
  Cross-project roles settled: Claude Code (Opus) builds Continuum — it has its own
  HANDOFF.md; GPT Codex is its read-only checker; Bill's GPT 5.5 Pro chat is strategy
  partner only. The two projects connect ONLY through committed files (journal export +
  local bridge per the rulings) — never shared code, never shared sessions.

## Open threads (in priority order)

1. **Bill plays §6–§9** — http://localhost:8787 after `./run_local_server.command`.
   Judge: nervous residents around the Regulator, probing inspections, census section in a
   wire chip's detail panel, the day's episode line advancing act i → iii.
2. **§10 Tier 1 build (Opus session):** journal ring buffer + judge pass + "download
   journal" / "export for continuum" links, exactly per the §10 review rulings in
   DIRECTOR_SPEC.md. Tier 2 (live wake/outcome loop + server.py bridge) is ruled but
   GATED: build only after Tier 1 ships and Bill runs Continuum's Mind Console locally.
3. Backlog ideas, unscheduled: GitHub Pages deploy; desktop/menu-bar wrap; visiting mascots
   from recurring census labs.

## Working protocol (Bill's rules)

- **One session at a time.** Close the rest. The repo is the memory; chats are disposable.
- **Opus 4.8 builds** from the spec (cheap). **Fable judges** taste and big pivots (expensive —
  Bill's weekly cap resets Jul 11; he was at ~16% on Jul 5. Fable only for reviews/direction).
- Always: commit per coherent piece with `Co-Authored-By: Claude <model> <noreply@anthropic.com>`,
  push to origin, keep the working tree clean at session end. Update this file when state changes.
- Style law: Swiss + blocky (CHARACTERS.md). Fact/fiction line: facts linked, theater labeled.
  The LLM directs, the engine performs. Pacing law: stillness default, ≤2 walkers.
  No neon / new visual elements without asking Bill first.

## Environment gotchas

- No `node`, no `gh`. Syntax-check: `osascript -l JavaScript world.js`
  (a `ReferenceError: Can't find variable: document` means it parsed fine).
- Port 8787 often held by another session's preview server — add a temp config on a free port.
- Preview tab hidden = `requestAnimationFrame` paused: drive tests via eval with
  `for(...) update(1/60); draw();` loops (see git history) or the headless JXA harness.
- Ollama at localhost:11434 works from the browser (CORS ok). qwen JSON needs `num_predict`
  headroom + the in-prompt example already in `DIRECTOR_SYS` — extend, never rewrite it.
- GitHub: account Bill-Viking, HTTPS credential in macOS keychain (git push just works).

## Paste-prompts for new sessions

**Opus build session:**
> Read continuum/HANDOFF.md and follow it. Then: <the one task>.
> Respect the working protocol and environment gotchas. Commit per piece, push, update HANDOFF.md.

**Fable review session:**
> Read continuum/HANDOFF.md. I want your judgment on: <the thing>.
> Don't build unless I say so; spec approved changes into DIRECTOR_SPEC.md for an Opus session.
