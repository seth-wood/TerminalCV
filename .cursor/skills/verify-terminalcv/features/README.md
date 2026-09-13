# terminalcv verification map

This directory is the maintained source for verifying the user-facing behavior of terminalcv. Read the index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch with `control-terminalcv launch` so the run owns a disposable loopback port and headless Chrome profile.
- Put `.cursor/skills/verify-terminalcv/helpers` on `PATH` (and `npm install` inside `helpers/` once).
- Run `control-terminalcv doctor` and require `"ok": true`, title `terminal v.01`, and live Next + Chrome pids.
- Run `control-terminalcv wait-boot` before the first command so `#prompt` shows `>`, `#cursor` shows `_`, and `#instructions` is complete.
- Never drive an instance that was not started by this verification run.

## Driving conventions

- Start every recipe from a freshly booted terminal unless the feature says otherwise. Use `clear` only when the recipe is testing clear or explicitly resets scrollback.
- Prefer the stable ids `#output`, `#command-input`, `#asciiText`, `#instructions`, `#prompt`, `#cursor` over coordinates.
- Treat every `control-terminalcv` invocation as literal. Keep command spellings unchanged.
- Type and submit only through `control-terminalcv cmd …` (document `keydown` path).
- Cleanup with `control-terminalcv cleanup` after the run. Do not remove proof artifacts under `artifacts/`.

## Proof and skip reporting

- Capture the typed command echo and the settled `#output` text, not only a final screenshot.
- UI proof includes a `snapshot.txt` (DOM dump) and a `screen.png` with the CRT green terminal visible and page title provenance in the snapshot header.
- Content commands (`1`/`2`/`3`) must show document markers from `public/*.txt` after the typewriter finishes.
- Record the feature ID and entry point used with every artifact.
- Report an unreachable path with the attempted command and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with control-terminalcv` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Help](./help.md) covers the `help` command and unknown-command guidance back to help.
- [Content documents](./content-documents.md) covers commands `1` / `2` / `3` (resume, projects, about).
- [Clear screen](./clear.md) covers wiping scrollback and hiding splash art.
- [External opens](./external-opens.md) covers `download` (PDF) and `github` (profile URL).
- [Mobile gate](./mobile-gate.md) covers the computer-required message on phones and tablets.
