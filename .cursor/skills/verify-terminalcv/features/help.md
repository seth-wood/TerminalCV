# Help

Help shows the built-in command list in the terminal scrollback so a user can discover resume, projects, about, download, github, and clear.

## Sub-features

- `help-list` types `help` and prints the full usage block into `#output`.
- `help-unknown` rejects an unknown token and tells the user to run `help`.

## How to get to it (user POV)

- After boot, type `help` and press Enter.
- Type any unrecognized token (for example `xyz`) and press Enter to see the unknown-command line that points at `help`.

## Driving it with control-terminalcv

Preconditions:

- `control-terminalcv doctor` reports `"ok": true` for this run's URL.
- `control-terminalcv wait-boot` has succeeded.
- `#output` is empty (fresh boot) or the recipe accounts for prior scrollback.

- **Open help.** Type `help` and submit. Run `control-terminalcv cmd help`. `#command-input` clears after Enter. Settled `#output` contains a bold-style echo line `help` and the typewritten block beginning with `<commands>` including the lines `1           resume`, `2           projects`, `3           about me`, `download    resume in pdf`, `github      portfolio`, `help        this help text`, and `clear       clear the screen`.
- **Unknown command.** Type a token that is not a command. Run `control-terminalcv cmd xyz`. Settled `#output` appends echo `xyz` and the text `Unknown command: xyz` plus `Enter 'help' to see a list of commands.`
- **Proof.** Dump DOM and screenshot. Run `control-terminalcv snapshot --path .cursor/skills/verify-terminalcv/artifacts/help/snapshot.txt` and `control-terminalcv screenshot --path .cursor/skills/verify-terminalcv/artifacts/help/screen.png`. The snapshot `#output` section shows the help usage block (and unknown text if that step was run).

## Gotchas

- Keys typed before `wait-boot` finishes are ignored — the key listener mounts only after boot.
- Commands are matched lowercased, but the echo preserves the typed case (`HELP` still works; echo shows `HELP`).
- Leading or trailing spaces are not trimmed (` help ` is unknown).
- Help text is typewritten at 5ms per character — assert after `cmd` returns (output idle), not immediately after keypress.
- Do not use Vitest engine tests as proof of this UI path.
