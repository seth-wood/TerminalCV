
<img width="795" alt="Screenshot 2024-10-24 at 9 43 37 PM" src="https://github.com/user-attachments/assets/7543b65e-c9cd-43b1-8076-dd619af39219">

## Introduction

This project simulates a retro-style terminal interface in a browser, complete with ASCII art and command prompt functionality. Users can navigate through options like Resume, Projects, and About sections by typing commands, providing an interactive experience.

## Table of Contents
- [Introduction](#introduction)
- [Usage](#usage)
- [Features](#features)
- [File Structure](#file-structure)
- [Dependencies](#dependencies)
- [Configuration](#configuration)
- [Examples](#examples)
- [Contributors](#contributors)
- [License](#license)

## Usage
The project simulates a command-line interface. After loading the webpage, users can type the following commands:
- `1`: View ASCII Resume
- `2`: View Projects
- `3`: View About section
- `clear`: Clear the screen
- `help`: Display available commands
- `download`: Download the resume
- `github`: Redirect to the project's GitHub repository

## Features
- Retro terminal design with blinking cursor and ASCII art.
- Interactive command-line interface.
- Downloadable resume in PDF format.
- Links to other projects and GitHub profile.

## File Structure
The project consists of the following key files:
- **src/engine/**: The terminal itself — a pure TypeScript module with no DOM and no React. It maps an input to a description of what should happen (`CommandResult`); the renderer performs the effect. Unit-tested with Vitest.
- **components/Terminal.tsx**: The client shell — keyboard handling, the scrollback buffer, and the boot sequence.
- **components/Typewriter.tsx**: A single `requestAnimationFrame` loop that reveals text by elapsed time, and the job queue that orders it. DOM-free by construction — the scheduler and scrolling are injected — so it is unit-tested in Node without jsdom.
- **components/PostHogProvider.tsx**: Analytics init; renders nothing.
- **src/content/**: Reads `content/splash.txt` at build time for server rendering — a missing splash is a build failure, not a 404.
- **app/**: Next.js App Router entry points. `page.tsx` is a Server Component that passes the splash art to `<Terminal>`; `globals.css` styles the terminal.
- **content/**: The splash art, inlined into the served HTML at build time.
- **public/**: Static assets served as-is — the resume PDF, plus the resume, projects and about documents. These are fetched on demand when their command is typed, so they stay out of the served HTML rather than being inlined into every page load.

## Dependencies
Next.js (App Router, `output: 'export'`), React, and TypeScript. `posthog-js` for analytics; Vitest for the engine tests.

## Configuration
```bash
npm install
npm run dev     # http://localhost:3000
npm run build     # static export to out/
npm test          # engine + typewriter unit tests
npm run lint
npm run typecheck
```

## Examples
Here’s how the terminal interface looks:
```
 ____       _   _      __        __              _
/ ___|  ___| |_| |__   \ \      / /__   ___   __| |
\___ \ / _ \ __| '_ \   \ \ /\ / / _ \ / _ \ / _` |
 ___) |  __/ |_| | | |   \ V  V / (_) | (_) | (_| |
|____/ \___|\__|_| |_|    \_/\_/ \___/ \___/ \__,_|
                                                  
```
Type `help` to see available commands.

## Contributors
- Seth Wood

## License
This project is licensed under the MIT License.
