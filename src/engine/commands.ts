import type { CommandResult, EngineDeps } from './types';
import { DELAYS } from './timing';

export const HELP_TEXT = [
  '<commands>\n',
  'Usage:\n',
  '1           resume',
  '2           projects',
  '3           about me',
  'download    resume in pdf',
  'github      portfolio',
  'help        this help text',
  'clear       clear the screen\n\n',
].join('\n');

type CommandFn = (deps: EngineDeps) => CommandResult;

const COMMANDS: Record<string, CommandFn> = {
  '': () => ({ kind: 'text', text: '\n', delayMs: DELAYS.default }),
  '1': () => ({ kind: 'content', id: 'resume', delayMs: DELAYS.resume }),
  '2': () => ({ kind: 'content', id: 'projects', delayMs: DELAYS.projects }),
  '3': () => ({ kind: 'content', id: 'about', delayMs: DELAYS.about }),
  clear: () => ({ kind: 'clear' }),
  download: (d) => ({ kind: 'openUrl', url: d.resumeUrl }),
  github: (d) => ({ kind: 'openUrl', url: d.githubUrl }),
  help: () => ({ kind: 'text', text: HELP_TEXT, delayMs: DELAYS.default }),
};

export function unknownCommandText(command: string): string {
  return `Unknown command: ${command}\n Enter 'help' to see a list of commands.`;
}

/** Dispatch on the lowercased input; the original case is only echoed back. */
export function execute(command: string, deps: EngineDeps): CommandResult {
  const cmd = command.toLowerCase();

  if (Object.hasOwn(COMMANDS, cmd)) {
    return COMMANDS[cmd](deps);
  }

  return {
    kind: 'text',
    text: unknownCommandText(command),
    delayMs: DELAYS.default,
  };
}
