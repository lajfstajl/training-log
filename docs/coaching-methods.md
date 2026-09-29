# Coaching methods

Every number the app suggests comes from one of the rules below. Each rule lists what it does, where it comes from, how strong the evidence is, its default parameters (all in `src/engine/config.ts`) and the function that implements it.

**Evidence grades**

- **Strong**: meta-analyses or several consistent controlled studies directly on the question.
- **Moderate**: a large observational study, or research that supports the direction but not the exact number.
- **Practical convention**: common coaching practice. Sensible, but the specific rule or threshold has not been tested.

Changing a rule means updating this document, `config.ts` and the fixture tests in the same commit.

Sources were checked on 2026-09-28. Where the original brief misrepresented a source, the correction is noted under the rule.

## Summary

| Rule | What it does | Evidence | Status |
|---|---|---|---|
| R1 | RIR effort targets | Moderate | `targetRirFor` (progression.ts) |
| R2 | Double progression | Practical convention | `nextTarget` (progression.ts) |
| R3 | Stall handling ("reset") | Practical convention | `nextTarget` |
| R4 | Weekly fractional volume | Moderate (counting), convention (range) | `fractionalVolume`, `deficitScore`, `selectSession` |
| R5 | Pattern recovery and heavy rotation | Convention, with a moderate frequency note | `chooseMainPatterns` (focus.ts), candidate scoring |
| R6 | Estimated 1RM (Epley) | Practical convention | `epley`, `estimateMax`, `loadFor` (e1rm.ts) |
| R7 | Rep and hold double progression | Practical convention | `nextTarget` |
| R8 | Progression ladders | Practical convention | `nextTarget` + ladder steps in `buildCandidates` |
| R9 | Single run distance cap | Moderate | `suggestRun` (run.ts) |
| R10 | Easy/hard running split | Moderate | `pickRunType` (focus.ts), `suggestRun` |
| R11 | Running around strength | Moderate (compatibility), convention (timing) | `recommendFocus`, `pickRunType`, `suggestRun` |
| R12 | Gaps and returns | Practical convention | `nextTarget`, `recommendFocus` |
| R13 | Readiness from check-in | Practical convention | `buildCandidates` (candidates.ts) |
| R14 | Pain soft flag | Moderate (in its original setting), extrapolated here | `buildCandidates` |
| R15 | Calibration | Practical convention | `nextTarget`, `nextSetLoad` |
| R16 | What's most useful today | Practical convention | `recommendFocus` (focus.ts) |

All engine code is in `src/engine/`. The entry point for the app is `planToday` in `plan.ts`: recommendation, then candidates, then a session or a run. The scenario fixtures are in `tests/fixtures/engine-fixtures.test.ts`.

## Strength training

### R1. Effort target via reps in reserve (RIR)

**Rule.** Every working set has a target RIR.

- Main lifts (squat, bench, deadlift, overhead press, weighted pull-up, weighted dip): 3 to 6 reps at RIR 1 to 3. Failure is never programmed on heavy compound lifts.
- Accessories and bodyweight rep work: 8 to 12 reps at RIR 0 to 2.

RIR is logged with one tap as 0, 1, 2, 3 or 4+, pre-filled with the target.

**Sources.**

- Robinson ZP et al. Exploring the dose-response relationship between estimated resistance training proximity to failure, strength gain, and muscle hypertrophy: a series of meta-regressions. *Sports Med.* 2024. doi:10.1007/s40279-024-02069-2. Hypertrophy increased as sets were taken closer to failure. **Strength gains showed negligible differences across proximity to failure.**
- Helms ER, Cronin J, Storey A, Zourdos MC. Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training. *Strength Cond J.* 2016;38(4):42–49. Describes the RIR scale. RIR estimates are more accurate close to failure and improve with training experience.
- Schoenfeld BJ et al. Strength and hypertrophy adaptations between low- vs. high-load resistance training: a systematic review and meta-analysis. *J Strength Cond Res.* 2017 (PMID 28834797). 1RM gains are greater with heavy loads, while hypertrophy is similar across load ranges. This supports "heavy main lifts, moderate accessories".

**Evidence.** Moderate. The direction is well supported. The specific ranges (3–6 at RIR 1–3, 8–12 at RIR 0–2) are practical convention.

