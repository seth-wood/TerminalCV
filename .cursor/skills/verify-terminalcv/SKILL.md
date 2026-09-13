---
name: verify-terminalcv
description: "Drive the terminalcv browser résumé (Next.js static CRT terminal) the way a user does — launch a disposable dev instance, type commands, and capture DOM + screenshot proof. Use when proving UI behavior for terminalcv, verifying command output, or after changes to the terminal shell/engine."
---

# Verify terminalcv

`terminalcv` is a single-page, client-side Next.js App Router site (`output: 'export'`). On a computer the user faces a retro terminal that accepts keyboard commands after a typewriter boot sequence. On a phone or tablet they see `Not mobile optimized. Please use a computer.` instead. There is no backend, auth, or database. Unit tests (Vitest) are DOM-free and do **not** replace this skill — UI proof must drive a real browser.

## Launch

Always start an instance this skill owns. Do not drive a stranger's `localhost:3000`.

```bash
export PATH="$PWD/.cursor/skills/verify-terminalcv/helpers:$PATH"
# First time in a checkout (or after helper dependency changes):
( cd .cursor/skills/verify-terminalcv/helpers && npm install )

control-terminalcv launch
# optional: control-terminalcv launch --port 3017
```

What launch does:

- Picks a free loopback port (or uses `--port`) and runs `npm run dev -- -p <port> -H 127.0.0.1` from the repo root.
- Waits until `http://127.0.0.1:<port>` answers.
- Starts headless system Chrome with a remote-debugging port and opens the app.
- Writes run state to `/tmp/terminalcv-verify-current.json` (override with `VERIFY_STATE`) and a scratch dir under `/tmp/terminalcv-verify-run-*/`.

Ready signal for the **server**: HTTP response from the launch URL. Ready signal for the **UI** (boot finished): run `control-terminalcv wait-boot` — requires `#cursor` text `_`, `#prompt` containing `>`, and `#instructions` exactly:

`Enter a command. Type 'help' for additional commands.`

Boot takes several seconds (1s wait + splash typewriter at 5ms/char + 0.5s wait + instructions typewriter). Do not type commands before `wait-boot` succeeds.

Optional analytics (`NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST`) are unused for verification; leave them unset.

Teardown: `control-terminalcv cleanup` (see Cleanup).

## Doctor

Read-only health check for the instance launched by this run:

```bash
control-terminalcv doctor
```

Require all of:

- JSON `"ok": true` (exit code 0)
- `pidAlive` / `chromeAlive` true for the pids recorded at launch
- `httpStatus` in 200–399 for the launch URL
- `ownsPort` true (doctor URL matches launch URL)
- `title` equal to `terminal v.01`

If anything looks off mid-run, re-run doctor before the next drive. A failed drive → doctor again (or cleanup + relaunch) rather than pushing keys into a wedged session.

## Drive

Harness: `control-terminalcv` (Playwright-core over Chrome CDP). The app has **no** `<input>` — it listens for `keydown` on `document` after boot. Stable DOM ids (prefer these over coordinates):

| Handle | Role |
| --- | --- |
| `#asciiText` | Splash art (`content/splash.txt`, inlined at build) |
| `#instructions` | Boot hint line |
| `#output` | Command echo + typewriter scrollback |
| `#prompt` | `>` once booted |
| `#command-input` | Live command buffer (not a form field) |
| `#cursor` | Blinking `_` once booted |
| `#computer-required` | Mobile gate message (`Not mobile optimized. Please use a computer.`) when the visitor is a phone or tablet |

Recipe:

```bash
control-terminalcv wait-boot
control-terminalcv cmd help
control-terminalcv text --sel output          # assert scrollback
control-terminalcv snapshot --path <evidence>/snapshot.txt
control-terminalcv screenshot --path <evidence>/screen.png
```

`cmd <tokens...>` types into the page (verifies `#command-input` mirrors the string), presses Enter, then waits until `#output` text is idle (`--settle-ms`, default 350).

User commands the engine accepts (case-insensitive; leading/trailing spaces are **not** trimmed — they become unknown commands):

| Command | Observable result |
| --- | --- |
| `help` | `#output` gains echo `help` then typewritten help listing `1`/`2`/`3`/`download`/`github`/`help`/`clear` |
| `1` | Fetches `/asciiresume.txt`, types résumé (markers: `Seth Wood`, `AVALARA`) |
| `2` | Fetches `/projects.txt` (markers: `CREATIVE PROJECTS`, `KEEPER`) |
| `3` | Fetches `/about.txt` (markers: `ABOUT:`, `My name is Seth`) |
| `clear` | Hides splash (`#asciiText` → `display: none`), empties `#output`, does **not** echo `clear`; `#instructions` stay |
| `download` | Echoes `download`, `window.open('/SethWoodResume.pdf')` |
| `github` | Echoes `github`, `window.open('https://github.com/seth-wood')` |
| unknown | Echo + `Unknown command: …` / `Enter 'help' to see a list of commands.` |

Feature recipes live in [`features/`](./features/README.md). Drive mapped entry points from those files; do not invent alternate UX.

## Evidence

Put proof **outside** the ephemeral run dir so cleanup cannot eat it. Convention:

```text
.cursor/skills/verify-terminalcv/artifacts/<feature-id>/
  snapshot.txt      # from control-terminalcv snapshot
  screen.png        # from control-terminalcv screenshot
  cmd.json          # optional: raw stdout from control-terminalcv cmd
```

Proof standards:

- Exercise the real keyboard path (`cmd`), not engine unit tests or internal setters.
- Capture the action and the resulting `#output` (and splash visibility for `clear`), not only a final screenshot.
- For `1`/`2`/`3`, assert distinctive document markers after output settles (typewriter + fetch gate).
- For `download`/`github`, assert the command echo in `#output`; treat the new tab/URL as a side effect (popup may be blocked in headless — echo is the reliable UI proof; optional CDP target attach if available).
- Record the feature id and entry point with the artifacts.
- Mocks: none required — content is static files under `public/`.

## Cleanup

```bash
control-terminalcv cleanup
```

Kills **only** the Next pid and Chrome pid recorded at launch (SIGTERM, then SIGKILL if needed). Removes `/tmp/terminalcv-verify-run-*` scratch and the current-state pointer. **Never** deletes files under `.cursor/skills/verify-terminalcv/artifacts/` or other caller-chosen evidence paths.

After every failed iteration, run cleanup before relaunching so ports and Chrome profiles are not stranded.

## Helpers

| Helper | Invocation |
| --- | --- |
| `control-terminalcv` | `.cursor/skills/verify-terminalcv/helpers/control-terminalcv <subcommand>` |

Subcommands: `launch`, `doctor`, `wait-boot`, `wait-gate`, `emulate`, `cmd`, `text`, `snapshot`, `screenshot`, `cleanup`.

`emulate --preset mobile|desktop` relaunches Chrome with matching `--blink-settings` (hover/pointer) and viewport. Use `wait-gate` after mobile emulate to assert `#computer-required` is visible and terminal ids are absent. Launch defaults to the desktop preset so headless Chrome still boots the CRT.

Dependency: `playwright-core` installed in `helpers/` via that folder's `package.json` (`npm install` there). Uses system Chrome (`VERIFY_CHROME_PATH` or common `/usr/bin/google-chrome*` paths).

Isolation: each `launch` binds its own loopback port and Chrome user-data dir. Two verification runs can coexist on different ports; still refuse to drive any instance whose pids are not in the current run state.
