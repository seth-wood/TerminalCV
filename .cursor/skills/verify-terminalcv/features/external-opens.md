# External opens

External opens let a user trigger a new browser context for the PDF résumé or the GitHub profile while still echoing the command in the terminal.

## Sub-features

- `open-download` echoes `download` and opens `/SethWoodResume.pdf`.
- `open-github` echoes `github` and opens `https://github.com/seth-wood`.

## How to get to it (user POV)

- Type `download` and press Enter to open the résumé PDF.
- Type `github` and press Enter to open the GitHub profile.

## Driving it with control-terminalcv

Preconditions:

- Instance is healthy and booted.
- Headless Chrome may block or immediately close popups — treat `#output` echo as the required UI proof; treat URL open as best-effort side-effect observation.

- **Download.** Run `control-terminalcv cmd download`. Settled `#output` contains an echo line `download`. The page requested a new window/tab targeting `/SethWoodResume.pdf` (same origin as the app). Confirm the PDF is served with `curl -sI "$URL/SethWoodResume.pdf"` from the launch base URL showing HTTP 200 and a PDF content type when exercising the static asset separately.
- **GitHub.** Run `control-terminalcv cmd github`. Settled `#output` contains an echo line `github`. The intended URL is `https://github.com/seth-wood`.
- **Proof.** Run `control-terminalcv snapshot --path .cursor/skills/verify-terminalcv/artifacts/external-opens/snapshot.txt` and `control-terminalcv screenshot --path .cursor/skills/verify-terminalcv/artifacts/external-opens/screen.png`. Snapshot `#output` shows the `download` and/or `github` echo lines for the steps run.

## Gotchas

- Unlike content commands, these do not type document bodies into `#output` — only the echo appears.
- `window.open` runs synchronously on submit to preserve the user gesture; a popup blocker yields echo-without-tab, which is still acceptable UI proof for this map when the echo is present and the static PDF URL is independently reachable.
- Do not require navigation of the main page away from `/` — opens use `_blank`.
- Absolute path `/SethWoodResume.pdf` is root-absolute for static export hosting under a domain root; verification on `127.0.0.1:<port>` matches local dev.
