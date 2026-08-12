import { DELAYS } from '@/src/engine/commands';
import type { TerminalEngine } from '@/src/engine/engine';
import type { ContentId } from '@/src/engine/types';

import type { Job } from './Typewriter';

export const LOAD_ERROR_TEXT =
  "Could not load that. Check your connection and try again.\n";

export type OutputEntry =
  | { kind: 'echo'; command: string }
  | { kind: 'text'; text: string };

/** A document that has finished loading, successfully or not. */
type LoadedContent = { ok: true; text: string } | { ok: false };

export interface TerminalSessionDeps {
  engine: TerminalEngine;
  enqueue: (...jobs: Job[]) => void;
  cancelAll: () => void;
  fetchContent: (id: ContentId) => Promise<string>;
  openUrl: (url: string) => void;
  /** Called whenever `entries` or `splashHidden` change so React can re-render. */
  onChange: () => void;
}

export interface TerminalSession {
  entries: OutputEntry[];
  splashHidden: boolean;
  submit: (command: string) => void;
}

/**
 * DOM-free command glue: clear, fetch cache, content gates, and typed output.
 * The React shell owns keyboard / boot; tests drive this with fakes.
 */
export function createTerminalSession(
  deps: TerminalSessionDeps,
): TerminalSession {
  const loaded: Partial<Record<ContentId, LoadedContent>> = {};
  const inFlight = new Set<ContentId>();
  /** Index of the text entry currently being typed into, or null. */
  let activeTextIndex: number | null = null;

  const session: TerminalSession = {
    entries: [],
    splashHidden: false,
    submit(command: string) {
      const result = deps.engine.submit(command);

      if (result.kind === 'clear') {
        // Immediate: the echo never reaches the screen and pending output drops.
        deps.cancelAll();
        session.splashHidden = true;
        session.entries = [];
        activeTextIndex = null;
        deps.onChange();
        return;
      }

      deps.enqueue({
        kind: 'effect',
        run: () => {
          session.entries = [
            ...session.entries,
            { kind: 'echo', command },
          ];
          deps.onChange();
        },
      });

      switch (result.kind) {
        case 'text':
          deps.enqueue(...typeJobs(result.text, result.delayMs));
          break;

        case 'content': {
          const { id, delayMs } = result;
          startLoad(id);
          // Gated rather than awaited, so a command typed behind this one
          // still renders after it instead of racing the fetch.
          deps.enqueue({
            kind: 'gate',
            ready: () => {
              const entry = loaded[id];
              if (!entry) return null;
              if (!entry.ok) {
                delete loaded[id];
                return typeJobs(LOAD_ERROR_TEXT, DELAYS.default);
              }
              return typeJobs(entry.text, delayMs);
            },
          });
          break;
        }

        case 'openUrl':
          deps.openUrl(result.url);
          break;

        default: {
          const exhaustive: never = result;
          throw new Error(`Unhandled result: ${JSON.stringify(exhaustive)}`);
        }
      }
    },
  };

  const revealInto = (revealed: string) => {
    if (activeTextIndex === null) return;
    const i = activeTextIndex;
    const current = session.entries[i];
    if (!current || current.kind !== 'text') return;
    session.entries = [
      ...session.entries.slice(0, i),
      { kind: 'text', text: revealed },
      ...session.entries.slice(i + 1),
    ];
    deps.onChange();
  };

  const typeJobs = (text: string, delayMs: number): Job[] => [
    {
      kind: 'effect',
      run: () => {
        activeTextIndex = session.entries.length;
        session.entries = [...session.entries, { kind: 'text', text: '' }];
        deps.onChange();
      },
    },
    { kind: 'type', text, delayMs, onReveal: revealInto },
    {
      kind: 'effect',
      run: () => {
        activeTextIndex = null;
      },
    },
  ];

  const startLoad = (id: ContentId) => {
    if (loaded[id] || inFlight.has(id)) return;
    inFlight.add(id);
    deps
      .fetchContent(id)
      .then((text) => {
        loaded[id] = { ok: true, text };
      })
      .catch(() => {
        // Cached as a failure so the gate stops waiting; typing the command
        // again clears it and retries.
        loaded[id] = { ok: false };
      })
      .finally(() => inFlight.delete(id));
  };

  return session;
}
