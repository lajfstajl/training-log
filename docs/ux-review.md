# UX review: Phase 1 from a user's perspective

Date: 2026-09-28. Method: walked through the app as a brand-new user on an iPhone-sized screen (390×844), starting from empty data. I checked every screen against the brief's product principles, and added iPhone behaviour that the browser cannot show but that is known from how iOS treats web apps.

## The core problem

**The app promises a coach but behaves like a blank notebook.**

The brief's value is: "tell me what to do today, and why". Phase 1 shipped only the logging half. So on first launch:

- the app never asks a single question
- tapping Start training opens a list of 53 exercises, starting with "Advanced tuck front lever"
- the user has to decide which exercises, how many sets, and what load, and then type it all in

That is *more* decisions than a paper notebook, which breaks the "judge simplicity by decisions per set" principle. Most of the issues below come from this one gap. They can't be fully fixed by polishing the logger; the coach has to come first.

## Findings

Severity: **Critical** blocks the core value. **High** causes errors or real friction every session. **Medium** is noticeable friction. **Low** is polish.

### Critical

**C1. No coach and no questions.**

- There is no first-run setup: nothing about goals, experience, where you train, equipment, injuries or running.
- There is no check-in before a session.
- The brief's "Start training → check-in → suggested session" does not exist. Start training creates an empty session.

**C2. No starting numbers.**

- A new exercise shows the target "– kg × 3 @ 2". The why-line says "conservative load" but never says what that load is.
- The Confirm button reads "Enter load" until you type a number.
- Pressing + from empty goes 2.5 kg at a time, so reaching 100 kg takes 40 taps.

**C3. Ghost sessions.**

- Start training immediately creates and starts a session, with the clock running, before anything is chosen.
- Backing out leaves "Session in progress · 0 sets done" on Today, and the Start training button disappears until the empty session is discarded through a hidden menu.

### High

**H1. Entering numbers is hard.**

