import { describe, expect, it, vi } from 'vitest';

import type { CommandResult } from '@/src/engine/types';

import {
  applyCommandResult,
  type ApplyCommandResultCtx,
} from './applyCommandResult';
import type { Job } from './Typewriter';

function mockCtx(
  overrides: Partial<ApplyCommandResultCtx> = {},
): ApplyCommandResultCtx & {
  jobs: Job[];
  echoes: number;
  clears: number;
  loads: string[];
  opened: string[];
} {
  const jobs: Job[] = [];
  let echoes = 0;
  let clears = 0;
  const loads: string[] = [];
  const opened: string[] = [];

  const ctx: ApplyCommandResultCtx & {
    jobs: Job[];
    echoes: number;
    clears: number;
    loads: string[];
    opened: string[];
  } = {
    command: 'help',
    jobs,
    get echoes() {
      return echoes;
    },
    get clears() {
      return clears;
    },
    loads,
    opened,
    enqueue: (...next) => {
      jobs.push(...next);
    },
    cancelAll: vi.fn(),
    openUrl: (url) => {
      opened.push(url);
    },
    clearScreen: () => {
      clears += 1;
    },
    echoCommand: () => {
      echoes += 1;
      jobs.push({ kind: 'effect', run: () => {} });
    },
    typeJobs: (text, delayMs) => [
      { kind: 'effect', run: () => {} },
      { kind: 'type', text, delayMs, onReveal: () => {} },
      { kind: 'effect', run: () => {} },
    ],
    startLoad: (id) => {
      loads.push(id);
    },
    contentReady: () => null,
    ...overrides,
  };

  return ctx;
}

describe('applyCommandResult', () => {
  it('clear cancels, clears screen, and does not echo', () => {
    const ctx = mockCtx();
    applyCommandResult({ kind: 'clear' }, ctx);

    expect(ctx.cancelAll).toHaveBeenCalledOnce();
    expect(ctx.clears).toBe(1);
    expect(ctx.echoes).toBe(0);
    expect(ctx.jobs).toHaveLength(0);
  });

  it('text echoes then enqueues type jobs', () => {
    const ctx = mockCtx({ command: 'help' });
    const result: CommandResult = {
      kind: 'text',
      text: 'hello\n',
      delayMs: 5,
    };
    applyCommandResult(result, ctx);

    expect(ctx.echoes).toBe(1);
    expect(ctx.jobs[0]?.kind).toBe('effect');
    expect(ctx.jobs.some((j) => j.kind === 'type')).toBe(true);
    const typeJob = ctx.jobs.find((j) => j.kind === 'type');
    expect(typeJob && typeJob.kind === 'type' ? typeJob.text : null).toBe(
      'hello\n',
    );
  });

  it('content echoes, starts load, and enqueues a gate', () => {
    const contentReady = vi.fn(() => null);
    const ctx = mockCtx({ contentReady });
    applyCommandResult(
      { kind: 'content', id: 'resume', delayMs: 2 },
      ctx,
    );

    expect(ctx.echoes).toBe(1);
    expect(ctx.loads).toEqual(['resume']);
    const gate = ctx.jobs.find((j) => j.kind === 'gate');
    expect(gate?.kind).toBe('gate');
    if (gate?.kind === 'gate') {
      gate.ready();
      expect(contentReady).toHaveBeenCalledWith('resume', 2);
    }
  });

  it('openUrl echoes and opens immediately without type jobs', () => {
    const ctx = mockCtx({ command: 'github' });
    applyCommandResult(
      { kind: 'openUrl', url: 'https://github.com/example' },
      ctx,
    );

    expect(ctx.echoes).toBe(1);
    expect(ctx.opened).toEqual(['https://github.com/example']);
    expect(ctx.jobs.every((j) => j.kind === 'effect')).toBe(true);
    expect(ctx.jobs.some((j) => j.kind === 'type' || j.kind === 'gate')).toBe(
      false,
    );
  });
});