**Notes on the brief.**

- Robinson 2024 does not show that failure is harmful on heavy lifts. "Never program failure on heavy compounds" is a fatigue and safety convention.
- The paper does support not needing failure for strength.
- Because RIR estimates are least accurate far from failure, "4+" is a single bucket.

**Defaults.** `config.r1.main` = 3–6 reps, RIR 1–3, default 2. `config.r1.accessory` = 8–12 reps, RIR 0–2, default 1.

**Implemented by.** `targetRirFor` in `src/engine/progression.ts` (main lifts clamped to RIR 1–3). Defaults per exercise in `src/db/seed.ts`.

### R2. Double progression

**Rule.** Each exercise has a rep range. Keep the load until every working set reaches the top of the range at target effort (logged RIR ≤ target RIR + 1). Then add the exercise's increment and restart at the bottom of the range. If every set is logged at 2 or more RIR above target, progress before reaching the top of the range.

**Source.** Standard coaching practice. There is no controlled trial of this exact rule.

**Evidence.** Practical convention.

**Defaults.** `config.r2`: RIR tolerance 1, early-progress margin 2. Increments: 2.5 kg lower-body barbell, 2.5 or 1.25 kg upper-body barbell, 2 kg dumbbells (per dumbbell), 5 kg machines and cables. Configurable per exercise.

**Implemented by.** `nextTarget` in `src/engine/progression.ts`. Fixtures 2 and "same weight until the top of the range".

### R3. Stall handling (replaces deloads)

**Rule.** Reduce load by about 10% and rebuild with R2 when either of these holds on two consecutive exposures:

- reps fall below the bottom of the range, or
- logged RIR is below target.

This is shown as a "reset", not a failure. There are no scheduled or reactive deload weeks (a product decision).

**Evidence.** Practical convention.

**Defaults.** `config.r3`: 2 consecutive exposures, 10% reduction.

**Implemented by.** `nextTarget`. Only applies when there is load to reduce; bodyweight work without added load keeps its level (ladders handle it via R8). Fixture 3.

### R4. Weekly volume per muscle group

**Rule.**

- Count hard sets (confirmed working sets at RIR ≤ 4) per muscle group over a rolling 7 days.
- Direct (primary muscle) sets count 1, and indirect (secondary muscle) sets count 0.5.
- Target 8 to 16 fractional sets per muscle per week.
- When choosing exercises, prioritise the muscles furthest below the range.

**Source.** Pelland JC et al. The resistance training dose response: meta-regressions exploring the effects of weekly volume and frequency on muscle hypertrophy and strength gains. *Sports Med.* 2026;56(2):481–505. doi:10.1007/s40279-025-02344-w. 67 studies, 2,058 participants.

- **Fractional counting (indirect = 0.5) fit best**, compared with counting indirect sets fully or not at all.
- Both hypertrophy and strength rise with volume, with diminishing returns. The returns diminish much faster for strength.
- **Frequency:** more sessions per week clearly helped strength (with diminishing returns), but made little difference to hypertrophy.

**Evidence.** Moderate for the counting method and the diminishing returns. **The 8–16 range is practical convention:** the paper gives no prescriptive set range.

**Notes on the brief.**

- The frequency finding matters for a strength-first goal. Hitting each main lift pattern about twice a week is likely more useful for strength than extra volume. This is proposed as an addition to R5 in Phase 2.
- Implementation detail: the app stores RIR "4+" as 4, so a 4+ set counts as hard. A set with no logged RIR also counts.

**Defaults.** `config.r4`: 7-day window, hard set RIR ≤ 4, weights 1 and 0.5, target 8–16.

**Implemented by.** `fractionalVolume` in `src/engine/volume.ts` (Today tab), `deficitScore` in `candidates.ts`, and `selectSession` in `select.ts`, which fills accessories by the largest projected gap and never lets an accessory push a muscle past the weekly maximum. Fixture 9.

### R5. Frequency and recovery by pattern

**Rule.** The patterns are squat, hinge, horizontal push, vertical push, horizontal pull, vertical pull, core, skill, plus "isolation" for single-joint accessories.

