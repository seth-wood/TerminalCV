import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Only the splash art is read at build time, because only the splash is
 * server-rendered. The resume, projects and about documents live in `public/`
 * and are fetched by the renderer when the user asks for them — keeping them
 * (and the contact details in the resume) out of the served HTML.
 *
 * A missing splash is still a build failure rather than a 404.
 */
export const splash: string = readFileSync(
  join(process.cwd(), 'content', 'splash.txt'),
  'utf8',
);
