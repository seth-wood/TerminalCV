# Content documents

Content documents let a user load the résumé, projects list, or about blurb into the terminal by typing `1`, `2`, or `3`. Each document is fetched from static files under `public/` and typed into `#output`.

## Sub-features

- `content-resume` loads the ASCII résumé via `1`.
- `content-projects` loads creative projects via `2`.
- `content-about` loads the about section via `3`.

## How to get to it (user POV)

- Type `1` and press Enter for the résumé.
- Type `2` and press Enter for projects.
- Type `3` and press Enter for about.
- The splash menu line `1. Resume | 2. Projects | 3. About` is only a hint — there is no mouse target; typing the digit is the entry point.

## Driving it with control-terminalcv

Preconditions:

- Instance is healthy (`doctor`) and booted (`wait-boot`).
- Prefer a fresh boot or a prior `clear` so markers are easy to spot in `#output`.
- `/asciiresume.txt`, `/projects.txt`, and `/about.txt` must be served (default `public/` in this repo).

- **Resume.** Run `control-terminalcv cmd 1`. Settled `#output` echoes `1` and includes `Seth Wood` and `AVALARA` from the résumé document.
- **Projects.** Run `control-terminalcv cmd 2`. Settled `#output` echoes `2` and includes `CREATIVE PROJECTS` and `KEEPER`.
- **About.** Run `control-terminalcv cmd 3`. Settled `#output` echoes `3` and includes `ABOUT:` and `My name is Seth`.
- **Proof.** For the command under test, run `control-terminalcv snapshot --path .cursor/skills/verify-terminalcv/artifacts/content-documents/snapshot.txt` and `control-terminalcv screenshot --path .cursor/skills/verify-terminalcv/artifacts/content-documents/screen.png`. The snapshot `#output` section contains the markers for that document.

## Gotchas

- Output is gated on the fetch finishing, then typewritten (resume at 2ms/char; projects/about at 5ms/char). Wait for `cmd` to settle; a fixed short sleep is not enough on slow CI.
- A failed fetch surfaces `Could not load that. Check your connection and try again.` — treat that as environment failure, not a pass.
- Re-running the same content command uses the in-memory cache; markers should still appear.
- Typing a second command while content is still typing queues behind the gate — finish one `cmd` before starting the next in serial verification.