- Prefer patterns not trained in the last 48 hours.
- Never repeat a heavy main-lift pattern within 48 hours, when it can be avoided.
- **Heavy rotation (added 2026-09-28):** every strength session is full body with two heavy slots: one lower (squat or hinge) and one upper (a push or a pull). Each slot goes to the pattern whose last heavy session is longest ago. At about 3 sessions a week, each main pattern gets a heavy slot roughly twice a week. At 30 minutes or less there is one heavy slot. The other main lifts rest that day.

**Evidence.** Practical convention. The rotation is motivated by Pelland et al. 2026, where training frequency clearly helped strength gains (moderate evidence). The exact rotation is a coaching choice, picked because it holds up when training days are irregular (owner's decision, 2026-09-28).

**Defaults.** `config.r5`: 48 h. `config.r16`: `lowerMainPatterns`, `upperMainPatterns`, `oneMainAtMinutes` 30.

**Implemented by.** `chooseMainPatterns` in `src/engine/focus.ts`, plus the R5 penalty in `buildCandidates`. Fixture "heavy patterns rotate".

### R6. Estimated 1RM

**Rule.** Epley: e1RM = kg × (1 + reps / 30), computed only from sets of 10 reps or fewer. Used for trends, PRs and converting targets between rep counts. It is never presented as a tested max.

**Evidence.** Practical convention. Rep-max equations lose accuracy as reps rise, which is the reason for the 10-rep cap.

**Defaults.** `config.r6.maxRepsForE1rm` = 10.

**Implemented by.** `epley` in `src/engine/e1rm.ts` (tested). Used for PRs in `src/lib/records.ts`.

## Calisthenics

### R7. Rep and hold double progression

**Rule.** Same logic as R2.

- Rep work uses 5 to 12 reps.
- Holds build seconds within a range, for example 10 to 30 s.
- When all sets reach the top of the range at target effort, either move to the next ladder step or add external load, per the exercise's setting.

**Evidence.** Practical convention.

**Defaults.** `config.r7`: reps 5–12, holds 10–30 s. Some seeded exercises use their own range, for example plank 30–60 s.

**Implemented by.** `nextTarget` (holds build 5 s per step; load-mode exercises add their increment at the top of the range).

### R8. Progression ladders

**Rule.** A ladder is an ordered list of variations, each with its own range. Moving up a step starts at the bottom of the new step's range. If the bottom of the range cannot be reached on the new step, go back one step and flag it.

**Seeded ladders.**

- Push-up: incline, standard, decline, archer
- Pull-up: negative, band-assisted, strict (then weighted)
- Dip: band-assisted, bar, ring
- L-sit: foot-supported, tuck, full
- Front lever: tuck, advanced tuck, one-leg, straddle
- Pistol squat: box, assisted, full

**Evidence.** Practical convention.

**Implemented by.** Ladders are seeded in `src/db/seed.ts`. The current step is chosen in `buildCandidates` (latest trained step, or `config.r8.defaultStep`; the pull-up ladder uses the setup answer). Stepping up and down is in `nextTarget`. Weighted pull-ups and dips become the heavy lift only once the ladder top step has been reached (`config.r8.weightedAfterLadder`).

**Location (added 2026-09-29).** Exercises can list alternative equipment (`equipmentAlt`), for example rings instead of a pull-up bar for pull-ups, leg raises, dead hangs and front levers, or rings instead of dip bars for L-sits. If the current ladder step can't be done at the chosen location, the nearest step that can be done is used, easier steps first. For example, at a rings-only home the band-assisted pull-up becomes negative pull-ups, and bar dips become ring dips. Practical convention.

## Running

### R9. Single run distance cap

**Rule.** No suggested run may exceed 110% of the longest run in the last 30 days. This replaces the "10% per week" rule.

**Source.** Frandsen JSB et al. How much running is too much? Identifying high-risk running sessions in a 5200-person cohort study. *Br J Sports Med.* 2025. 5,205 runners on Garmin devices, 588,071 sessions, 1,820 injured.

- Relative to runs no longer than the 30-day longest, or at most 10% longer, overuse injury rates rose for:
  - small spikes (10–30% longer): hazard rate ratio 1.64
  - moderate spikes (30–100%): 1.52
  - large spikes (>100%): 2.28
- The week-to-week distance ratio showed no relationship with injury.

**Evidence.** Moderate. It is a large prospective cohort, but observational: it shows association, not cause.

**Defaults.** `config.r9`: 30-day lookback, cap 1.10.

**Implemented by.** `suggestRun` in `src/engine/run.ts`. Fixture 7.

### R10. Intensity distribution

**Rule.** For general fitness, most running is easy: about 80% of running time at conversational effort (RPE 3–4, or heart rate zone 2 if zones are set). At most one harder session a week (tempo, intervals or strides).

**Source.** Seiler S. What is best practice for training intensity and duration distribution in endurance athletes? *Int J Sports Physiol Perform.* 2010 (PMID 20861519).

**Evidence.** Moderate.

**Notes on the brief.**

- Seiler describes elite endurance athletes. Evidence in recreational runners is thinner, from a few trials such as Esteve-Lanao 2005 and Muñoz 2014.
- At about one run a week the 80% split rarely binds. The practical effect is "mostly easy, at most one hard run".

**Defaults.** `config.r10`: easy fraction 0.8, at most 1 hard run a week.

**Implemented by.** `pickRunType` in `src/engine/focus.ts` and `suggestRun`.

### R11. Running around strength

**Rule.** Strength has priority.

- Avoid suggesting a hard run within about 24 hours after a heavy lower-body session.
- Avoid heavy lower body the day after a hard or long run.

**Source.** Schumann M et al. Compatibility of concurrent aerobic and strength training for skeletal muscle size and function: an updated systematic review and meta-analysis. *Sports Med.* 2022;52(3):601–612. doi:10.1007/s40279-021-01587-7.

- Concurrent training did not blunt hypertrophy or maximal strength.
- Explosive strength was blunted, mainly when both were done in the same session. With sessions separated by 3 hours or more there was no significant interference.
- Running and cycling did not differ.

**Evidence.** Moderate that combining running and lifting is compatible. **The 24-hour spacing is practical convention**, aimed at fatigue and session quality rather than long-term interference.

**Defaults.** `config.r11`: 24 h both ways.

**Implemented by.** `recommendFocus` (a hard or long run within 24 h means no heavy legs), `pickRunType` and `suggestRun` (heavy legs within 24 h means the run stays easy). "Within 24 h" is inclusive. Fixture 8 and "a hard run yesterday".

## Across all training

### R12. Gaps and returns

**Rule.** The app adapts to when training actually happens.

- After 10 to 20 days without training a pattern, reduce load by about 10%.
- After more than 20 days, treat it as a short recalibration (R15).

**Evidence.** Practical convention.

**Defaults.** `config.r12`: 10 and 20 days, 10% reduction.

**Implemented by.** `nextTarget` (per exercise: 10–20 days gives about 10% lighter; more than 20 days means recalibrate) and `recommendFocus` (more than 7 days off gives a welcome-back full-body session). Fixture 4.

### R13. Readiness from the check-in

**Rule.** Low energy (1 or 2 of 5) reduces volume by about a third and caps effort at RIR 2 or higher. It never increases targets.

**Evidence.** Practical convention.

**Defaults.** `config.r13`: energy ≤ 2, −1/3 volume, RIR ≥ 2.

**Implemented by.** `buildCandidates` in `src/engine/candidates.ts`. Fixture 5.

### R14. Pain (soft flag)

**Rule.** Pain is rated 0–10 per body area at check-in.

- If an area is **above 5/10**, the engine reduces load or volume for the patterns that stress it and marks them. The preview says so, and the user can override.
- If pain above 5 is reported for the same area in 3 sessions within 14 days, show a short, non-blocking note suggesting a physiotherapist.
- The coach never diagnoses.

**Source.** Silbernagel KG, Thomeé R, Eriksson BI, Karlsson J. Continued sports activity, using a pain-monitoring model, during rehabilitation in patients with Achilles tendinopathy: a randomized controlled study. *Am J Sports Med.* 2007;35(6):897–906.

- The model allows pain up to 5/10 during and after activity, provided it settles by the next morning and does not rise week to week.
- Patients who kept running and jumping under this model did as well as those who rested.

**Evidence.** Moderate within Achilles tendinopathy rehab. **Using it for other body areas is an extrapolation.**

**Notes on the brief.**

- **Correction:** the brief used 3/10. The source threshold is 5/10, which was chosen on 2026-09-28.
- The "settles by next morning" part is not captured by a single check-in rating. A later check-in reporting the same area covers it only partly.

**Defaults.** `config.r14`:

- threshold 5 (the reduction applies above 5)
- 3 reports in 14 days trigger the note
- affected exercises get 80% of the load (bodyweight work gets 1 more rep left instead) and 1 set fewer
- areas from setup's "avoid" list exclude the stressing exercises completely

**Implemented by.** `buildCandidates`. Which areas each pattern and muscle stresses is in `config.r14.areas` (practical convention). Fixture 6.

### R15. Calibration weeks (cold start)

**Rule.** Calibration applies for the first two weeks, and whenever an exercise has no history.

- **Strength:** start conservatively at target RIR 3–4. After each set, suggest the next set's load from the logged reps and RIR. After two exposures the exercise switches to R2.
- **Calisthenics:** the first exposure is at a comfortable level, and the engine sets the range from what is logged.
- **Running:** easy runs only, sized from the stated recent longest run, with R9 applied.

**Evidence.** Practical convention.

**Defaults.** `config.r15`: 2 weeks, RIR 3–4, 2 exposures.

**Implemented by.** `nextTarget` (start from the setup baseline via `estimateMax` / `loadFor`, rounded down; or an open load) and `nextSetLoad` (in-session suggestion for the next set). Fixtures 1, 1b and "in-session calibration".

### R16. What's most useful today (added 2026-09-28)

**Rule.** There is no schedule. At every check-in the coach reads what was actually done and when, then recommends one focus. The user can always choose something else.

1. **First session ever:** full-body strength (calibration, R15).
2. **More than 7 days since any training:** a "welcome back" full-body strength session, eased per exercise by R12.
3. **Run due:** days since the last run ≥ 7 ÷ runs per week, from setup. Recommend a run if either:
   - lifting was done within the last 30 h, or
   - this week's lifting sessions already meet the lifting share of the weekly aim. **Strength first:** the lifting share is at least half the aim, rounded up (`liftingShare`: max(⌈aim ÷ 2⌉, aim − runs per week)). For example, an aim of 3 with 2 runs wanted keeps 2 lifting sessions, and runs fill the gaps.

   The run type follows R10 and R11:
   - easy by default
   - at most one hard run in 7 days, and only with fresh legs and at least 2 runs a week planned
   - an occasional long run
4. **Otherwise:** full-body strength with the R5 heavy rotation. **The location decides the kind:**
   - With lifting equipment (the gym), the session is strength.
   - Without it (a rings-only home), the session is calisthenics, even if "strength" is chosen.
   - Heavy slots only go to patterns that can be trained heavy at that location (`availableHeavyPatterns`). At home there is no hinge, so the lower-body slot goes to pistol squats.
   - The check-in asks "Where are you?" first and offers only the matching choice.

The weekly aim comes from setup (2, 3, 4, or "it varies", which counts as 3). It is a soft target that only shapes rule 3.

**Evidence.** Practical convention. It combines R5, R9–R12 and the concurrent-training compatibility finding (Schumann 2022) into a daily choice. It was chosen to suit a busy, irregular week.

**Session size.** A strength session has at most 2 heavy lifts, 3 accessories (`maxAccessories`, a busy-life cap) and 1 core exercise, all within the time budget.

**Defaults.** `config.r16`: weekly aim 3, lifting counts as recent within 30 h, welcome-back after 7 days, hard runs at least 7 days apart, long runs at least 14 days apart, and a 3 km cap when there is no run history.

**Implemented by.** `recommendFocus` and `pickRunType` in `src/engine/focus.ts`, and `strengthKind` for the location. Fixtures: "a run is recommended when due", "the user can deviate", "9 days off", "home location".

## Sessions without the coach

A "Free session" (picking exercises yourself) still uses `planFromHistory` in `src/lib/prefill.ts`. It repeats the last exposure or starts at the bottom of the range, and the "why" line says which. Coach-built sessions carry the engine's targets and rule ids.
