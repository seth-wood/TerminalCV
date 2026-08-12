'use client';

import { Fragment } from 'react';

import { useTypewriter } from './Typewriter';
import { useTerminalSession } from './useTerminalSession';

export default function Terminal({ splash: initialSplash }: { splash: string }) {
  const { enqueue, cancelAll } = useTypewriter();
  const {
    splash,
    splashHidden,
    instructions,
    entries,
    commandInput,
    booted,
  } = useTerminalSession({ initialSplash, enqueue, cancelAll });

  return (
    <>
      <pre id="asciiText" style={splashHidden ? { display: 'none' } : undefined}>
        {splash}
      </pre>
      <pre id="instructions">{instructions}</pre>
      <pre id="output">
        {entries.map((entry, i) =>
          entry.kind === 'echo' ? (
            // Inside a <pre> the two <br>s and the literal \n are three breaks,
            // and the command is bold — the exact markup index.js produced.
            <Fragment key={i}>
              <br />
              <strong>{entry.command}</strong>
              {'\n'}
              <br />
            </Fragment>
          ) : (
            <Fragment key={i}>{entry.text}</Fragment>
          ),
        )}
      </pre>
      <div id="prompt">
        {/* `prompt.prepend(">")` landed before the source's whitespace text
            node, which collapses to one rendered space — hence "> ", not ">". */}
        {booted ? '>' : null}
        {booted ? ' ' : null}
        <span id="command-input">{commandInput}</span>
        <span id="cursor" className="blink">
          {booted ? '_' : null}
        </span>
      </div>
    </>
  );
}
