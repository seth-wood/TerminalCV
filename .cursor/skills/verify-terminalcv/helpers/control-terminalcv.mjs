#!/usr/bin/env node
/**
 * Verification harness for terminalcv.
 * Launch / doctor / drive the browser terminal via Playwright + system Chrome.
 *
 * State lives under /tmp/terminalcv-verify-<runId>/ (or VERIFY_RUN_DIR).
 * Evidence paths are caller-chosen and are never deleted by cleanup.
 */

import { spawn } from 'node:child_process';
import {
  access,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

import { chromium } from 'playwright-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const DEFAULT_STATE_LINK = '/tmp/terminalcv-verify-current.json';
const CHROME_CANDIDATES = [
  process.env.VERIFY_CHROME_PATH,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/local/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const SELECTORS = {
  ascii: '#asciiText',
  instructions: '#instructions',
  output: '#output',
  prompt: '#prompt',
  commandInput: '#command-input',
  cursor: '#cursor',
  computerRequired: '#computer-required',
};

const EMULATE_PRESETS = {
  mobile: {
    viewport: { width: 390, height: 844 },
    blinkSettings:
      'primaryHoverType=1,availableHoverTypes=1,primaryPointerType=2,availablePointerTypes=2',
  },
  desktop: {
    viewport: { width: 1100, height: 900 },
    blinkSettings:
      'primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4',
  },
};

const GATE_COPY = 'Not mobile optimized. Please use a computer.';

async function locatorText(page, selector) {
  const loc = page.locator(selector);
  if ((await loc.count()) === 0) return '';
  return (await loc.textContent({ timeout: 0 }).catch(() => '')) ?? '';
}

function usage(exitCode = 1) {
  const text = `Usage:
  control-terminalcv launch [--port <n>] [--repo <path>]
  control-terminalcv doctor [--url <url>]
  control-terminalcv wait-boot [--timeout-ms <n>]
  control-terminalcv wait-gate [--timeout-ms <n>]
  control-terminalcv emulate --preset mobile|desktop
  control-terminalcv cmd <command...> [--settle-ms <n>] [--timeout-ms <n>]
  control-terminalcv text [--sel ascii|instructions|output|prompt|commandInput|cursor|computerRequired]
  control-terminalcv snapshot --path <file>
  control-terminalcv screenshot --path <file>
  control-terminalcv cleanup

Env:
  VERIFY_RUN_DIR   Absolute run directory (created on launch if missing)
  VERIFY_STATE     Path to current-run pointer JSON (default ${DEFAULT_STATE_LINK})
  VERIFY_CHROME_PATH  Chrome/Chromium binary
`;
  process.stderr.write(text);
  process.exit(exitCode);
}

function argsAfter(flag, argv) {
  const i = argv.indexOf(flag);
  if (i === -1) return null;
  return argv[i + 1] ?? null;
}

function hasFlag(flag, argv) {
  return argv.includes(flag);
}

async function pathExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function findFreePort() {
  return await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      server.close((err) => (err ? reject(err) : resolvePort(port)));
    });
    server.on('error', reject);
  });
}

async function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    if (await pathExists(candidate)) return candidate;
  }
  throw new Error(
    'No Chrome/Chromium binary found. Set VERIFY_CHROME_PATH to a browser executable.',
  );
}

async function readState() {
  const statePath = process.env.VERIFY_STATE || DEFAULT_STATE_LINK;
  if (!(await pathExists(statePath))) {
    throw new Error(
      `No verification run state at ${statePath}. Run launch first.`,
    );
  }
  return JSON.parse(await readFile(statePath, 'utf8'));
}

async function writeState(state) {
  const statePath = process.env.VERIFY_STATE || DEFAULT_STATE_LINK;
  await writeFile(statePath, JSON.stringify(state, null, 2) + '\n');
  await writeFile(join(state.runDir, 'state.json'), JSON.stringify(state, null, 2) + '\n');
}

