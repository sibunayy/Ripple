# Ripple

A lightweight motion-graphics editor that installs as a PWA on iPad (tuned for Apple M1). See [spec.md](spec.md) for the full design.

**Status:** M0 — installable shell, project library (OPFS + IndexedDB), project settings, autosave.

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
