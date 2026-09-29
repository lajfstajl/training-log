# Project context: Training Log

This is the running record of the project: what was decided, what was built, what went wrong and what comes next. It is **read at the start of every new chat** (see `CLAUDE.md`) and **updated at the end of every working session**. Newest status first. Keep it factual.

Last updated: 2026-09-28 (end of the Phase 1 session).

---

## 1. Current status (read this first)

- **Phase 1 (logging core) is built, deployed and installed** on the owner's phone from https://lajfstajl.github.io/training-log/
- **The owner reports serious usability issues on the phone** and stressed that the app **needs an AI coach that asks a few questions to begin with.**
  - A full UX review was done on 2026-09-28: see `docs/ux-review.md`.
  - Main finding: the app promises a coach but behaves like a blank notebook. There are no questions, no starting numbers, and 53 exercises to choose from.
- **Coach slice approved by the owner (2026-09-28):**
  1. Quick fixes: **✅ done and deployed**. See `docs/ux-review.md` Step 1 for the list.
  2. Coach onboarding questions (first launch): **✅ done (step B)**.
  3. Session check-in, with the engine building the plan: **✅ done (step C)**.
  4. The AI layer (step D): **✅ done**.
     - Settings → AI coach: API key, model, Test connection.
     - The AI picks, orders and explains from the engine's candidates. It answers with ids and a rationale only; the rationale may not state loads.
     - Validation, then one retry with feedback, then the engine's plan with a note.
     - The Preview "Change" sheet has "Tell the coach" free text.
     - Verified in the browser: a fake key gives a clear "key not accepted" message, and the check-in falls back to the engine's plan.
     - **2026-09-29:** the owner confirmed on the phone, with their own key, that the AI coach works.
  - **Next:** collect the owner's feedback from real sessions. Then the Phase 3 items: Garmin paste parsing, progress charts, backup reminder.
  - Deferred from the plan: turning the setup "anything else" note into suggested avoid-chips via AI. The note is passed to the AI as context instead.
  - **Plan approved 2026-09-28**, with build steps A (engine plus fixtures), B (onboarding, profile, runs), C (check-in and preview, engine only), and D (AI layer).
  - The full plan is in the Claude plan file. The key design points are recorded in section 4 below.
  - The owner's direction on the plan:
    - it is loose and history-driven, not a schedule
    - it adapts to days off and a busy life
    - the daily check-in starts with a recommendation but allows deviations (for example a run instead of strength)
- Phase 2 (progression engine) has **not** started.
- All 26 tests pass. Typecheck is clean. The GitHub Actions deploy is green.

## 2. About the owner

Personal preferences (how to explain things, who the owner is) are in `context.private.md`, which is kept on the owner's PC only (gitignored). Read it too if it exists. This repository is public: keep personal details out of tracked files.

## 3. What the app is

Personal training log PWA: strength (priority), calisthenics and running.

- A **rules engine in code** sets every number, with cited evidence.
- The **AI (Claude API)** only selects, orders and explains, and is validated with zod.
- Local first (IndexedDB via Dexie). No backend, no accounts.

The full product brief is summarised in `CLAUDE.md` (principles, decisions table, conventions). The coaching rules R1–R15 with sources are in `docs/coaching-methods.md`.

Phases:

1. Logging core ✅
2. Progression engine: R1–R8, R12–R15, calibration, fixture tests, events log
3. Coach: profile, locations, check-in, candidate list, AI selection with strict validation, fallback selector, preview with swap and regenerate
4. Running (Garmin paste parsing, manual runs, R9–R11), progress charts, backup reminder
5. Only if asked: TCX/GPX, body weight, plate calculator, supersets

## 4. Decisions made (with dates)

