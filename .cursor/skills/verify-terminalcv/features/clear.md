# Clear screen

Clear removes the visible splash and empties the command scrollback so the user gets a blank terminal body while keeping the boot instructions line.

## Sub-features

- `clear-wipe` hides splash art and clears `#output` without echoing `clear`.
- `clear-mid-type` drops in-flight typewriter output when clear is submitted during typing.

## How to get to it (user POV)

- Type `clear` and press Enter.

## Driving it with control-terminalcv

Preconditions:

- Instance is healthy and booted.
- Seed visible scrollback first so clear has something to remove — for example run `control-terminalcv cmd help` and confirm `#output` contains `<commands>`.

- **Clear after help.** Run `control-terminalcv cmd clear`. `#output` becomes empty (no `clear` echo). `#asciiText` computed style `display` is `none`. `#instructions` still shows `Enter a command. Type 'help' for additional commands.` Prompt and cursor remain available for the next command.
- **Proof.** Run `control-terminalcv snapshot --path .cursor/skills/verify-terminalcv/artifacts/clear/snapshot.txt` and `control-terminalcv screenshot --path .cursor/skills/verify-terminalcv/artifacts/clear/screen.png`. Snapshot reports `asciiDisplay: none` and an empty `#output` section while instructions remain.

## Gotchas

- `clear` is immediate and skips the echo path — absence of a `clear` line in `#output` is expected, not a failure.
- Instructions are not cleared; only splash visibility and `#output` entries reset.
- After clear, splash stays hidden for the rest of the session even if new commands print output.
- To re-test splash visibility, relaunch (or full page reload + `wait-boot`) rather than expecting clear to restore art.
