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

## Phase 2: split into modules (done)

- The script is now 92 TypeScript modules in `src/` (layout below). The code inside each function is unchanged; the split was done by tools in `scripts/split/` that read the code's structure with the TypeScript checker, not by hand.
- Shared document state stays in one place: `layers`, `markers`, `DUR`, `projName` and `compBg` live in `model/project.ts`; the UI state `S` in `state/state.ts`. Undo and redo still replace `layers`, and every module reads the current value.
- A variable that other modules change gets a small setter (for example `setLayers`, `setDragging`, `setSuppressClick`). The setters only assign; nothing else changed.
- Event listeners are registered by a `listen()` function per module. `main.ts` calls them in the original order, then boots the app exactly as before.
- The 153 tap actions (`A`, keyed by `data-act`) are split into 13 files in `actions/map/` (app, layers, inspector, keys, effects, timeline, drawing, export, pen, presets, procedural, shader, view) and merged back into one map in `actions/index.ts`.
- The inspector follows HANDOFF section 8: `ui/inspector/header.ts`, `transform.ts`, `layer.ts`, `content-text.ts`, `content-shape.ts`, `content-path.ts`, `content-audio.ts`, `paint.ts`, `extras.ts`, `controls.ts`, assembled by `props-view.ts`.
- New check: `tests/parity/10-dom-parity.spec.ts` loads the legacy file and the build side by side and requires the same HTML in the inspector (all sections unfolded), timeline, stage, top bar and strips, for the demo and after inserting each of 13 layer types.
- ESLint (`npm run lint`) reports no undefined names, so every module imports what it uses. Style findings in the prototype's own code are kept as warnings.
- Result: 234 of 234 tests pass on the legacy file, the build and the dev server. No circular-import errors at runtime.

```
src/
  main.ts                 entry: styles, modules, listeners, boot
  core/        dom ($, $$, esc), store (rfp- localStorage)
  model/       schema (PROPS, GROUPS), project (layers, load, save)
  state/       state (S), history (undo/redo), selection
  anim/        easing, interpolate (val), keys, clipboard, pose
  render/      stage, shapes, text, guides
  fx/          defs, filters
  shader/      presets, runtime (WebGPU / WebGL2), ui
  drawing/     cels, raster, ink, brush-bar, overlay
  export/      dialog, raster, gif, png, zip, lottie, mp4
  playback/    loop, audio
  ui/          topbar, strips, left-panel, presets, floats, timeline, graph, popovers, color-picker,
               dialog, toast, layout, autofold, text-animators, icons, inspector/*
  actions/     index (A), map/*, layers, presets, align
  gestures/    canvas, drags, reorder, handles, timeline, cel-timeline, area-select
  events/      delegate (click, change, input, pointerdown router), keyboard
  styles/      00-host.css … 11-inspector-v8.css (source order)
```

## Phase 3: types

- Removed `// @ts-nocheck` from every file. `npm run typecheck` (tsc) is clean.
- `src/model/types.ts` describes the saved document: Layer, Prop, Key, Effect, Cel, Stroke, Marker, Project.
  `project.ts` and `schema.ts` use these types. They describe the existing data; no field was added.
- `strict` is still off. The prototype relies on loose JavaScript (objects grown field by field,
  optional arguments), so strict mode is a later clean-up, not part of the port.
- Two helper scripts in `scripts/types/` made the bulk changes, both type-only:
  - `optional-params.mjs` marks parameters the prototype leaves out as optional.
  - `annotate-open-objects.mjs` marks objects built up field by field as `any`.
- Browser APIs that TypeScript's built-in types do not cover (WebGPU, `webkitAudioContext`,
  the Claude host's `window.claude`) are reached through `as any` casts. No new packages were added.
- Class fields on `GifOut` use `declare`, so the compiled JavaScript is unchanged.
- Parity: 234/234 on the build. tsc is clean, and lint shows 0 errors (24 style warnings carried over
  from the prototype).

## Phase 4: unit tests

- Vitest (dev only) with happy-dom. `npm run test:unit` runs 25 tests in `tests/unit/`:
  - Animation: `bez`, `val`, `pose` (flips, behaviours), `mat`, `world` (parenting).
  - Export: `lzw` (round-trip through a reference decoder), `medianCut`, `zipStore` (CRC, offsets),
    `muxMp4` (box sizes, `stco` offset, sample sizes and keyframes), and the Lottie builders
    `lrgb`, `lprop`, `lgeom`, `lpaint`.
- To make them testable, `medianCut`, `lzw`, `muxMp4`, `lrgb`, `lprop`, `lgeom` and `lpaint` are now exported.
  Nothing else changed.
- `tests/unit/setup.ts` loads the page skeleton from `index.html`, because some modules look up their
  elements when they load, as the prototype did.
- `.github/workflows/ci.yml` runs typecheck, lint, unit tests and the build on GitHub. The screenshot
  parity suite stays local, because its reference images depend on the machine's fonts.
- Parity: 234/234 on the build.

## Phase 5: host adapter

- `src/host/save-file.ts` is the only code that knows where the app runs. Export Save calls it:
  1. Inside the Claude artifact host, it uses the host's downloads service, as the prototype did.
  2. On a touch device that can share files (iPad Safari), it opens the share sheet: Save to Files,
     or Save Video / Save Image for MP4 and GIF. Closing the sheet does nothing.
  3. Everywhere else, and if sharing fails, it uses a normal download link.
  Nothing is awaited before `navigator.share`, because Safari only allows it straight after the tap.
- `index.html` head: title "RippleFlow", `lang="en"`, a description, `viewport-fit=cover`.
  The `claude:viewport-fit-sides` meta is gone.
- `00-host.css` stays first in the cascade. It holds the base body styles and the safe-area padding.
  Only a comment explaining where it came from was added.
- New `tests/parity/11-host-save.spec.ts` (port only) stubs the share sheet. It checks that Save shares the
  file and does not download, and that closing the sheet shows no error.
- Parity: 238/238 on the build and on the dev server. Legacy: 234/234. Unit: 25/25.
- Not yet checked on a real iPad. Playwright WebKit has no share sheet.

## Phase 6: install and offline (PWA)

Nathan approved this phase (HANDOFF section 13, decision 3).

- `public/manifest.webmanifest`: name "RippleFlow", standalone, dark background `#0e0d0c` (`--bg`).
- Icon: `public/icon.svg` shows rings spreading from a point, in the app's accent blue on `--bg`.
  `node scripts/make-icons.mjs` renders the PNGs (192, 512, 180 for the iPad home screen). Replace the SVG
  and rerun the script to change the icon.
- `index.html` head: manifest, icons, `theme-color`, and the Apple web-app tags (black-translucent status
  bar; the safe-area padding in `00-host.css` keeps the UI clear of it).
- Service worker, hand-written with no libraries: `pwa/sw.template.js`. At build time, `pwa/vite-plugin-sw.ts`
  adds the list of built files and a version from their contents. It caches every file on install.
  Page loads go to the network first, so updates arrive at once, and use the cache when offline.
  A new build clears the old cache. The worker is registered only in the production build (`src/host/pwa.ts`).
- New `tests/parity/12-pwa.spec.ts` (build only): the manifest and icons load, and the app reloads with the
  network off.
- Parity: 242/242 on the build, 238/238 on the dev server. Unit: 25/25.
