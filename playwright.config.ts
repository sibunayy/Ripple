import { defineConfig, devices } from '@playwright/test';

// Which build the parity tests run against.
//   RF_TARGET=legacy (default): the untouched prototype in legacy/
//   RF_TARGET=app: the ported Vite app, built and served by vite preview
//   RF_TARGET=dev: the ported Vite app on the dev server
const target = process.env.RF_TARGET || 'legacy';
const PORT = 4319; // uncommon port, so other local dev servers (Vite uses 4173/5173) do not clash
const servers = {
  legacy: { command: `node scripts/serve-static.mjs legacy ${PORT}`, url: `http://127.0.0.1:${PORT}/ripple-flow-console.html` },
  // The production build, as it will be deployed.
  app: { command: `npx vite build && npx vite preview --host 127.0.0.1 --port ${PORT + 1} --strictPort`, url: `http://127.0.0.1:${PORT + 1}/` },
  // The dev server (npm run dev).
  dev: { command: `npx vite --host 127.0.0.1 --port ${PORT + 2} --strictPort`, url: `http://127.0.0.1:${PORT + 2}/` },
};
const server = servers[target as keyof typeof servers];
if (!server) throw new Error(`Unknown RF_TARGET "${target}"`);
process.env.RF_URL = server.url;

const ipad = { ...devices['Desktop Safari'], hasTouch: true, deviceScaleFactor: 1 };

export default defineConfig({
  testDir: 'tests/parity',
  timeout: 30_000,
  expect: { toHaveScreenshot: { maxDiffPixels: 0 } },
  fullyParallel: true,
  reporter: [['list']],
  // One shared set of reference screenshots for every target, so the port is compared with the legacy file.
  snapshotPathTemplate: 'tests/reference/{projectName}/{arg}{ext}',
  use: { baseURL: server.url, trace: 'retain-on-failure' },
  webServer: { command: server.command, url: server.url, reuseExistingServer: false, timeout: 120_000 },
  projects: [
    { name: 'webkit-landscape', use: { ...ipad, viewport: { width: 1180, height: 820 } } },
    { name: 'webkit-portrait', use: { ...ipad, viewport: { width: 820, height: 1180 } } },
    // Desktop Chromium: covers the MP4 encode path (WebCodecs) and is the secondary target.
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1180, height: 820 } }, testMatch: /0[08]-.*\.spec\.ts/,
      // Chromium anti-aliases a few edge pixels differently from run to run; WebKit (the target) stays at zero.
      expect: { toHaveScreenshot: { maxDiffPixels: 40 } } },
  ],
});
