import type { CommandResult, ContentId } from '@/src/engine/types';

import type { Job } from './Typewriter';

/**
 * Side-effect context for renderer dispatch. Mirrors how the engine’s command
 * table returns pure `CommandResult`s — this table *applies* them.
 */
export interface ApplyCommandResultCtx {
  command: string;
  enqueue: (...jobs: Job[]) => void;
  cancelAll: () => void;
  openUrl: (url: string) => void;
  /** Wipe output, hide splash, reset typing cursor; notify React. */
  clearScreen: () => void;
  /** Enqueue the command echo as an effect (skipped by `clear`). */
  echoCommand: () => void;
  typeJobs: (text: string, delayMs: number) => Job[];
  startLoad: (id: ContentId) => void;
  /**
   * Polled by a content gate: null while loading; jobs once the document (or
   * load error) is ready. Failure cache is cleared inside so a retry refetches.
   */
  contentReady: (id: ContentId, delayMs: number) => Job[] | null;
}

type ResultHandler<K extends CommandResult['kind']> = (
  result: Extract<CommandResult, { kind: K }>,
  ctx: ApplyCommandResultCtx,
) => void;

/**
 * Table-driven renderer dispatch — same shape as `COMMANDS` in the engine.
 * `clear` lives here (no pre-switch early return) so new kinds have one home.
 */
const HANDLERS: { [K in CommandResult['kind']]: ResultHandler<K> } = {
  clear: (_result, ctx) => {
    // Immediate: the echo never reaches the screen and pending output drops.
    ctx.cancelAll();
    ctx.clearScreen();
  },

  text: (result, ctx) => {
    ctx.echoCommand();
    ctx.enqueue(...ctx.typeJobs(result.text, result.delayMs));
  },

  content: (result, ctx) => {
    ctx.echoCommand();
    const { id, delayMs } = result;
    ctx.startLoad(id);
    // Gated rather than awaited, so a command typed behind this one still
    // renders after it instead of racing the fetch.
    ctx.enqueue({
      kind: 'gate',
      ready: () => ctx.contentReady(id, delayMs),
    });
  },

  openUrl: (result, ctx) => {
    ctx.echoCommand();
    // Opened synchronously from the submit path to keep the user gesture.
    ctx.openUrl(result.url);
  },
};

export function applyCommandResult(
  result: CommandResult,
  ctx: ApplyCommandResultCtx,
): void {
  const handler = HANDLERS[result.kind] as ResultHandler<typeof result.kind>;
  handler(result, ctx);
}
