import { describe, expect, it } from 'vitest';

import { type Job, type LoopState, step } from './Typewriter';

/**
 * A fake frame clock. `step` takes its scheduler and its scrolling from the
 * loop state, so the whole queue runs here with no DOM and no jsdom: `tick`
 * advances time and runs whatever frame was scheduled.
 */
function harness(...queue: Job[]) {
  const scrolls: number[] = [];
  let pending: ((now: number) => void) | null = null;
  let nextHandle = 1;

  const state: LoopState = {
    queue,
    frame: null,
    jobStart: null,
    schedule: (callback) => {
      pending = callback;
      return nextHandle++;
    },
    cancel: () => {
      pending = null;
    },
    scroll: () => scrolls.push(1),
  };

  return {
    state,
    scrolls,
    hasFrame: () => pending !== null,
    /** Run one frame at `now`. */
    tick(now: number) {
      const callback = pending;
      pending = null;
      if (callback) callback(now);
      else step(state, now);
    },
  };
}

const typeJob = (text: string, delayMs: number, into: string[]): Job => ({
  kind: 'type',
  text,
  delayMs,
  onReveal: (revealed) => into.push(revealed),
});

describe('reveal timing', () => {
  it('reveals by elapsed time, matching setTimeout(delayMs * i)', () => {
    const revealed: string[] = [];
    const h = harness(typeJob('abcdef', 2, revealed));

    h.tick(0);
    expect(revealed.at(-1)).toBe('a'); // floor(0/2) + 1
    h.tick(6);
    expect(revealed.at(-1)).toBe('abcd'); // floor(6/2) + 1
    h.tick(1000);
    expect(revealed.at(-1)).toBe('abcdef'); // clamped to the full text
  });

  it('reveals the whole text at once when delayMs is 0', () => {
    const revealed: string[] = [];
    const h = harness(typeJob('instant', 0, revealed));

    h.tick(0);
    expect(revealed).toEqual(['instant']);
    expect(h.state.queue).toHaveLength(0);
  });

  it('scrolls on every revealing frame, as the original writeText did', () => {
    const h = harness(typeJob('abcdef', 2, []));
    h.tick(0);
    h.tick(4);
    expect(h.scrolls).toHaveLength(2);
  });

  it('stops scheduling frames once the queue drains', () => {
    const h = harness(typeJob('ab', 1, []));
    h.tick(0);
    expect(h.hasFrame()).toBe(true);
    h.tick(100);
    expect(h.state.queue).toHaveLength(0);
    expect(h.hasFrame()).toBe(false);
  });
});

describe('ordering', () => {
  it('runs jobs strictly in order rather than interleaving', () => {
    const log: string[] = [];
    const h = harness(
      typeJob('AB', 1, log),
      { kind: 'effect', run: () => log.push('between') },
      typeJob('CD', 1, log),
    );

    h.tick(0);
    h.tick(50);
    // The second job's clock starts when it reaches the head of the queue, so
    // it types from 'C' rather than jumping straight to its final state.
    expect(log).toEqual(['A', 'AB', 'between', 'C']);
    h.tick(100);
    expect(log).toEqual(['A', 'AB', 'between', 'C', 'CD']);
  });

  it('holds the queue for the full wait duration', () => {
    const log: string[] = [];
    const h = harness({ kind: 'wait', ms: 100 }, typeJob('x', 1, log));

    h.tick(0);
    h.tick(99);
    expect(log).toEqual([]);
    h.tick(100);
    expect(log).toEqual(['x']);
  });

  it('drains an effect and the typing it sets up in the same frame', () => {
    const log: string[] = [];
    const h = harness(
      { kind: 'effect', run: () => log.push('setup') },
      typeJob('x', 0, log),
    );

    h.tick(0);
    expect(log).toEqual(['setup', 'x']);
  });
});

describe('gate', () => {
  it('polls once per frame and types nothing while pending', () => {
    const log: string[] = [];
    let polls = 0;
    const h = harness({
      kind: 'gate',
      ready: () => {
        polls += 1;
        return null;
      },
    });

    h.tick(0);
    h.tick(16);
    expect(polls).toBe(2);
    expect(log).toEqual([]);
    expect(h.hasFrame()).toBe(true); // keeps polling
  });

  it('splices in its jobs once ready', () => {
    const log: string[] = [];
    let loaded: string | null = null;
    const h = harness({
      kind: 'gate',
      ready: () => (loaded === null ? null : [typeJob(loaded, 0, log)]),
    });

    h.tick(0);
    expect(log).toEqual([]);

    loaded = 'LOADED';
    h.tick(16);
    expect(log).toEqual(['LOADED']);
    expect(h.state.queue).toHaveLength(0);
  });

  it('keeps a command queued behind it from racing ahead', () => {
    const log: string[] = [];
    let loaded: string | null = null;
    const h = harness(
      {
        kind: 'gate',
        ready: () => (loaded === null ? null : [typeJob(loaded, 0, log)]),
      },
      typeJob('after', 0, log),
    );

    h.tick(0);
    expect(log).toEqual([]); // the later command must not jump the gate

    loaded = 'slow';
    h.tick(16);
    expect(log).toEqual(['slow', 'after']);
  });

  it('does not consume the wait clock while pending', () => {
    const log: string[] = [];
    let loaded: string | null = null;
    const h = harness(
      {
        kind: 'gate',
        ready: () => (loaded === null ? null : [typeJob(loaded, 2, log)]),
      },
    );

    h.tick(0);
    h.tick(500);
    loaded = 'abc';
    // Typing starts from the frame the gate opened, not from queue entry —
    // otherwise a slow fetch would make the text appear fully-typed.
    h.tick(500);
    expect(log.at(-1)).toBe('a');
  });
});
