# Mobile gate

On devices without hover and fine pointer (typical phones and tablets), the page shows a short message instead of mounting the terminal.

## Sub-features

- `gate-message` shows `Please use a computer.` in `#computer-required` and does not mount the terminal.
- `desktop-terminal` on desktop-class hover/pointer capabilities still boots the terminal normally.

## How to get to it (user POV)

- Open the site on a phone or tablet (no hover, coarse pointer) — the gate message appears instead of the terminal.
- Open the site on a desktop or laptop with a mouse/trackpad — the terminal boots as usual.

## Driving it with control-terminalcv

Preconditions:

- `control-terminalcv doctor` reports `"ok": true` for this run's URL.

**Desktop path (terminal still mounts):**

- `control-terminalcv wait-boot` has succeeded.
- `control-terminalcv cmd help` — settled `#output` contains the help listing.
- Proof: `control-terminalcv snapshot --path .cursor/skills/verify-terminalcv/artifacts/mobile-gate/desktop-snapshot.txt` and `control-terminalcv screenshot --path .cursor/skills/verify-terminalcv/artifacts/mobile-gate/desktop-screen.png`. Snapshot shows `#prompt`, `#cursor`, and no `#computer-required` text.

**Mobile path (gate replaces terminal):**

- Run `control-terminalcv emulate --preset mobile` (sets viewport 390×844, `hover: none`, `pointer: coarse`, reloads).
- Run `control-terminalcv wait-gate` — `#computer-required` text is exactly `Please use a computer.`; `#prompt` and `#cursor` counts are 0.
- Proof: `control-terminalcv text --sel computerRequired` prints `Please use a computer.`; `control-terminalcv snapshot --path .cursor/skills/verify-terminalcv/artifacts/mobile-gate/mobile-snapshot.txt` and `control-terminalcv screenshot --path .cursor/skills/verify-terminalcv/artifacts/mobile-gate/mobile-screen.png`.

## Gotchas

- `wait-boot` is for the desktop terminal path only — do not run it after `emulate --preset mobile`; the terminal is not mounted.
- Detection uses `(hover: hover) and (pointer: fine)`, not viewport width. A narrow desktop window still shows the terminal if hover/pointer are fine.
- `emulate` reloads the page after setting CDP media features so the first paint reflects the emulated capabilities.
- To return to desktop emulation for another recipe, run `control-terminalcv emulate --preset desktop` before `wait-boot`.
