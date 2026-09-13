export type Surface = 'terminal' | 'computerRequired';

export const COMPUTER_REQUIRED_MESSAGE =
  'Not mobile optimized. Please use a computer.';

const TERMINAL_QUERY = '(hover: hover) and (pointer: fine)';

type MediaMatches = { readonly matches: boolean };

type MediaQueryHandle = MediaMatches & {
  addEventListener(type: 'change', listener: EventListener): void;
  removeEventListener(type: 'change', listener: EventListener): void;
};

export function readSurface(
  matchMedia: (query: string) => MediaMatches,
): Surface {
  return matchMedia(TERMINAL_QUERY).matches ? 'terminal' : 'computerRequired';
}

export function subscribeSurface(
  matchMedia: (query: string) => MediaQueryHandle,
  onChange: (surface: Surface) => void,
): () => void {
  const mql = matchMedia(TERMINAL_QUERY);
  const handler = () => onChange(readSurface(matchMedia));
  mql.addEventListener('change', handler);
  return () => mql.removeEventListener('change', handler);
}
