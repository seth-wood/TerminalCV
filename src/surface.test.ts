import { describe, expect, it } from 'vitest';

import {
  COMPUTER_REQUIRED_MESSAGE,
  readSurface,
  type NavigatorSurfaceInput,
} from './surface';

const desktopChrome: NavigatorSurfaceInput = {
  userAgent:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  maxTouchPoints: 0,
  userAgentDataMobile: false,
};

const iphone: NavigatorSurfaceInput = {
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  maxTouchPoints: 5,
  userAgentDataMobile: true,
};

const ipadOs: NavigatorSurfaceInput = {
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  maxTouchPoints: 5,
  userAgentDataMobile: undefined,
};

const windowsTouchLaptop: NavigatorSurfaceInput = {
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  maxTouchPoints: 10,
  userAgentDataMobile: false,
};

describe('readSurface', () => {
  it('returns terminal for desktop Chrome', () => {
    expect(readSurface(desktopChrome)).toBe('terminal');
  });

  it('returns computerRequired for iPhone', () => {
    expect(readSurface(iphone)).toBe('computerRequired');
  });

  it('returns computerRequired for iPadOS Macintosh plus touch points', () => {
    expect(readSurface(ipadOs)).toBe('computerRequired');
  });

  it('returns terminal for a Windows touch laptop', () => {
    expect(readSurface(windowsTouchLaptop)).toBe('terminal');
  });

  it('returns computerRequired when Client Hints say mobile', () => {
    expect(
      readSurface({
        ...desktopChrome,
        userAgentDataMobile: true,
      }),
    ).toBe('computerRequired');
  });

  it('keeps the gate copy as a literal', () => {
    expect(COMPUTER_REQUIRED_MESSAGE).toBe(
      'Not mobile optimized. Please use a computer.',
    );
  });
});
