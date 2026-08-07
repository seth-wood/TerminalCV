'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * A unit of terminal animation. Jobs run strictly in order, one queue for the
 * whole terminal — which is what makes a second command queue behind a
 * still-typing one instead of interleaving into the same buffer.
 */
export type Job =
  | { kind: 'wait'; ms: number }
  | {
      kind: 'type';
      text: string;
      /** ms per character, matching the old `setTimeout(delay * i)` schedule. */
      delayMs: number;
      onReveal: (revealed: string) => void;
    }
  | { kind: 'effect'; run: () => void }
  /**
   * Holds the queue until something off-queue is ready — used for content that
   * has to be fetched. `ready` is polled once per frame and returns null while
   * pending; the jobs it eventually returns take the gate's place in the queue,
   * so anything queued behind it still runs after it.
   */
  | { kind: 'gate'; ready: () => Job[] | null };

export interface LoopState {
  queue: Job[];
  frame: number | null;
  jobStart: number | null;
  /** Injected so the loop stays DOM-free and testable outside a browser. */
  schedule: (callback: (now: number) => void) => number;
  cancel: (handle: number) => void;
  scroll: () => void;
}

/**
 * One requestAnimationFrame loop, driven by elapsed time.
 *
 * The original scheduled N timeouts at `delay * i` up front; at delay=2 that is
 * a character every ~2ms, but paint is frame-capped, so ~8 characters appear
 * per painted frame. Computing the revealed count from elapsed time reproduces
 * that cadence exactly with a single timer instead of thousands.
 */
export function step(state: LoopState, now: number) {
  state.frame = null;

  // Drain instant jobs, so an effect and the typing it sets up land together.
  while (state.queue.length > 0) {
    const job = state.queue[0];

    if (job.kind === 'effect') {
      state.queue.shift();
      job.run();
      continue;
    }

    if (job.kind === 'gate') {
      const unblocked = job.ready();
      if (unblocked === null) break; // still pending — re-poll next frame
      state.queue.splice(0, 1, ...unblocked);
      continue;
    }

    if (state.jobStart === null) state.jobStart = now;
    const elapsed = now - state.jobStart;

    if (job.kind === 'wait') {
      if (elapsed < job.ms) break;
      state.queue.shift();
      state.jobStart = null;
      continue;
    }

    const total = job.text.length;
    // Character i was scheduled at `delayMs * i`, so at `elapsed` every
    // character up to and including floor(elapsed / delayMs) has landed.
    const revealed =
      job.delayMs > 0
        ? Math.min(total, Math.floor(elapsed / job.delayMs) + 1)
        : total;
    job.onReveal(job.text.slice(0, revealed));
    // Window-level scrolling, exactly as the original writeText did.
    state.scroll();

    if (revealed < total) break;
    state.queue.shift();
    state.jobStart = null;
  }

  if (state.queue.length > 0 && state.frame === null) {
    state.frame = state.schedule((t) => step(state, t));
  }
}

export function useTypewriter() {
  const stateRef = useRef<LoopState>({
    queue: [],
    frame: null,
    jobStart: null,
    schedule: (callback) => requestAnimationFrame(callback),
    cancel: (handle) => cancelAnimationFrame(handle),
    scroll: () => window.scrollTo(0, document.body.scrollHeight),
  });

  const stop = useCallback(() => {
    const state = stateRef.current;
    if (state.frame !== null) {
      state.cancel(state.frame);
      state.frame = null;
    }
    state.jobStart = null;
  }, []);

  const enqueue = useCallback((...jobs: Job[]) => {
    const state = stateRef.current;
    state.queue.push(...jobs);
    if (state.frame === null) {
      state.frame = state.schedule((t) => step(state, t));
    }
  }, []);

  /** Drop everything pending — used by `clear`. */
  const cancelAll = useCallback(() => {
    stateRef.current.queue = [];
    stop();
  }, [stop]);

  useEffect(() => cancelAll, [cancelAll]);

  return { enqueue, cancelAll };
}
