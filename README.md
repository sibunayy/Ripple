# RippleFlow

A lightweight motion-graphics editor that installs as a PWA on iPad (tuned for Apple M1). See [spec.md](spec.md) for the full design and [plan.md](plan.md) for the roadmap; user docs are in [docs/](docs/README.md).

**Status:** M9 — onboarding, templates, help, accessibility pass, Pencil palm rejection, preview auto-quality, docs, splash screens (1.0.0-rc.1; real-iPad verification pending, see [docs/acceptance.md](docs/acceptance.md)). Earlier: M8 — shader layers/effects, Lottie export & import (round-trip tested against lottie-web), motion blur, text animators, 3D LUTs. Earlier: M7 — render queue, MP4/WebM/GIF/image sequences, transparent export, `.ripple` bundles, version snapshots & recovery. Earlier: M6 — image/SVG/video import, asset manager, thumbnails. Earlier: M5 — 29 effects with fused shaders, curves, linear-light compositing, 22 animation presets (+ user presets). Earlier: M4.5 — export (MP4/PNG sequence/PNG). Earlier: M4 — blend modes, masks, track mattes, precomps, adjustment layers, transform handles + snapping. Earlier: M3 — shapes (rectangle, ellipse, polygon, star, line, pen with node editing), fill/stroke/gradients, trim paths, repeater, text layers with font import. Earlier: M2 — dope sheet, graph editor, 30-curve easing library, markers, work area, copy/paste keys. Earlier: M1 — document model with undo/redo, WebGL2 renderer, viewer (pinch zoom/pan, select, drag), layers panel, inspector with keyframes, timeline, playback.

## Develop

```bash
npm ci
npm run dev        # http://localhost:5173/Ripple/
npm test           # unit tests
npm run build      # typecheck + production build into dist/
npm run size       # enforce the 250 KB gzip JS budget
npm run icons      # regenerate PNG icons from public/icon.svg (needs Playwright)
```

Set `BASE=/` to build for root hosting; the default `/Ripple/` matches GitHub Pages.

## Deploy

Pushes to `main` deploy to GitHub Pages via `.github/workflows/deploy.yml`. Enable it once under Settings → Pages → Source: **GitHub Actions**.

## Install on iPad

Open the deployed URL in Safari → Share → **Add to Home Screen**.

MIT licensed.