| Date | Decision | Why |
|---|---|---|
| 2026-09-28 | Project lives in `the project folder` | Separate from the unrelated job-search-ai project. |
| 2026-09-28 | Git + GitHub Pages (GitHub Actions) | HTTPS is needed for iPhone install and offline use. Free. |
| 2026-09-28 | R14 pain threshold **5/10** (not 3/10 as in the brief) | Matches the Silbernagel 2007 source. |
| 2026-09-28 | Stack: React 19, TypeScript 7, Vite 8, Tailwind 4, vite-plugin-pwa, Dexie 4, zod 4, Vitest 5 | The brief's proposal. No router library (hash routing), no charts until Phase 4. |
| 2026-09-28 | Added an "isolation" movement pattern | Curls and raises don't fit the brief's 8 patterns. |
| 2026-09-28 | Import (with preview) pulled into Phase 1 | Makes export trustworthy. |
| 2026-09-28 | Set dock at the bottom of the session screen holds all inputs for the current set | "One hand, primary actions in the bottom third." |
| 2026-09-28 | **Next is the "coach slice":** quick fixes → coach onboarding → check-in with an engine-built plan and an AI explanation | The UX review found the missing coach is the core problem. This replaces "finish Phase 2 first". |
| 2026-09-28 | Onboarding style: **coach messages with big tap-answer chips**, plus an optional free-text note that the AI turns into constraints (never numbers) | Fast, works offline, reliable. |
| 2026-09-28 | Starting loads: **ask** for the recent working weight and reps of the main lifts, with a "not sure" option that falls back to R15 calibration | Avoids "– kg" and guessing. |
| 2026-09-28 | **Full-body strength sessions**, rotating 2 heavy main lifts (1 lower + 1 upper) by what is most due | Robust to irregular days. Hits each main pattern about 2×/week (Pelland: frequency helps strength). |
| 2026-09-28 | Simple **manual run logging** is part of the coach slice | Needed so "run instead" works. Garmin paste comes later. |
| 2026-09-28 | Weekly aim is **asked in setup** (2/3/4/varies) and is a soft aim, never a schedule | Busy lifestyle. |
| 2026-09-28 | The AI returns **only candidate ids, order and rationale**. Targets are copied from the engine by id. | The AI cannot change a number by construction. |
| 2026-09-28 | Default AI model `claude-opus-5`, changeable in Settings | Per current API guidance. About 2–4 US cents per check-in. |

## 5. Source verification (done 2026-09-28)

All details are in `docs/coaching-methods.md`. Key corrections and flags:

- **Silbernagel 2007:** the model allows pain ≤ 5/10, not 3/10. It is an Achilles tendinopathy rehab study, so using it for other areas is an extrapolation.
- **Pelland 2026:** fractional counting (indirect = 0.5) fit best, with diminishing returns (steeper for strength). **It gives no set range, so 8–16 is convention.** Frequency helps strength but not hypertrophy, so a Phase 2 proposal is about 2 exposures a week per main-lift pattern.
- **Robinson 2024:** proximity to failure matters for hypertrophy, barely for strength. "Never program failure on heavy lifts" is convention.
- **Frandsen 2025:** accurate. Observational, so moderate evidence.
- **Seiler 2010:** elite athletes. Recreational evidence is thinner.
- **R11:** now cites Schumann et al. 2022, *Sports Med* 52(3):601–612. There is no interference with hypertrophy or maximal strength. Explosive strength is blunted only within the same session.
- **Helms 2016 and Schoenfeld 2017:** accurate.

## 6. What was built in Phase 1

- **Session screen:** stacked exercise cards, plus a bottom **set dock** holding:
  - kg/reps (or seconds) steppers with tap-to-type
  - RIR chips 0 1 2 3 4+, pre-filled with the target
  - a Confirm button
- **Rest timer:** sticky, with −15 s, +15 s and Skip. It is stored as a timestamp, so it survives a killed app.
- **Other session features:** wake lock, and a beep at the end of rest (foreground only).
- **Pre-fill:** from the last finished session ("Same as last time"), or the bottom of the range with an empty load when there is no history. Load carries forward from the previous confirmed set.
- **Session management:** finish summary (duration, volume, sets, PRs, "How did that feel?"), resume banner, discard session.
- **History:** grouped by ISO week with a type filter. Session detail shows planned and actual. Repeat, edit and delete.
- **Progress tab:** best set and e1RM per exercise. A placeholder until Phase 4.
- **Settings:**
  - exercise library editor (every field, archive)
  - JSON export and import with preview (the API key is never exported)
  - coaching methods viewer
- **Seed data:** 53 exercises, 6 ladders (push-up, pull-up, dip, L-sit, front lever, pistol) and 3 locations (Gym, Home, Outdoors).
- **Engine so far:**
  - `config.ts` with all R1–R15 parameters
  - `epley` (R6)
  - `fractionalVolume` (R4, shown on the Today tab)
- **Tests:** 26 in total, covering Epley, volume, prefill, timer, records, formatting, seed consistency, the session flow, swap and a backup round trip.

## 7. Bugs found and fixed during testing

- **Fast RIR tap then Confirm saved the old RIR.** Fix: `confirmSet` reads values from the DB, not from UI props.
- **Three fast "+" taps added only 1.** Fix: the `Stepper` keeps an optimistic local value.
- **Set 2 of a new exercise didn't carry the load forward.** Fix: `effectiveValues()` falls back to the previous confirmed set's kg.
- **ISO week was off by one** because of daylight saving time. Fix: round to whole days.

## 8. Deployment and how to ship changes

