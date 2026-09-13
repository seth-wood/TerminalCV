# Mobile gate

On a phone or tablet the page shows a short message instead of mounting the terminal. A computer still gets the CRT boot sequence.

## Sub-features

- `gate-message` shows `Not mobile optimized. Please use a computer.` in `#computer-required` and does not mount the terminal.
- `desktop-terminal` on a computer (hover plus fine pointer) still boots the terminal normally.

## How to get to it (user POV)

- Open the site on a phone or tablet. The gate message appears instead of the terminal.
- Open the site on a computer. The terminal boots as usual.

## Driving it with control-terminalcv

Preconditions:

- `control-terminalcv doctor` reports `"ok": true` for this run's URL.

**Desktop path (terminal still mounts):**

- `control-terminalcv wait-boot` has succeeded.
- `control-terminalcv cmd help` — settled `#output` contains the help listing.
- Proof: `control-terminalcv snapshot --path .cursor/skills/verify-terminalcv/artifacts/mobile-gate/desktop-snapshot.txt` and `control-terminalcv screenshot --path .cursor/skills/verify-terminalcv/artifacts/mobile-gate/desktop-screen.png`. Snapshot shows `#prompt`, `#cursor`, and no `#computer-required` text.

**Mobile path (gate replaces terminal):**

- Run `control-terminalcv emulate --preset mobile` (`hover: none`, `pointer: coarse`, viewport 390×844, reloads).
- Run `control-terminalcv wait-gate` — `#computer-required` text is exactly `Not mobile optimized. Please use a computer.`; `#prompt` and `#cursor` counts are 0.
- Proof: `control-terminalcv text --sel computerRequired` prints `Not mobile optimized. Please use a computer.`; `control-terminalcv snapshot --path .cursor/skills/verify-terminalcv/artifacts/mobile-gate/mobile-snapshot.txt` and `control-terminalcv screenshot --path .cursor/skills/verify-terminalcv/artifacts/mobile-gate/mobile-screen.png`.

## Gotchas

- `wait-boot` is for the desktop terminal path only. Do not run it after `emulate --preset mobile`. The terminal is not mounted.
- Detection is `(hover: hover) and (pointer: fine)`, not viewport width. A narrow desktop window still shows the terminal.
- `emulate` stores the media preset on the run and reapplies it on every later command. Navigation resets emulated media, so the recipe must run `emulate` before `wait-gate` on the same launch.
- The gate is a full-viewport overlay (`100vw` × `100dvh`, grid-centered). Proof screenshots hide the Next.js portal and capture the viewport, not `fullPage`.
- To return to the desktop path, run `control-terminalcv emulate --preset desktop` before `wait-boot`.
