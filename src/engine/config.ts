// Every tunable coaching parameter lives here. See docs/coaching-methods.md for the rule behind each.
// Changing a value here means updating the doc and the fixture tests in the same commit.

export const ENGINE_VERSION = '0.1.0'

export const config = {
  // R1. Effort targets via RIR
  r1: {
    main: { repMin: 3, repMax: 6, rirMin: 1, rirMax: 3, defaultRir: 2 },
    accessory: { repMin: 8, repMax: 12, rirMin: 0, rirMax: 2, defaultRir: 1 },
  },
  // R2. Double progression
  r2: {
    /** A set counts as "at target effort" if logged RIR <= target RIR + this. */
    rirTolerance: 1,
    /** Progress early if every set is this many RIR above target. */
    earlyProgressRirMargin: 2,
    increments: { lowerBarbell: 2.5, upperBarbell: 2.5, upperBarbellSmall: 1.25, dumbbell: 2, machine: 5 },
  },
  // R3. Stall handling
  r3: { consecutiveExposures: 2, resetFraction: 0.1 },
  // R4. Weekly fractional volume per muscle group
  r4: {
    windowDays: 7,
    hardSetMaxRir: 4,
    directWeight: 1,
    indirectWeight: 0.5,
    targetMin: 8,
    targetMax: 16,
  },
  // R5. Pattern recovery
  r5: { minHoursBetweenPattern: 48, minHoursBetweenHeavyPattern: 48 },
  // R6. Estimated 1RM
  r6: { maxRepsForE1rm: 10 },
  // R7. Rep and hold ranges for calisthenics
  r7: { repMin: 5, repMax: 12, holdMinSec: 10, holdMaxSec: 30 },
  // R8. Ladders: where to start without history, and which weighted lift follows a ladder's top step.
  r8: {
    defaultStep: {
      'ladder-push-up': 1,
      'ladder-pull-up': 1,
      'ladder-dip': 1,
      'ladder-l-sit': 1,
      'ladder-front-lever': 0,
      'ladder-pistol': 0,
    } as Record<string, number>,
    /** Pull-ups in a row → pull-up ladder step (from setup). */
    pullUpSteps: [
      { minReps: 0, step: 0 },
      { minReps: 1, step: 1 },
      { minReps: 5, step: 2 },
    ],
    /** A weighted variant is used as the heavy lift only once its ladder's top step is reached. */
    weightedAfterLadder: { 'weighted-pull-up': 'ladder-pull-up', 'weighted-dip': 'ladder-dip' } as Record<string, string>,
  },
  // R9. Single run distance cap (Frandsen 2025)
  r9: { lookbackDays: 30, maxFractionOfLongest: 1.1 },
  // R10. Intensity distribution
  r10: { easyFraction: 0.8, maxHardRunsPerWeek: 1 },
  // R11. Running around strength
  r11: { hoursAfterHeavyLowerBeforeHardRun: 24, hoursAfterHardRunBeforeHeavyLower: 24 },
  // R12. Gaps and returns
  r12: { reduceAfterDays: 10, recalibrateAfterDays: 20, reduceFraction: 0.1 },
  // R13. Readiness
  r13: { lowEnergyMax: 2, volumeReduction: 1 / 3, minRirWhenLow: 2 },
  // R14. Pain monitoring (Silbernagel: up to 5/10 acceptable). Scores above threshold reduce and mark.
  r14: {
    threshold: 5,
    repeatCount: 3,
    repeatWindowDays: 14,
    loadFactor: 0.8,
    setsRemoved: 1,
    /** Which patterns and primary muscles stress each body area. Practical convention. */
    areas: {
      shoulder: { patterns: ['horizontal_push', 'vertical_push', 'vertical_pull'], muscles: ['shoulders'] },
      elbow: { patterns: ['horizontal_push', 'vertical_push', 'vertical_pull', 'horizontal_pull'], muscles: ['biceps', 'triceps'] },
      wrist: { patterns: ['horizontal_push', 'vertical_push'], muscles: [] },
      neck: { patterns: ['vertical_push'], muscles: [] },
      upper_back: { patterns: ['horizontal_pull', 'vertical_pull'], muscles: ['back'] },
      lower_back: { patterns: ['hinge', 'squat'], muscles: [] },
      hip: { patterns: ['hinge', 'squat'], muscles: ['glutes'] },
      knee: { patterns: ['squat'], muscles: ['quads', 'hamstrings'] },
      ankle: { patterns: ['squat'], muscles: ['calves'] },
    } as Record<string, { patterns: string[]; muscles: string[] }>,
  },
  // R15. Calibration
  r15: { weeks: 2, rirMin: 3, rirMax: 4, exposuresToGraduate: 2 },
  // R16. What's most useful today (session focus). Practical convention.
  r16: {
    defaultWeeklyAim: 3,
    /** A strength session this recent makes a due run the better choice. */
    strengthRecentHours: 30,
    welcomeBackDays: 7,
    /** Main patterns get a heavy slot about this often (R4 / Pelland frequency finding). */
    mainExposuresPerWeek: 2,
    lowerMainPatterns: ['squat', 'hinge'] as string[],
    upperMainPatterns: ['horizontal_push', 'vertical_push', 'vertical_pull', 'horizontal_pull'] as string[],
    /** Minutes at or below which a session gets one heavy main lift instead of two. */
    oneMainAtMinutes: 30,
    /** Busy-life cap: at most this many accessories, even when there is time. */
    maxAccessories: 3,
    hardRunMinDaysApart: 7,
    longRunMinDaysApart: 14,
    noRunHistoryCapKm: 3,
  },
  // Session time estimates (for fitting the time budget)
  time: { generalWarmupMin: 5, mainWarmupMin: 3, secPerRep: 4, transitionMin: 1 },

  // Logging defaults (not coaching rules)
  logging: {
    restSec: { main: 180, accessory: 90, hold: 60 },
    workingSets: { main: 3, accessory: 3 },
  },
} as const

export type EngineConfig = typeof config