- **Repo:** https://github.com/lajfstajl/training-log (public, code only; data never leaves the phone).
- **Live app:** https://lajfstajl.github.io/training-log/ (installed on the owner's phone via Safari → Share → Add to Home Screen).
- **How to ship:** push to `main`. `.github/workflows/deploy.yml` runs the tests, builds with `BASE_PATH=/training-log/` and deploys.
  - The installed app updates itself on the next open (autoUpdate service worker).
  - Sometimes it needs two opens.
- **Pushing from Claude's shell failed:** "terminal prompts disabled". The sign-in must happen in the owner's terminal.
  - The first push was done by the owner with `git push -u origin main` (a GitHub browser sign-in followed).
  - The repo-local `credential.helper manager` is set and the credential is stored. **Since 2026-09-28, `git push` from Claude's shell works.** If it ever fails with a sign-in error, ask the owner to run the push command above.
- **First deploy failed** because Pages was not yet set to Source: "GitHub Actions". This is fixed; the owner enabled it and re-ran the job.
- **Checking deploy status without `gh`:** fetch `https://api.github.com/repos/lajfstajl/training-log/actions/runs` (the repo is public).
- **Privacy and security (review of 2026-09-28):**
  - Commits use the repo-local identity `lajfstajl <334991926+lajfstajl@users.noreply.github.com>`. The history was rewritten to remove the personal email, which required a one-time force push.
  - Public files contain no personal details; personal notes live in the gitignored `context.private.md`.
  - The production build sets a Content-Security-Policy: the app may only connect to itself and `api.anthropic.com`.
  - Deploy actions are pinned to commit SHAs, and Dependabot watches npm and actions.
  - Owner to-dos, as of 2026-09-29:
    - ✅ GitHub two-factor authentication
    - ✅ GitHub email privacy settings
    - ✅ Anthropic API key set up
    - Not yet confirmed: turn on Dependabot alerts (repo Settings → Code security).
    - Standing rule: no other GitHub Pages sites on this account. They would share the `lajfstajl.github.io` origin and could read this app's stored data.

## 9. Environment notes (things that bit us)

- **Auto mode:** the file-write safety check failed repeatedly (a server error). The fix was switching the permission mode to "Accept edits".
- **Preview tool:** it is bound to the folder this session started in (job-search-ai), so `preview_start` launches the wrong project.
  - Workaround: run `npm run dev -- --host --port 5173 --strictPort` as a background process and open http://localhost:5173 in the browser pane.
  - `--host` also makes it reachable from the phone on the same wifi, at the "Network" URL Vite prints.
- **Windows:** use PowerShell or Git Bash. Node 24 and npm 11 are installed. `gh` is not installed.
- **Phone testing over wifi (http):** fine for UI checks, but its data is separate from the installed app.

## 10. Open items / next steps

1. **Act on `docs/ux-review.md`** (top priority). The order is quick fixes, then coach onboarding, then check-in and engine plan. Also ask the owner whether they hit anything the review missed.
2. ~~Decide on the commit email~~: done, see section 8.
3. Then Phase 2: the progression engine, with fixture scenarios from the brief:
   - calibration week one
   - top of range leads to a load increase
   - two stalls lead to a reset
   - 14 days off gives a reduced load
   - low energy gives reduced volume
   - shoulder pain 5+ reduces and marks pressing (note that the threshold is now >5)
   - chest at 3 vs back at 14 means chest is prioritised
4. Known limitations:
   - iOS gives no rest alert when the app is in the background.
   - Wake lock needs iOS 18.4 or later.
   - zod makes the bundle 150 kB gzipped (acceptable for now).

## 11. Session log

- **2026-09-28:**
  - Planned Phase 1 and verified sources.
  - Built, tested in the browser and committed Phase 1.
  - Created the GitHub repo `lajfstajl/training-log`, pushed and deployed to Pages.
  - The owner installed the app on the iPhone and reported serious usability issues (not yet detailed).
  - Created this file.
  - Did a UX review as a first-time user (`docs/ux-review.md`). The headline: no coach and no questions. Proposed a "coach slice" as the next step.
  - The owner approved the coach slice, coach-message onboarding with tap answers, and asking for starting weights with a "not sure" option.
  - Shipped the quick fixes: no ghost sessions, number pad, plain language, confirmations, picker Recent/Main lifts, icons, sheet ✕ button. 27 tests.
  - **Coach slice A–C shipped** (engine plus fixtures; setup conversation; check-in with a recommendation and deviations; preview with Swap and Change; run logging; in-session calibration; "Next time" on the finish summary). 54 tests.
  - Product fixes found while testing:
    - **Strength first:** lifting keeps at least half the weekly aim (`liftingShare`).
    - **Busy-life cap:** at most 3 accessories per session.
    - Plain core is preferred over skill holds for the core slot.
    - After confirming a set, the dock stays on the same exercise.
