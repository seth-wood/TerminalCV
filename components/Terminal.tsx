'use client';

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { DELAYS } from '@/src/engine/commands';
import { TerminalEngine } from '@/src/engine/engine';
import type { ContentId } from '@/src/engine/types';

import { type Job, useTypewriter } from './Typewriter';

const URLS = {
  RESUME: '/SethWoodResume.pdf',
  GITHUB: 'https://github.com/seth-wood',
};

/** Served from `public/`, fetched only when the command is typed. */
const CONTENT_URLS: Record<ContentId, string> = {
  resume: '/asciiresume.txt',
  projects: '/projects.txt',
  about: '/about.txt',
};

const LOAD_ERROR_TEXT = "Could not load that. Check your connection and try again.\n";

const KEYBOARD_CONFIG = {
  MODIFIERS: ['Meta', 'Tab', 'Shift', 'Control', 'Alt', 'CapsLock'],
  NAVIGATION: [
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
    'PageUp',
    'PageDown',
  ],
  SYSTEM: ['Escape', 'Insert'],
  FUNCTION: Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
};

const IGNORE_KEYS = new Set([
  ...KEYBOARD_CONFIG.MODIFIERS,
  ...KEYBOARD_CONFIG.NAVIGATION,
  ...KEYBOARD_CONFIG.SYSTEM,
  ...KEYBOARD_CONFIG.FUNCTION,
]);

const INSTRUCTIONS_TEXT =
  "Enter a command. Type 'help' for additional commands.";

const BOOT_DELAY_MS = 1000;
const INSTRUCTIONS_DELAY_MS = 500;

function noInputHasFocus() {
  const tags = ['INPUT', 'TEXTAREA', 'BUTTON'];
  return tags.indexOf(document.activeElement?.tagName ?? '') === -1;
}

type OutputEntry =
  | { kind: 'echo'; command: string }
  | { kind: 'text'; text: string };

/** A document that has finished loading, successfully or not. */
type LoadedContent = { ok: true; text: string } | { ok: false };

