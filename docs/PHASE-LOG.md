# Phase log

## Phase 0: baseline (done)

- `legacy/ripple-flow-console.html` is a read-only copy of `source/ripple-flow-console.html`. Do not edit it.
- Parity tests live in `tests/parity/` (Playwright). They drive the app only through the page (DOM, ARIA, the SVG stage, localStorage), so the same tests will run against the port.
- Reference screenshots are in `tests/reference/`: 11 views each for WebKit landscape (1180 × 820), WebKit portrait (820 × 1180) and desktop Chromium. They cover dark and light, the Layers panel, the Effects, Easing and Presets tabs, the inspector bottom, the dope sheet, the graph, the More menu and the Export dialog.
- Result: 220 tests pass on the legacy file (7 more are skipped on purpose because they apply to only one orientation). The full suite passed 3 times in a row (660 of 660).

### What the tests found in the prototype (ported as is, not fixed)

These are recorded so that nobody "fixes" them by accident during the port. Fix only with Nathan's approval.

1. The strip's Undo / Redo buttons do not update after Hide or Lock, because those actions only redraw the panels. Ctrl+Z and the two-finger tap still work.
2. Moving the playhead does not redraw the inspector, so the Drawing section's cel buttons (for example Clear) can show the state of the previous frame until the panel redraws.
3. A layer that fills the whole timeline cannot be slid in time (there is no room). Trim it first.
4. The brief says 25 effects. The source defines 23 (all 23 are in the Add effect menu and all are tested).
5. In portrait, the inspector sheet covers the right part of the quick action bar.

### Test environment notes

- Playwright's WebKit on Windows has no WebCodecs and no WebGPU. There, the MP4 test checks the app's "needs WebCodecs" message and shaders run on the WebGL2 fallback. Desktop Chromium runs the real MP4 encode. Real iPad Safari still needs a manual check in phase 5.
- Touch, Pencil (pressure and tilt), pinch and multi-finger taps are simulated with synthetic pointer and touch events. A small test-only shim lets `setPointerCapture` accept these synthetic pointers. App code is not changed.

## Phase 1: scaffold (done)

- Vite 6 + TypeScript 5 (build tools only; still no runtime dependencies). `npm run dev` starts the app, `npm run build` writes `dist/`, `npm run preview` serves the build.
- `index.html` holds the DOM skeleton, copied verbatim. `src/legacy-main.ts` holds the whole prototype script, copied verbatim (with `// @ts-nocheck` for now).
- The CSS is split into `src/styles/00-host.css` … `11-inspector-v8.css` and imported in the source order through `src/styles/index.css`. The v8 inspector pass loads last. `scripts/extract-phase1.mjs` made the split and checks that the joined CSS equals the source byte for byte.
- CSS minification is off in the build so the CSS text stays exactly as written.
- The build uses relative paths (`base: './'`), so it works from any folder, including a GitHub Pages sub-path.
- Result: all 220 parity tests pass on the build (`npm run test:parity:app`) and on the dev server (`RF_TARGET=dev`). All 33 screenshots match the reference with zero pixel difference in WebKit.

### Quirk found while porting (kept)

6. The text-animator rule `.anim:first-child { padding-top: 0; border-top: 0 }` also matches the app frame (`<div class="app anim">`) when it is the first element in `<body>`. In the prototype a `<style>` tag came first, so the frame kept a 6 px top padding and a 1 px top line. `index.html` keeps an element (`<noscript>`) before the frame so the look stays the same.

### Test change

- The export Cancel test now waits up to 30 s for the cancel to take effect, because the export checks for Cancel between frames and one 4K frame can take several seconds on the dev server.
