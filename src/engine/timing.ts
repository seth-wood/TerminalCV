/** Per-command typewriter delays, preserved verbatim from index.js. */
export const DELAYS = {
  resume: 2,
  projects: 5,
  about: 5,
  /** writeText's default, used for help / empty / unknown / the boot sequence. */
  default: 5,
} as const;

export const DEFAULT_TYPE_DELAY_MS = DELAYS.default;