export default function Terminal({ splash: initialSplash }: { splash: string }) {
  const engineRef = useRef<TerminalEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = new TerminalEngine({
      githubUrl: URLS.GITHUB,
      resumeUrl: URLS.RESUME,
    });
  }

  // Documents are fetched at command time and cached, so a second `1` is
  // instant and a failed load can be retried by typing the command again.
  const loadedRef = useRef<Partial<Record<ContentId, LoadedContent>>>({});
  const inFlightRef = useRef<Set<ContentId>>(new Set());

  const { enqueue, cancelAll } = useTypewriter();

  // Server-rendered with the full splash so the page is meaningful before (and
  // without) JS, exactly as the static index.html was.
  const [splash, setSplash] = useState(initialSplash);
  const [splashHidden, setSplashHidden] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [entries, setEntries] = useState<OutputEntry[]>([]);
  const [commandInput, setCommandInput] = useState('');
  const [booted, setBooted] = useState(false);

  // Mirror of the command buffer, so the key handler can read and rewrite it
  // without routing side effects through a state updater.
  const inputRef = useRef('');
  const writeInput = (value: string) => {
    inputRef.current = value;
    setCommandInput(value);
  };

  // Blank the splash before paint, so the retype starts from an empty screen.
  // The cascading render is the point here: the server-rendered art has to
  // survive hydration (so the page is meaningful without JS) and disappear
  // before the browser paints.
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSplash('');
  }, []);

  const bootedOnce = useRef(false);
  useEffect(() => {
    if (bootedOnce.current) return;
    bootedOnce.current = true;

    enqueue(
      { kind: 'wait', ms: BOOT_DELAY_MS },
      {
        kind: 'type',
        text: initialSplash,
        delayMs: DELAYS.default,
        onReveal: setSplash,
      },
      { kind: 'wait', ms: INSTRUCTIONS_DELAY_MS },
      {
        kind: 'type',
        text: INSTRUCTIONS_TEXT,
        delayMs: DELAYS.default,
        onReveal: setInstructions,
      },
      { kind: 'effect', run: () => setBooted(true) },
    );
  }, [initialSplash, enqueue]);

  // The keydown listener is attached only once the boot sequence finishes,
  // matching initializeTerminal — keystrokes during boot are ignored.
  useEffect(() => {
    if (!booted) return;

    const revealInto = (revealed: string) => {
      setEntries((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.kind !== 'text') return prev;
        return [...prev.slice(0, -1), { kind: 'text', text: revealed }];
      });
    };

    // The two jobs that type a finished string into a fresh output entry.
    const typeJobs = (text: string, delayMs: number): Job[] => [
      {
        kind: 'effect',
        run: () => setEntries((prev) => [...prev, { kind: 'text', text: '' }]),
      },
      { kind: 'type', text, delayMs, onReveal: revealInto },
    ];

    const startLoad = (id: ContentId) => {
      if (loadedRef.current[id] || inFlightRef.current.has(id)) return;
      inFlightRef.current.add(id);
      fetch(CONTENT_URLS[id])
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.text();
        })
        .then((text) => {
          loadedRef.current[id] = { ok: true, text };
        })
        .catch(() => {
          // Cached as a failure so the gate stops waiting; typing the command
          // again clears it and retries.
          loadedRef.current[id] = { ok: false };
        })
        .finally(() => inFlightRef.current.delete(id));
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (!noInputHasFocus()) return;

      if (e.key === 'Enter') {
        const command = inputRef.current;
        writeInput('');
        const result = engineRef.current!.submit(command);

        if (result.kind === 'clear') {
          // Immediate, as it was when `clear` ran inside the command table:
          // the echo never reaches the screen and pending output is dropped.
          cancelAll();
          setSplashHidden(true);
          setEntries([]);
          return;
        }

        enqueue({
          kind: 'effect',
          run: () => setEntries((prev) => [...prev, { kind: 'echo', command }]),
        });

        switch (result.kind) {
          case 'text':
            enqueue(...typeJobs(result.text, result.delayMs));
            break;

          case 'content': {
            const { id, delayMs } = result;
            startLoad(id);
            // Gated rather than awaited, so a command typed behind this one
            // still renders after it instead of racing the fetch.
            enqueue({
              kind: 'gate',
              ready: () => {
                const loaded = loadedRef.current[id];
                if (!loaded) return null;
                if (!loaded.ok) {
                  delete loadedRef.current[id];
                  return typeJobs(LOAD_ERROR_TEXT, DELAYS.default);
                }
                return typeJobs(loaded.text, delayMs);
              },
            });
            break;
          }

          case 'openUrl':
            // Opened straight from the key handler to keep the user gesture.
            window.open(result.url, '_blank')?.focus();
            break;

          default: {
            // Adding a CommandResult variant without handling it is a type error.
            const exhaustive: never = result;
            throw new Error(`Unhandled result: ${JSON.stringify(exhaustive)}`);
          }
        }
      } else if (e.key === 'Backspace') {
        writeInput(inputRef.current.slice(0, -1));
      } else if (IGNORE_KEYS.has(e.key)) {
        e.preventDefault();
      } else {
        writeInput(inputRef.current + e.key);
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [booted, cancelAll, enqueue]);

  return (
    <>
      <pre id="asciiText" style={splashHidden ? { display: 'none' } : undefined}>
        {splash}
      </pre>
      <pre id="instructions">{instructions}</pre>
      <pre id="output">
        {entries.map((entry, i) =>
          entry.kind === 'echo' ? (
            // Inside a <pre> the two <br>s and the literal \n are three breaks,
            // and the command is bold — the exact markup index.js produced.
            <Fragment key={i}>
              <br />
              <strong>{entry.command}</strong>
              {'\n'}
              <br />
            </Fragment>
          ) : (
            <Fragment key={i}>{entry.text}</Fragment>
          ),
        )}
      </pre>
      <div id="prompt">
        {/* `prompt.prepend(">")` landed before the source's whitespace text
            node, which collapses to one rendered space — hence "> ", not ">". */}
        {booted ? '>' : null}
        {booted ? ' ' : null}
        <span id="command-input">{commandInput}</span>
        <span id="cursor" className="blink">
          {booted ? '_' : null}
        </span>
      </div>
    </>
  );
}
