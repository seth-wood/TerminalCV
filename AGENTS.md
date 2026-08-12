# AGENTS.md

## Cursor Cloud specific instructions

`terminalcv` is a single-product, purely client-side Next.js 16 (App Router, `output: 'export'`) static site — a browser-based retro terminal that acts as an interactive résumé. There is no backend, database, or auxiliary service.

Standard commands live in `package.json` (`dev`, `build`, `start`, `lint`, `typecheck`, `test`) and in `README.md`; use those rather than duplicating them here.

Non-obvious notes:
- Dependencies are already installed by the startup update script (`npm ci`), so you do not need to reinstall before running commands.
- The dev server runs on `http://localhost:3000` (`npm run dev`, Turbopack). It binds to all interfaces, so it is reachable from the Desktop pane's browser.
- Tests (`npm test`, Vitest) run in the Node environment with no jsdom — the terminal engine (`src/engine/`) and typewriter queue (`components/Typewriter.tsx`) are deliberately DOM-free so they are unit-testable without a browser. Do not add jsdom to test browser rendering; test UI behavior manually in the browser instead.
- Content documents (résumé/projects/about) live in `public/` and are fetched on demand when a command is typed, while the splash art in `content/splash.txt` is inlined at build time — a missing splash is a build failure, not a 404.