async function waitForHttp(url, timeoutMs = 60_000) {
  const start = Date.now();
  let lastErr = '';
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status >= 200 && res.status < 500) return res.status;
      lastErr = `HTTP ${res.status}`;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${url} (${lastErr})`);
}

async function withPage(fn) {
  const state = await readState();
  if (!state.browserWSEndpoint) {
    throw new Error('Run state has no browserWSEndpoint; relaunch.');
  }
  const browser = await chromium.connectOverCDP(state.browserWSEndpoint);
  try {
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page =
      context.pages().find((p) => p.url().startsWith(state.url)) ??
      context.pages()[0] ??
      (await context.newPage());
    if (!page.url().startsWith(state.url)) {
      await page.goto(state.url, { waitUntil: 'domcontentloaded' });
    }
    return await fn(page, state, browser);
  } finally {
    // connectOverCDP close disconnects this client and leaves Chrome running.
    await browser.close().catch(() => {});
  }
}

async function killChrome(state) {
  if (state.chromePid) {
    try {
      process.kill(state.chromePid, 'SIGTERM');
    } catch {
      /* gone */
    }
    await sleep(300);
    try {
      process.kill(state.chromePid, 0);
      process.kill(state.chromePid, 'SIGKILL');
    } catch {
      /* gone */
    }
    for (let i = 0; i < 20; i++) {
      try {
        process.kill(state.chromePid, 0);
        await sleep(100);
      } catch {
        break;
      }
    }
  }
  if (
    state.chromeUserDataDir &&
    state.runDir &&
    state.chromeUserDataDir.startsWith(state.runDir)
  ) {
    await rm(state.chromeUserDataDir, { recursive: true, force: true });
  }
}

async function launchChrome(state) {
  const presetName = state.emulatePreset || 'desktop';
  const preset = EMULATE_PRESETS[presetName];
  if (!preset) {
    throw new Error(`Unknown emulate preset: ${presetName}`);
  }
  const chromePath = state.chromePath || (await findChrome());
  const debugPort = await findFreePort();
  const userDataDir = join(state.runDir, `chrome-profile-${presetName}`);
  await mkdir(userDataDir, { recursive: true });
  const chromeLog = join(state.runDir, 'chrome.log');
  const chromeFd = await import('node:fs').then((fs) =>
    fs.openSync(chromeLog, 'a'),
  );
  const chrome = spawn(
    chromePath,
    [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      `--window-size=${preset.viewport.width},${preset.viewport.height}`,
      `--blink-settings=${preset.blinkSettings}`,
      state.url,
    ],
    {
      stdio: ['ignore', chromeFd, chromeFd],
      detached: true,
      env: process.env,
    },
  );
  chrome.unref();

  const wsUrl = await waitForDebuggerUrl(debugPort, 30_000);
  const attached = await chromium.connectOverCDP(wsUrl);
  const ctx = attached.contexts()[0] ?? (await attached.newContext());
  let page = ctx.pages()[0];
  if (!page) page = await ctx.newPage();
  await page.setViewportSize(preset.viewport);
  if (!page.url().startsWith(state.url)) {
    await page.goto(state.url, { waitUntil: 'domcontentloaded' });
  }
  await attached.close();

  state.chromePath = chromePath;
  state.browserWSEndpoint = wsUrl;
  state.chromeDebugPort = debugPort;
  state.chromePid = chrome.pid;
  state.chromeLog = chromeLog;
  state.chromeUserDataDir = userDataDir;
}

async function cmdLaunch(argv) {
  const repo = resolve(argsAfter('--repo', argv) || REPO_ROOT);
  const portFlag = argsAfter('--port', argv);
  const port = portFlag ? Number(portFlag) : await findFreePort();
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid --port: ${portFlag}`);
  }

  const runId = `run-${Date.now()}-${port}`;
  const runDir =
    process.env.VERIFY_RUN_DIR || join('/tmp', `terminalcv-verify-${runId}`);
  await mkdir(runDir, { recursive: true });

  const url = `http://127.0.0.1:${port}`;
  const logPath = join(runDir, 'next-dev.log');
  const logFd = await writeFile(logPath, '', { flag: 'w' }).then(() =>
    import('node:fs').then((fs) => fs.openSync(logPath, 'a')),
  );

  const child = spawn('npm', ['run', 'dev', '--', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: repo,
    env: {
      ...process.env,
      PORT: String(port),
      BROWSER: 'none',
    },
    stdio: ['ignore', logFd, logFd],
    detached: true,
  });
  child.unref();

  try {
    await waitForHttp(url, 90_000);
  } catch (err) {
    try {
      process.kill(child.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
    throw err;
  }

  const state = {
    runId,
    runDir,
    repo,
    port,
    url,
    pid: child.pid,
    logPath,
    launchedAt: new Date().toISOString(),
    emulatePreset: 'desktop',
  };
  await launchChrome(state);
  await writeState(state);

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        url: state.url,
        port: state.port,
        runDir: state.runDir,
        pid: state.pid,
        chromePid: state.chromePid,
      },
      null,
      2,
    ) + '\n',
  );
}

