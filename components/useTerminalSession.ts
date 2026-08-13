'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { DEFAULT_TYPE_DELAY_MS } from '@/src/engine/timing';
import { TerminalEngine } from '@/src/engine/engine';
import type { ContentId } from '@/src/engine/types';

import type { Job } from './Typewriter';
import {
  createTerminalSession,
  type OutputEntry,
  type TerminalSession,
} from './terminalSession';

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

function fetchContent(id: ContentId): Promise<string> {
  return fetch(CONTENT_URLS[id]).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  });
}

export interface UseTerminalSessionArgs {
  initialSplash: string;
  enqueue: (...jobs: Job[]) => void;
  cancelAll: () => void;
}

export interface TerminalSessionView {
  splash: string;
  splashHidden: boolean;
  instructions: string;
  entries: OutputEntry[];
  commandInput: string;
  booted: boolean;
}

/**
 * Boot sequence, content session, and global keydown — so Terminal.tsx stays JSX.
 */
export function useTerminalSession({
  initialSplash,
  enqueue,
  cancelAll,
}: UseTerminalSessionArgs): TerminalSessionView {
  const [engine] = useState(
    () =>
      new TerminalEngine({
        githubUrl: URLS.GITHUB,
        resumeUrl: URLS.RESUME,
      }),
  );

  const enqueueRef = useRef(enqueue);
  const cancelAllRef = useRef(cancelAll);
  const sessionRef = useRef<TerminalSession | null>(null);

  useEffect(() => {
    enqueueRef.current = enqueue;
    cancelAllRef.current = cancelAll;
  });

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
        delayMs: DEFAULT_TYPE_DELAY_MS,
        onReveal: setSplash,
      },
      { kind: 'wait', ms: INSTRUCTIONS_DELAY_MS },
      {
        kind: 'type',
        text: INSTRUCTIONS_TEXT,
        delayMs: DEFAULT_TYPE_DELAY_MS,
        onReveal: setInstructions,
      },
      { kind: 'effect', run: () => setBooted(true) },
    );
  }, [initialSplash, enqueue]);

  // Session is created once when boot finishes so effect re-runs cannot
  // discard in-memory fetch cache or diverge from React output state.
  useEffect(() => {
    if (!booted || sessionRef.current !== null) return;

    sessionRef.current = createTerminalSession({
      engine,
      enqueue: (...jobs) => enqueueRef.current(...jobs),
      cancelAll: () => cancelAllRef.current(),
      fetchContent,
      openUrl: (url) => {
        window.open(url, '_blank')?.focus();
      },
      onChange: () => {
        const session = sessionRef.current;
        if (!session) return;
        setEntries(session.entries);
        setSplashHidden(session.splashHidden);
      },
    });
  }, [booted, engine]);

  // Keydown listener only after boot; reads the stable session ref.
  useEffect(() => {
    if (!booted) return;

    const handleKeydown = (e: KeyboardEvent) => {
      if (!noInputHasFocus()) return;

      if (e.key === 'Enter') {
        const command = inputRef.current;
        writeInput('');
        sessionRef.current?.submit(command);
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
  }, [booted]);

  return {
    splash,
    splashHidden,
    instructions,
    entries,
    commandInput,
    booted,
  };
}
