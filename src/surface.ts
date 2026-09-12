export type Surface = 'terminal' | 'computerRequired';

export const COMPUTER_REQUIRED_MESSAGE = 'Please use a computer.';

export type NavigatorSurfaceInput = {
  readonly userAgent: string;
  readonly maxTouchPoints: number;
  readonly userAgentDataMobile: boolean | undefined;
};

const MOBILE_UA =
  /Mobi|iPhone|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i;

export function readSurface(input: NavigatorSurfaceInput): Surface {
  if (input.userAgentDataMobile === true) return 'computerRequired';
  if (/iPad/i.test(input.userAgent)) return 'computerRequired';
  if (/Macintosh/i.test(input.userAgent) && input.maxTouchPoints > 1) {
    return 'computerRequired';
  }
  if (MOBILE_UA.test(input.userAgent)) return 'computerRequired';
  return 'terminal';
}

export function readNavigatorSurfaceInput(
  nav: Navigator,
): NavigatorSurfaceInput {
  const uaData = 'userAgentData' in nav ? nav.userAgentData : undefined;
  return {
    userAgent: nav.userAgent,
    maxTouchPoints: nav.maxTouchPoints,
    userAgentDataMobile:
      uaData && typeof uaData === 'object' && 'mobile' in uaData
        ? Boolean(uaData.mobile)
        : undefined,
  };
}