- Tap-to-type is invisible: the number looks like a label.
- On iPhone, the decimal keyboard has no Done key and covers the set dock.
- The ± steps are too small for big changes, and there is no quick way to jump (for example to last time's weight).

**H2. Jargon and shorthand without explanation.** "@ 2", "RIR", "4+", "e1RM", "hard sets", "Direct sets count 1, indirect 0.5", "Band shows the 8–16 target", "Horizontal pull". Nothing explains RIR ("how many more reps could you have done?"), even though it is tapped on every set.

**H3. Developer notes visible in the app:**

- "Progression rules arrive in Phase 2" (on every exercise)
- "Runs arrive in Phase 4"
- "API key, model and coach profile arrive in Phase 3"
- "Progressions and resets appear here from Phase 2"

**H4. Data can be lost with one tap.** "Remove exercise" and "Delete set" act instantly, with no confirmation or undo, even when sets were already logged. This contradicts "never lose data".

**H5. The rest timer is effectively silent on iPhone.**

- The beep uses web audio, which iOS mutes when the silent switch is on and stops when the screen locks or you switch apps.
- iPhone web apps cannot vibrate. The only signal is on screen.

**H6. The exercise picker is heavy.**

- It is one alphabetical list of 53, including equipment you don't have where you are (it knows nothing of gym, home or outdoors).
- There are no recent or favourite exercises, and search is not focused automatically.
- A stray tap above the sheet closes it.

**H7. The session screen spends space badly.**

- The same targets are shown twice: in the card list and again in the bottom dock.
- The dock takes about 40% of the screen, so on a smaller iPhone only a couple of rows of the plan are visible.
- The disabled Confirm button ("Enter load") is still green and looks tappable.

### Medium

- **M1. Today is noise for a new user.** Ten empty bars full of jargon, and no answer to "what should I do today?".
- **M2. Finish is in the top-right corner, out of thumb reach.** The title "Session · 0 min" carries no useful information.
- **M3. Warm-ups are hidden** in "⋯" menus. Main lifts get no default warm-up.
- **M4. Holds have no timer.** You hold the plank, then type the seconds afterwards.
- **M5. The tab icons are text symbols** (●, ☰, ↗, ⚙). On iPhone, ⚙ may show as a coloured emoji, so the app looks unfinished.
- **M6. Confirmations use the browser's system pop-ups**, which look foreign inside the installed app.
- **M7. Load conventions are unexplained:** dumbbell kg is per dumbbell, and bodyweight "added kg" can be negative for assistance.
- **M8. Text is small.** Many labels are 12 px grey, hard to read at arm's length mid-set.
- **M9. Progress is a plain list** (charts are planned for Phase 4).

### Low

- L1. The exercise editor is one very long page.
- L2. There is no way to edit locations or their equipment yet.
- L3. The Settings "Coach" section is a placeholder.

## What works and should be kept

- Resume after a crash or reload is exact, including the rest timer.
- The bottom dock idea (everything for the current set within thumb reach) is right. It needs to be leaner.
- Target, previous and actual are visually distinct. The RIR chip comes pre-selected with the target.
- Repeat a past session, and "last time" shown next to each set.
- Export and import with preview.

## Recommendation: make the coach the next step

The engine-first rule means the coach cannot suggest numbers until the engine exists. So the next step should be one **coach slice** that combines the core of Phase 2 and Phase 3, rather than finishing Phase 2 alone. It has three parts: quick fixes, a first-run setup, and a session check-in that produces a plan.

### Step 1: quick fixes (small, do first) — ✅ done 2026-09-28

Done:

- **C3 fixed:** Start opens the picker first, and the session is created on the first pick. Leftover empty sessions are cleaned up.
- **H1 fixed:** the on-screen number pad has big keys, Done, ± for assisted, and shortcuts (target, last time, previous set).
- **H2 partly fixed:**
  - "@ 2" is now "· 2 left"
  - the effort row is labelled "Reps left"
  - first-time exercises say "pick a weight you could lift about 5 times, and do 3"
  - the Today volume text is in plain words and hidden until there is data
- **H3 fixed:** no developer text is left in the app.
- **H4 fixed:** an in-app confirmation appears before deleting logged sets, exercises or sessions. There is no undo toast yet.
- **H6 partly fixed:** the picker shows Recent and Main lifts first. There is no location filter yet; that needs the coach setup.
- **H7 partly fixed:** a disabled button is now grey.
- **M5 fixed:** SVG tab icons.
- **M6 fixed:** no more browser pop-ups.
- **Every sheet** has a visible ✕ close button.

Still open:

- H5 (rest alert on iPhone)
- the slimmer dock (H7)
- M2, M3, M4, M7, M8

Original list:

- **C3:** create the session only when the first exercise is added. Otherwise discard it automatically.
- **H3:** remove all phase and developer text.
- **H4:** confirm before removing logged work, and add an "Undo" toast.
- **H1:** a large number pad sheet with a Done key, plus +/− buttons and "same as last" shortcuts.
- **H7:** a clearer disabled state, and a slimmer dock.
- **M5:** proper icons.
- **H2:** a one-line "RIR = reps you had left" hint, and plain-language labels.

### Step 2: coach onboarding (first launch, about 1 minute)

Short questions in a coach-style conversation. Each question is a message from the coach, and the answers are big tappable chips, so it works offline and is fast:

1. **Goal.** Prefilled: strength first, with running and calisthenics supporting. Confirm or adjust.
2. **Where you train, and the equipment there.** Gym / Home / Outdoors, with equipment chips.
3. **Sessions per week and typical time.**
4. **Current working weights for the main lifts,** or "not sure". "Not sure" starts calibration (R15). Answers fix C2.
5. **Injuries or movements to avoid.**
6. **Running:** longest run in the last month and typical weekly km.
7. **Optional free text:** "Anything else I should know?" The AI turns this into constraints (for example "no overhead pressing"), never into numbers.

### Step 3: session check-in and plan

The five one-tap questions from the brief:

- what to train
- time
- energy
- pain
- location

Then:

1. The **engine** builds the candidate list (R1, R2, R4, R5, R12–R15).
2. The **AI** picks and orders from it and explains why in 2–3 sentences.
3. A preview offers start, swap and regenerate.
4. If the AI fails or there is no connection, the engine builds the session itself.

This removes C1, C2 and most of H6 at once: you mostly log a plan instead of building one.

### Later

The Phase 4 items (runs, charts), the hold timer (M4), and the remaining Medium and Low items.
