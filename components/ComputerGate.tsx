'use client';

import { useSyncExternalStore } from 'react';

import {
  COMPUTER_REQUIRED_MESSAGE,
  readSurface,
  subscribeSurface,
  type Surface,
} from '@/src/surface';

import Terminal from './Terminal';

function getMatchMedia() {
  return window.matchMedia.bind(window);
}

function subscribe(onStoreChange: () => void) {
  return subscribeSurface(getMatchMedia(), () => onStoreChange());
}

function getSnapshot(): Surface {
  return readSurface(getMatchMedia());
}

function getServerSnapshot(): Surface {
  return 'terminal';
}

export default function ComputerGate({ splash }: { splash: string }) {
  const surface = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  switch (surface) {
    case 'terminal':
      return <Terminal splash={splash} />;
    case 'computerRequired':
      return <main id="computer-required">{COMPUTER_REQUIRED_MESSAGE}</main>;
    default: {
      const _: never = surface;
      return _;
    }
  }
}
