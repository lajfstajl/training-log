# Training Log: guidance for Claude

## Start of every chat: read `context.md` first

Before doing anything else in a new chat, read `context.md` in the project root, and `context.private.md` if it exists (personal notes, kept off GitHub). It holds:

- the current status
- the decisions made so far, with dates
- what has been built
- known problems and environment quirks
- how to deploy
- the next steps

Then briefly tell the owner what you understand the current status and next step to be, and confirm before starting work.

**At the end of every working session** (or when the owner says they are done), update `context.md`:

- current status
- new decisions, with dates
- what changed
- bugs found or fixed
- open items
- a new line in the session log

Commit the update together with the work.

A personal training log PWA with a coach for strength (priority), calisthenics and running. Single user (the owner), iPhone home screen, local first, no backend.

## The engine-first rule

**The progression engine (`src/engine/`) sets every number. The AI never invents loads, reps, seconds or distances.**

- The AI selects, orders and explains candidates from the engine.
- AI output is validated with zod. Every target must equal the engine's value exactly, or it is rejected, retried once, then replaced by the deterministic fallback selector.
- The only place the AI writes numbers is parsing pasted Garmin text, and the user confirms those.
- The app works without the AI.

`src/engine/` is pure TypeScript with no imports from React, Dexie or the DOM. Every function is unit tested.

**Changing a coaching rule means updating, in the same commit:**

- `docs/coaching-methods.md` (rule, source, evidence grade, defaults, implementing function)
- `src/engine/config.ts` (all parameters live here)
- the fixture tests

## Decisions (from the product interview, plus planning on 2026-09-28)

| Topic | Decision |
|---|---|
| Goal conflicts | Strength first. Running and calisthenics support it. |
| Who sets numbers | Rules engine in code. AI selects, orders, explains. |
| Effort logging | RIR on every working set, one tap (0 1 2 3 4+), pre-filled with the target. |
| Planning horizon | Today only. No weekly program. |
| Frequency | About 3 sessions a week, not fixed. Adapt to gaps and clusters. |
| Running goal | General fitness, aerobic base, no race. |
| Experience | Intermediate in lifting and calisthenics. |
| Cold start | Two calibration weeks with conservative loads. |
| Deloads | None. Per-exercise stall handling (R3 reset) only. |
| Rep ranges | Heavy main lifts (3–6), moderate accessories (8–12). |
| Pain | Soft flag. Threshold **5/10** (Silbernagel source value, not the brief's 3/10). |
| Hosting | GitHub Pages via Actions. Hash routing. |

## Product principles

- Every number has a reason: a one-line "why" naming the rule.
- The coach tailors, the user decides. Everything is editable, and nothing ever blocks logging what was actually done.
- Check-in in under 15 seconds.
- Judge simplicity by decisions per set.
- One hand, sweaty thumb: tap targets ≥ 48 px, primary actions in the bottom third (the set dock).
- During a session show only: current exercise, set, target, last time, rest timer.
- Pre-fill but never auto-confirm. A set counts only when Confirm is tapped (`completedAt` set).
- Three kinds of numbers, visibly different:
  - target: `text-target`, outlined `TargetPill`
  - previous: `text-muted`, prefixed "last"
  - actual: bold `text-ink`
- Never lose data. Every tap writes to IndexedDB immediately, and the app resumes after a crash.
- No accounts, no social, no gamification. Metric only.

## Privacy

This repository is public. Never put personal details (names, email addresses, local paths with a name, health or training data) in tracked files. Commits use the GitHub noreply address set in the repo-local git config. Personal notes go in `context.private.md` (gitignored).

## Conventions

- **Data flow:** UI reads with `useLiveQuery`, and all writes go through `src/db/repo.ts`.
  - `confirmSet` reads values from the DB, not from UI state, so fast taps cannot confirm stale values.
  - The `Stepper` keeps an optimistic local value for the same reason.
- **Targets vs actuals:** `target*` fields on a set are never overwritten by input. Actual fields stay undefined until edited or confirmed. The "shown" value is resolved by `effectiveValues` in `src/lib/prefill.ts`.
- **kg meaning:** on `weight_reps`, kg is the load. On bodyweight and holds, kg is added load (negative means assisted). Dumbbell loads are per dumbbell.
- **Rest timer:** stored as `restEndsAt` on the session. The display is computed from `Date.now()`.
- **IDs and schema:**
  - IDs come from `crypto.randomUUID()`, except seed exercises, which have stable slug ids.
  - Bump `SCHEMA_VERSION` in `src/db/schema.ts` and add a Dexie `version(n).upgrade()` for any schema change.
- **Backups:** the API key is never exported.
- **Style:** Tailwind with the theme tokens in `src/index.css`. Dark by default, system font, no decorative imagery.
- **Dependencies:** few. Ask before adding one.
- **Tests:** Vitest with fake-indexeddb. Run `npm test` and `npm run typecheck` before each commit.
- **Commits:** commit after each working step, with a clear message.
- **Unclear product decisions:** offer two options with a recommendation instead of guessing.

## Layout

- `src/engine/`: types, config, pure rules (e1RM, volume, and progression from Phase 2)
- `src/db/`: Dexie schema, seed (53 exercises, 6 ladders, 3 locations), repo, backup
- `src/lib/`: pure helpers (prefill, records, timer, format) and device APIs (wake lock, beep)
- `src/features/`: screens (today, session, history, progress, library, settings)
- `src/ui/`: shared components
- `docs/coaching-methods.md`: the rules and their evidence

## Phases

1. Logging core (done)
2. Coach slice (done):
   - engine R1–R16 with fixtures (`src/engine/`, `tests/fixtures/`)
   - setup conversation, check-in with recommendation and deviations, preview, manual runs
   - AI layer (`src/coach/`): the AI returns candidate ids and a rationale only, validated, with the engine as fallback
3. Next: Garmin paste parsing, progress charts, backup reminder, import polish
4. Only if asked

## Coach flow (where things live)

1. Setup: `features/coach/Onboarding.tsx` → profile in the settings table (`db/profile.ts`).
2. Check-in: `features/coach/Checkin.tsx` → `planToday` → `coach/run.ts` (the AI or the engine) → stored check-in, candidates and suggestion (`db/coach.ts`).
3. Preview: `features/coach/Preview.tsx` → `startSessionFromPlan`. The AI model and key are in settings (`apiKey` is never exported).

## Running

- `npm run dev`
- `npm test`
- `npm run build`

The preview tool in this environment may be bound to another project. If it is, run `npm run dev -- --port 5173` as a background process and open that URL.
