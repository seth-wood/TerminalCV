import { describe, expect, it } from 'vitest';

import { HELP_TEXT, unknownCommandText } from './commands';
import { TerminalEngine } from './engine';
import type { EngineDeps } from './types';

const deps: EngineDeps = {
  githubUrl: 'https://github.com/seth-wood',
  resumeUrl: '/SethWoodResume.pdf',
};

const engine = () => new TerminalEngine(deps);

describe('content commands', () => {
  it('1 asks for the resume at delay 2', () => {
    expect(engine().submit('1')).toEqual({
      kind: 'content',
      id: 'resume',
      delayMs: 2,
    });
  });

  it('2 asks for the projects at delay 5', () => {
    expect(engine().submit('2')).toEqual({
      kind: 'content',
      id: 'projects',
      delayMs: 5,
    });
  });

  it('3 asks for the about text at delay 5', () => {
    expect(engine().submit('3')).toEqual({
      kind: 'content',
      id: 'about',
      delayMs: 5,
    });
  });

  it('names documents instead of carrying them, so none are in the payload', () => {
    // Guards the reason the engine stopped taking a content map: the resume
    // has contact details that must not ship in the served HTML.
    expect(Object.keys(deps).sort()).toEqual(['githubUrl', 'resumeUrl']);
    expect(engine().submit('1')).not.toHaveProperty('text');
  });
});

describe('effect commands', () => {
  it('clear asks the renderer to clear', () => {
    expect(engine().submit('clear')).toEqual({ kind: 'clear' });
  });

  it('download opens the root-absolute pdf', () => {
    expect(engine().submit('download')).toEqual({
      kind: 'openUrl',
      url: '/SethWoodResume.pdf',
    });
  });

  it('github opens the profile', () => {
    expect(engine().submit('github')).toEqual({
      kind: 'openUrl',
      url: 'https://github.com/seth-wood',
    });
  });
});

describe('help', () => {
  it('returns the help text verbatim', () => {
    expect(engine().submit('help')).toEqual({
      kind: 'text',
      text: HELP_TEXT,
      delayMs: 5,
    });
  });

  it('matches the byte-exact help text from index.js', () => {
    expect(HELP_TEXT).toBe(
      '<commands>\n\nUsage:\n\n1           resume\n2           projects\n' +
        '3           about me\ndownload    resume in pdf\ngithub      portfolio\n' +
        'help        this help text\nclear       clear the screen\n\n',
    );
  });
});

describe('input handling', () => {
  it('empty input types a single newline', () => {
    expect(engine().submit('')).toEqual({
      kind: 'text',
      text: '\n',
      delayMs: 5,
    });
  });

  it('dispatch is case-insensitive', () => {
    expect(engine().submit('HELP')).toEqual(engine().submit('help'));
    expect(engine().submit('GitHub')).toEqual({
      kind: 'openUrl',
      url: 'https://github.com/seth-wood',
    });
  });

  it('unknown commands echo the original case', () => {
    expect(engine().submit('Foo')).toEqual({
      kind: 'text',
      text: unknownCommandText('Foo'),
      delayMs: 5,
    });
  });

  it('unknown command text matches index.js', () => {
    expect(unknownCommandText('xyz')).toBe(
      "Unknown command: xyz\n Enter 'help' to see a list of commands.",
    );
  });

  it('inherited Object properties are not commands', () => {
    expect(engine().submit('constructor').kind).toBe('text');
    expect(engine().submit('toString')).toEqual({
      kind: 'text',
      text: unknownCommandText('toString'),
      delayMs: 5,
    });
  });

  it('whitespace is not trimmed, matching the current dispatch', () => {
    expect(engine().submit(' help ')).toEqual({
      kind: 'text',
      text: unknownCommandText(' help '),
      delayMs: 5,
    });
  });
});

describe('history', () => {
  it('records every submission in order, original case included', () => {
    const e = engine();
    e.submit('help');
    e.submit('1');
    e.submit('Foo');
    expect(e.history).toEqual(['help', '1', 'Foo']);
  });
});
