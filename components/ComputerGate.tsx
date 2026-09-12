'use client';

import { useSyncExternalStore } from 'react';

import {
  COMPUTER_REQUIRED_MESSAGE,
  readNavigatorSurfaceInput,
  readSurface,
  type Surface,
} from '@/src/surface';

import Terminal from './Terminal';

function getSnapshot(): Surface {
  return readSurface(readNavigatorSurfaceInput(navigator));
}

function getServerSnapshot(): Surface {
  return 'terminal';
}

function subscribe() {
  return () => {};
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