async function waitForDebuggerUrl(debugPort, timeoutMs) {
  const start = Date.now();
  const probe = `http://127.0.0.1:${debugPort}/json/version`;
  let lastErr = '';
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(probe);
      if (res.ok) {
        const body = await res.json();
        if (body.webSocketDebuggerUrl) return body.webSocketDebuggerUrl;
        lastErr = 'missing webSocketDebuggerUrl';
      } else {
        lastErr = `HTTP ${res.status}`;
      }
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
    await sleep(150);
  }
  throw new Error(`Chrome debugger not ready on ${debugPort}: ${lastErr}`);
}

async function cmdDoctor(argv) {
  const state = await readState();
  const url = argsAfter('--url', argv) || state.url;
  const report = {
    ok: true,
    url,
    expectedUrl: state.url,
    port: state.port,
    pidAlive: false,
    chromeAlive: false,
    httpStatus: null,
    title: null,
    ownsPort: false,
    booted: false,
    issues: [],
  };

  try {
    process.kill(state.pid, 0);
    report.pidAlive = true;
  } catch {
    report.issues.push(`next pid ${state.pid} is not running`);
    report.ok = false;
  }

  if (state.chromePid) {
    try {
      process.kill(state.chromePid, 0);
      report.chromeAlive = true;
    } catch {
      report.issues.push(`chrome pid ${state.chromePid} is not running`);
      report.ok = false;
    }
  }

  try {
    const res = await fetch(url, { redirect: 'manual' });
    report.httpStatus = res.status;
    if (res.status < 200 || res.status >= 400) {
      report.issues.push(`HTTP ${res.status} from ${url}`);
      report.ok = false;
    }
  } catch (err) {
    report.issues.push(
      `fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    report.ok = false;
  }

  if (url !== state.url) {
    report.issues.push(`url mismatch: doctor url ${url} != launch url ${state.url}`);
    report.ok = false;
  } else {
    report.ownsPort = true;
  }

  if (report.httpStatus && report.chromeAlive) {
    try {
      await withPage(async (page) => {
        report.title = await page.title();
        if (report.title !== 'terminal v.01') {
          report.issues.push(`unexpected title: ${report.title}`);
          report.ok = false;
        }
        const cursor = await locatorText(page, SELECTORS.cursor);
        const prompt = await locatorText(page, SELECTORS.prompt);
        report.booted = cursor.includes('_') && prompt.includes('>');
      });
    } catch (err) {
      report.issues.push(
        `browser probe failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      report.ok = false;
    }
  }

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (!report.ok) process.exit(2);
}

async function waitBoot(page, timeoutMs) {
  const start = Date.now();
  const expected =
    "Enter a command. Type 'help' for additional commands.";
  while (Date.now() - start < timeoutMs) {
    const cursor = await locatorText(page, SELECTORS.cursor);
    const instructions = await locatorText(page, SELECTORS.instructions);
    const prompt = await locatorText(page, SELECTORS.prompt);
    if (
      cursor.includes('_') &&
      prompt.includes('>') &&
      instructions === expected
    ) {
      return;
    }
    await sleep(100);
  }
  throw new Error(`Boot not ready within ${timeoutMs}ms`);
}

async function cmdWaitBoot(argv) {
  const timeoutMs = Number(argsAfter('--timeout-ms', argv) || 30_000);
  await withPage(async (page) => {
    await page.bringToFront();
    await page.locator('body').click({ position: { x: 8, y: 8 } }).catch(() => {});
    await waitBoot(page, timeoutMs);
  });
  process.stdout.write(JSON.stringify({ ok: true, booted: true }) + '\n');
}

async function waitGate(page, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const gateCount = await page.locator(SELECTORS.computerRequired).count();
    const promptCount = await page.locator(SELECTORS.prompt).count();
    const cursorCount = await page.locator(SELECTORS.cursor).count();
    if (gateCount === 1 && promptCount === 0 && cursorCount === 0) {
      const text =
        (await page.locator(SELECTORS.computerRequired).textContent()) ?? '';
      if (text === GATE_COPY) {
        return;
      }
    }
    await sleep(100);
  }
  throw new Error(`Gate not ready within ${timeoutMs}ms`);
}

