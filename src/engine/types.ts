/** The three long-form documents, fetched by the renderer on demand. */
export type ContentId = 'resume' | 'projects' | 'about';

export type CommandResult =
  /** Text the engine itself produced — help, errors, the empty-input newline. */
  | { kind: 'text'; text: string; delayMs: number }
  /** A document the renderer must load before it can type it. */
  | { kind: 'content'; id: ContentId; delayMs: number }
  | { kind: 'clear' }
  | { kind: 'openUrl'; url: string };

export interface EngineDeps {
  // No content here: the documents are fetched at command time, so the engine
  // names them instead of carrying them. Keeps the resume out of the payload.
  githubUrl: string;
  resumeUrl: string;
}
