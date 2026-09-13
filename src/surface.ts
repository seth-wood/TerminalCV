export type Surface = 'terminal' | 'computerRequired';

export const COMPUTER_REQUIRED_MESSAGE =
  'Not mobile optimized. Please use a computer.';

const TERMINAL_QUERY = '(hover: hover) and (pointer: fine)';

export function readSurface(
  matchMedia: (query: string) => MediaQueryList,
): Surface {
  return matchMedia(TERMINAL_QUERY).matches ? 'terminal' : 'computerRequired';
}

export function subscribeSurface(
  matchMedia: (query: string) => MediaQueryList,
  onChange: (surface: Surface) => void,
): () => void {
  const mql = matchMedia(TERMINAL_QUERY);
  const handler = () => onChange(readSurface(matchMedia));
  mql.addEventListener('change', handler);
  return () => mql.removeEventListener('change', handler);
}