async function cmdWaitGate(argv) {
  const timeoutMs = Number(argsAfter('--timeout-ms', argv) || 10_000);
  await withPage(async (page) => {
    await page.bringToFront();
    await waitGate(page, timeoutMs);
  });
  process.stdout.write(JSON.stringify({ ok: true, gated: true }) + '\n');
}

async function cmdEmulate(argv) {
  const preset = argsAfter('--preset', argv);
  if (!preset || !EMULATE_PRESETS[preset]) {
    throw new Error(
      `Missing or invalid --preset. Use: ${Object.keys(EMULATE_PRESETS).join(', ')}`,
    );
  }
  const state = await readState();
  await killChrome(state);
  state.emulatePreset = preset;
  await launchChrome(state);
  await writeState(state);
  process.stdout.write(JSON.stringify({ ok: true, preset }) + '\n');
}

async function waitOutputIdle(page, { timeoutMs, settleMs }) {
  const start = Date.now();
  let last = null;
  let stableSince = Date.now();
  while (Date.now() - start < timeoutMs) {
    const text = (await page.locator(SELECTORS.output).innerText()) ?? '';
    if (text === last) {
      if (Date.now() - stableSince >= settleMs) return text;
    } else {
      last = text;
      stableSince = Date.now();
    }
    await sleep(50);
  }
  throw new Error(`Output did not settle within ${timeoutMs}ms`);
}

async function cmdCmd(argv) {
  const settleMs = Number(argsAfter('--settle-ms', argv) || 350);
  const timeoutMs = Number(argsAfter('--timeout-ms', argv) || 60_000);
  // Collect command tokens: everything that is not a flag/flag-value after "cmd"
  const raw = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--settle-ms' || a === '--timeout-ms') {
      i += 1;
      continue;
    }
    raw.push(a);
  }
  const command = raw.join(' ');
  if (!command && raw.length === 0) {
    // empty Enter is valid — allow `cmd --` or `cmd ''`
  }

  const result = await withPage(async (page) => {
    await page.bringToFront();
    await page.locator('body').click({ position: { x: 8, y: 8 } }).catch(() => {});
    // Ensure boot completed before accepting keys.
    await waitBoot(page, Math.min(timeoutMs, 30_000));

    const before = (await page.locator(SELECTORS.output).innerText()) ?? '';
    if (command.length > 0) {
      await page.keyboard.type(command, { delay: 15 });
    }
    // Confirm the buffer mirrors what we typed (empty command clears on Enter).
    if (command.length > 0) {
      const typed =
        (await page.locator(SELECTORS.commandInput).textContent()) ?? '';
      if (typed !== command) {
        throw new Error(
          `command-input mismatch: expected ${JSON.stringify(command)} got ${JSON.stringify(typed)}`,
        );
      }
    }
    await page.keyboard.press('Enter');
    const after = await waitOutputIdle(page, { timeoutMs, settleMs });
    const input =
      (await page.locator(SELECTORS.commandInput).textContent()) ?? '';
    const asciiDisplay = await page.locator(SELECTORS.ascii).evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.display;
    });
    return {
      ok: true,
      command,
      outputBefore: before,
      output: after,
      commandInput: input,
      asciiDisplay,
    };
  });

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

async function cmdText(argv) {
  const selKey = argsAfter('--sel', argv) || 'output';
  const selector = SELECTORS[selKey];
  if (!selector) {
    throw new Error(
      `Unknown --sel ${selKey}. Use: ${Object.keys(SELECTORS).join(', ')}`,
    );
  }
  const text = await withPage(async (page) => locatorText(page, selector));
  process.stdout.write(text);
  if (!text.endsWith('\n')) process.stdout.write('\n');
}

