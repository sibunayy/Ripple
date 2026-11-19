import { defineConfig } from 'vitest/config';

// Unit tests for the pure logic (HANDOFF phase 4). happy-dom supplies DOMMatrix, Blob and
// localStorage, which the animation and export modules use. The UI parity suite stays in Playwright.
export default defineConfig({
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'happy-dom', setupFiles: ['tests/unit/setup.ts'] },
});
