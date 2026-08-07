import { execute } from './commands';
import type { CommandResult, EngineDeps } from './types';

/**
 * The terminal, with zero DOM and zero framework dependencies: it maps input to
 * a *description* of what should happen. The renderer performs the effect.
 */
export class TerminalEngine {
  private readonly deps: EngineDeps;
  private readonly commandHistory: string[] = [];

  constructor(deps: EngineDeps) {
    this.deps = deps;
  }

  submit(input: string): CommandResult {
    this.commandHistory.push(input);
    return execute(input, this.deps);
  }

  get history(): readonly string[] {
    return this.commandHistory;
  }
}
