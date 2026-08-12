import { describe, expect, it } from 'vitest';

import { HELP_TEXT } from '@/src/engine/commands';
import { TerminalEngine } from '@/src/engine/engine';
import type { ContentId } from '@/src/engine/types';

import { type Job, type LoopState, step } from './Typewriter';
import {
  LOAD_ERROR_TEXT,
  createTerminalSession,
  type TerminalSession,
} from './terminalSession';

/**
 * Fake frame clock + injectable content loader, same spirit as Typewriter.test.
 */
function harness() {
  const scrolls: number[] = [];
  let pending: ((now: number) => void) | null = null;
  let nextHandle = 1;

  const state: LoopState = {
    queue: [],
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

  const enqueue = (...jobs: Job[]) => {
    state.queue.push(...jobs);
    if (state.frame === null) {
      state.frame = state.schedule((t) => step(state, t));
    }
  };

  const cancelAll = () => {
    state.queue = [];
    if (state.frame !== null) {
      state.cancel(state.frame);
      state.frame = null;
    }
    state.jobStart = null;
    pending = null;
  };

  type Deferred = {
    promise: Promise<string>;
    resolve: (text: string) => void;
    reject: (err?: unknown) => void;
  };

  const fetchCalls: ContentId[] = [];
  const pendingById = new Map<ContentId, Deferred[]>();

  const fetchContent = (id: ContentId): Promise<string> => {
    fetchCalls.push(id);
    let resolve!: (text: string) => void;
    let reject!: (err?: unknown) => void;
    const promise = new Promise<string>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const deferred: Deferred = { promise, resolve, reject };
    const list = pendingById.get(id) ?? [];
    list.push(deferred);
    pendingById.set(id, list);
    return promise;
  };

  const resolveFetch = (id: ContentId, text: string) => {
    const list = pendingById.get(id);
    const deferred = list?.shift();
    if (!deferred) throw new Error(`No pending fetch for ${id}`);
    deferred.resolve(text);
  };

  const rejectFetch = (id: ContentId, err: unknown = new Error('fail')) => {
    const list = pendingById.get(id);
    const deferred = list?.shift();
    if (!deferred) throw new Error(`No pending fetch for ${id}`);
    deferred.reject(err);
  };

  let changeCount = 0;
  const session: TerminalSession = createTerminalSession({
    engine: new TerminalEngine({
      githubUrl: 'https://github.com/example',
      resumeUrl: '/resume.pdf',
    }),
    enqueue,
    cancelAll,
    fetchContent,
    openUrl: () => {},
    onChange: () => {
      changeCount += 1;
    },
  });

  return {
    session,
    state,
    fetchCalls,
    changeCount: () => changeCount,
    resolveFetch,
    rejectFetch,
    hasFrame: () => pending !== null,
    /** Run one frame at `now`. */
    tick(now: number) {
      const callback = pending;
      pending = null;
      if (callback) callback(now);
      else step(state, now);
    },
    /** Drain until the queue is empty or N frames elapse. */
    drain(startNow = 0, maxFrames = 500) {
      let now = startNow;
      for (let i = 0; i < maxFrames && state.queue.length > 0; i++) {
        this.tick(now);
        now += 16;
      }
    },
  };
}

/** Drain promise reactions (then/catch/finally) so fetch handlers settle. */
async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('clear during type', () => {
  it('drops pending jobs, hides splash, and clears entries', () => {
    const h = harness();

    h.session.submit('help');
    // Echo + start of typing land; leave characters still pending.
    h.tick(0);
    expect(h.session.entries.some((e) => e.kind === 'echo')).toBe(true);
    expect(h.state.queue.length).toBeGreaterThan(0);

    h.session.submit('clear');

    expect(h.state.queue).toHaveLength(0);
    expect(h.session.entries).toEqual([]);
    expect(h.session.splashHidden).toBe(true);
    expect(h.hasFrame()).toBe(false);
  });
});

describe('fetch fail then retry', () => {
  it('surfaces error text and clears the failure cache so retry refetches', async () => {
    const h = harness();

    h.session.submit('1');
    expect(h.fetchCalls).toEqual(['resume']);
    h.tick(0);
    expect(h.state.queue[0]?.kind).toBe('gate');

    h.rejectFetch('resume');
    await flush();

    h.drain();
    const texts = h.session.entries
      .filter((e) => e.kind === 'text')
      .map((e) => (e.kind === 'text' ? e.text : ''));
    expect(texts).toContain(LOAD_ERROR_TEXT);

    h.session.submit('1');
    expect(h.fetchCalls).toEqual(['resume', 'resume']);

    h.resolveFetch('resume', 'RESUME BODY\n');
    await flush();
    h.drain(1000);

    const afterRetry = h.session.entries
      .filter((e) => e.kind === 'text')
      .map((e) => (e.kind === 'text' ? e.text : ''));
    expect(afterRetry).toContain('RESUME BODY\n');
  });
});

describe('gate ordering', () => {
  it('does not render a later command before a gated content load completes', async () => {
    const h = harness();

    h.session.submit('1');
    h.session.submit('help');

    h.tick(0);
    h.tick(16);
    // Gate still pending; help must not have typed yet.
    const earlyText = h.session.entries
      .filter((e) => e.kind === 'text')
      .map((e) => (e.kind === 'text' ? e.text : ''));
    expect(earlyText).toEqual([]);
    expect(h.session.entries.filter((e) => e.kind === 'echo')).toHaveLength(1);

    h.resolveFetch('resume', 'SLOW CONTENT\n');
    await flush();
    h.drain();

    const echoes = h.session.entries
      .filter((e) => e.kind === 'echo')
      .map((e) => (e.kind === 'echo' ? e.command : ''));
    expect(echoes).toEqual(['1', 'help']);

    const texts = h.session.entries
      .filter((e) => e.kind === 'text')
      .map((e) => (e.kind === 'text' ? e.text : ''));
    expect(texts[0]).toBe('SLOW CONTENT\n');
    expect(texts[1]).toBe(HELP_TEXT);
  });
});
