import { describe, expect, it, vi } from 'vitest';

import { readSurface, subscribeSurface } from './surface';

function fakeMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<EventListener>();
  const matchMedia = (query: string) => {
    void query;
    return {
      get matches() {
        return matches;
      },
      media: '',
      onchange: null,
      addEventListener: (
        _: string,
        handler: EventListenerOrEventListenerObject,
      ) => {
        if (typeof handler === 'function') listeners.add(handler);
      },
      removeEventListener: (
        _: string,
        handler: EventListenerOrEventListenerObject,
      ) => {
        if (typeof handler === 'function') listeners.delete(handler);
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    } as MediaQueryList;
  };
  return {
    matchMedia,
    setMatches(value: boolean) {
      matches = value;
    },
    dispatch() {
      const event = new Event('change');
      for (const handler of listeners) handler(event);
    },
  };
}

describe('readSurface', () => {
  it('returns terminal when hover and fine pointer match', () => {
    const { matchMedia } = fakeMatchMedia(true);
    expect(readSurface(matchMedia)).toBe('terminal');
  });

  it('returns computerRequired when hover and fine pointer do not match', () => {
    const { matchMedia } = fakeMatchMedia(false);
    expect(readSurface(matchMedia)).toBe('computerRequired');
  });
});

describe('subscribeSurface', () => {
  it('calls onChange when the query changes', () => {
    const fake = fakeMatchMedia(true);
    const onChange = vi.fn();
    subscribeSurface(fake.matchMedia, onChange);
    fake.setMatches(false);
    fake.dispatch();
    expect(onChange).toHaveBeenCalledWith('computerRequired');
  });
});
