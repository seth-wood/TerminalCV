import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The engine and the animation queue are both DOM-free by construction, so
    // they run in node — no jsdom needed.
    environment: 'node',
    include: ['{src,components}/**/*.test.{ts,tsx}'],
  },
});