async function cmdSnapshot(argv) {
  const path = argsAfter('--path', argv);
  if (!path) usage(1);
  const abs = resolve(path);
  await mkdir(dirname(abs), { recursive: true });
  const snap = await withPage(async (page, state) => {
    const title = await page.title();
    const parts = {};
    for (const [key, sel] of Object.entries(SELECTORS)) {
      parts[key] = (await page.locator(sel).innerText().catch(() => '')) ?? '';
    }
    const asciiCount = await page.locator(SELECTORS.ascii).count();
    const asciiDisplay =
      asciiCount === 0
        ? 'absent'
        : await page.locator(SELECTORS.ascii).evaluate((el) => {
            return window.getComputedStyle(el).display;
          });
    return {
      capturedAt: new Date().toISOString(),
      url: state.url,
      title,
      asciiDisplay,
      ...parts,
    };
  });
  const body =
    [
      `url: ${snap.url}`,
      `title: ${snap.title}`,
      `capturedAt: ${snap.capturedAt}`,
      `asciiDisplay: ${snap.asciiDisplay}`,
      '',
      '--- asciiText ---',
      snap.ascii,
      '',
      '--- instructions ---',
      snap.instructions,
      '',
      '--- output ---',
      snap.output,
      '',
      '--- prompt ---',
      snap.prompt,
      '',
      '--- command-input ---',
      snap.commandInput,
      '',
      '--- cursor ---',
      snap.cursor,
      '',
      '--- computer-required ---',
      snap.computerRequired,
      '',
    ].join('\n') + '\n';
  await writeFile(abs, body);
  process.stdout.write(JSON.stringify({ ok: true, path: abs }) + '\n');
}

async function hideDevUi(page) {
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  });
}

async function cmdScreenshot(argv) {
  const path = argsAfter('--path', argv);
  if (!path) usage(1);
  const abs = resolve(path);
  await mkdir(dirname(abs), { recursive: true });
  await withPage(async (page) => {
    await hideDevUi(page);
    await page.screenshot({ path: abs, fullPage: false });
  });
  process.stdout.write(JSON.stringify({ ok: true, path: abs }) + '\n');
}

async function cmdCleanup() {
  let state;
  try {
    state = await readState();
  } catch (err) {
    process.stdout.write(
      JSON.stringify({
        ok: true,
        skipped: true,
        reason: err instanceof Error ? err.message : String(err),
      }) + '\n',
    );
    return;
  }

  const killed = { next: false, chrome: false };
  if (state.chromePid) {
    try {
      process.kill(state.chromePid, 'SIGTERM');
      killed.chrome = true;
    } catch {
      /* gone */
    }
  }
  if (state.pid) {
    try {
      process.kill(state.pid, 'SIGTERM');
      killed.next = true;
    } catch {
      /* gone */
    }
    // Next may leave children; try process group if spawned detached.
    try {
      process.kill(-state.pid, 'SIGTERM');
    } catch {
      /* no group or gone */
    }
  }

  // Give processes a moment, then SIGKILL leftovers we still own.
  await sleep(500);
  for (const pid of [state.chromePid, state.pid]) {
    if (!pid) continue;
    try {
      process.kill(pid, 0);
      process.kill(pid, 'SIGKILL');
    } catch {
      /* gone */
    }
  }

  // Remove run scratch (profile, logs, state) but never evidence dirs the
  // caller chose outside runDir — and never delete caller screenshot paths.
  if (state.runDir && state.runDir.startsWith('/tmp/terminalcv-verify-')) {
    await rm(state.runDir, { recursive: true, force: true });
  }

  const statePath = process.env.VERIFY_STATE || DEFAULT_STATE_LINK;
  await rm(statePath, { force: true });

  process.stdout.write(
    JSON.stringify({
      ok: true,
      killed,
      removedRunDir: state.runDir,
      evidenceNote:
        'Proof artifacts outside the run dir are retained; cleanup never deletes them.',
    }) + '\n',
  );
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || hasFlag('--help', argv) || hasFlag('-h', argv)) {
    usage(argv.length === 0 ? 1 : 0);
  }
  const cmd = argv[0];
  const rest = argv.slice(1);
  switch (cmd) {
    case 'launch':
      await cmdLaunch(rest);
      break;
    case 'doctor':
      await cmdDoctor(rest);
      break;
    case 'wait-boot':
      await cmdWaitBoot(rest);
      break;
    case 'wait-gate':
      await cmdWaitGate(rest);
      break;
    case 'emulate':
      await cmdEmulate(rest);
      break;
    case 'cmd':
      await cmdCmd(rest);
      break;
    case 'text':
      await cmdText(rest);
      break;
    case 'snapshot':
      await cmdSnapshot(rest);
      break;
    case 'screenshot':
      await cmdScreenshot(rest);
      break;
    case 'cleanup':
      await cmdCleanup();
      break;
    default:
      process.stderr.write(`Unknown command: ${cmd}\n`);
      usage(1);
  }
}

main().catch((err) => {
  process.stderr.write(
    (err instanceof Error ? err.stack || err.message : String(err)) + '\n',
  );
  process.exit(1);
});
