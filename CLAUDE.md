# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RippleFlow: a motion-graphics editor shipped as an iPad-first PWA (Preact + signals, WebGL2 renderer, no backend). [spec.md](spec.md) is the source of truth for feature definitions (section refs like "spec §7.6" appear throughout the code comments); [plan.md](plan.md) is the milestone roadmap (M0–M9, currently 1.0.0-rc.1); [docs/](docs/README.md) holds user docs and [docs/acceptance.md](docs/acceptance.md) tracks what is verified automatically vs. still needing a real iPad.

## Commands

```bash
npm ci
npm run dev                      # http://localhost:5173/Ripple/  (note the /Ripple/ base path)
npm run typecheck                # tsc --noEmit (strict, noUncheckedIndexedAccess)
npm test                         # vitest run (tests/**/*.test.ts, pure logic)
npx vitest run tests/lottie.test.ts            # single test file
npx vitest run -t "name substring"             # single test by name
npm run build                    # typecheck + vite build -> dist/
npm run size                     # fails if gzipped JS in dist/assets > 250 KB (run after build)
npm run e2e                      # headless-Chromium suite; needs `npm run build` first, starts `vite preview` on :4179 itself
npm run e2e -- m4-blend          # run only check files whose name contains the substring
npm run shots shots/after        # UI screenshots (dark/light × desktop/iPad) for before/after comparison
npm run icons                    # regenerate PNG icons from public/icon.svg (needs Playwright)
```

CI (`.github/workflows/ci.yml`) runs, in order: typecheck, test, build, size, e2e. Pushes to `main` deploy to GitHub Pages. Set `BASE=/` to build for root hosting; the default base `/Ripple/` matches Pages.

The 250 KB gzip JS budget is a hard constraint — think before adding dependencies.

## Architecture

**Layering (enforced by convention, see [docs/ui-contract.md](docs/ui-contract.md)):** the engine — `src/model`, `src/eval`, `src/anim`, `src/render`, `src/shape`, `src/text`, `src/lottie`, `src/export`, `src/io` — must never import from `src/app` or `src/ui`. `src/app/*.tsx` + `src/ui` are the replaceable UI; `src/app/state.ts`, `tools.ts`, `playback.ts` are the app-state layer (signals + commands) the UI calls. Read ui-contract.md before any UI restructure: it lists the `data-testid` landmarks, aria-label names, CSS tokens, and `window.__ripple` globals the e2e suite depends on.

**Document model** (`src/model/`): `Project` (versioned via `v`, migrations on load) holds root-comp `layers` (index 0 = TOP layer, After Effects convention), `settings`, `markers`, `workArea`, nested `comps` (precomps), and `assets` keyed by content hash. Layers carry a transform plus a generic `props` bag (`Record<string, Prop>`) used for shape/text/effect/mask/shader parameters; effect params live under keys like `fx:<effectId>:<param>`. Animated values are `Prop`s evaluated by `anim/interp.ts`.

**State & undo** (`src/app/state.ts`): the document is treated as **immutable with structural sharing**; `History` (`model/history.ts`) stores snapshot pointers, not patches, and coalesces same-key edits within a time window. All edits must go through the commit-based actions (never mutate `current.value` in place). `current` is always the comp being edited presented as a `Project` — entering a precomp parks the root project on a stack and merges it back on exit/save, so editing operations work unchanged at any nesting level. Selection, keyframe selection, playhead etc. are separate signals and are not part of history.

**Evaluation → render pipeline:** `eval/evaluate.ts` resolves a layer stack at time `t` (animated props, parenting, in/out, solo/shy) into `Resolved[]` with world matrices. `render/gl.ts` then renders per comp into an accumulator render target (premultiplied RGBA8, pooled by size); plain normal-blend layers draw straight in, while layers with blend modes/masks/mattes/effects/adjustment get their own RT first. Precomps recurse into their own accumulator. Shape/text/media layers are rasterised with Canvas2D to textures (`render/raster.ts`, `media.ts`); effects (`render/effects.ts`) are fused shaders; user shader layers go through `render/shader.ts` (uniforms are parsed from GLSL source and synced to props). Linear-light compositing and motion blur (temporal sampling) are project settings.

**Export** (`src/export/`): deterministic frame render driving a render queue — MP4 (WebCodecs + mp4-muxer), WebM, GIF, PNG/image sequences (fflate zip), transparent export. `src/lottie/` is separate import/export (round-trip tested against `lottie-web`). `src/io/` handles IndexedDB/localStorage persistence with version snapshots/recovery, `.ripple` bundles (zip), asset import, and SVG import.

**PWA:** `vite-plugin-pwa` with `registerType: 'prompt'` (never auto-reload mid-edit; `UpdateToast` prompts). Splash/icon assets in `public/` are generated by `scripts/make-icons.mjs` / `make-splash.mjs`.

## Testing notes

- `tests/*.test.ts` are vitest unit tests for engine logic (no DOM/GL).
- Anything visual (blend modes, masks, mattes, effects, export) is checked by the e2e/golden suite in `scripts/e2e/checks/*.mjs` (named by milestone, e.g. `m4-blend`). Each file exports `checks: [{ name, run({ page, ctx, URL_ }) }]`; the runner opens a fresh context per check, creates a new project, and fails the check on any console/page error. Scenes are built with the `window.T` helpers injected from `scripts/e2e/prelude.mjs`, and the renderer is reachable as `window.__ripple.renderer`. Chromium runs with SwiftShader (software GL), so goldens use a small tolerance.
- Prefer the `UI` selector map in `scripts/e2e/ui.mjs` and `aria-label`s over CSS class selectors in checks; update both together if markup changes.
- Touch/Pencil/palm-rejection behaviour can't be proven headlessly — see [docs/device-pass.md](docs/device-pass.md).
