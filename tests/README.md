# Parity tests

These tests check that the app behaves exactly like the prototype, feature by feature (HANDOFF.md section 10).

Run them all:

```
npm run test:parity
```

- `RF_TARGET=legacy` (the default) tests the untouched prototype in `legacy/`.
- From phase 1, `RF_TARGET=app` tests the ported app. The same tests and the same reference screenshots must pass.
- `npm run test:parity:update` re-records the reference screenshots. Only do this on the legacy target, and only on purpose.

Files: `00` load and screenshots · `01` tools and canvas · `02` inspector · `03` text and shapes · `04` effects, easing, presets · `05` timeline · `06` drawing · `07` shaders · `08` export · `09` persistence, theme, portrait.

## Running against the port

- `npm run test:parity` runs against the prototype in `legacy/`.
- `npm run test:parity:app` builds the app and runs against the build (what gets deployed).
- `node scripts/with-env.mjs RF_TARGET=dev npx playwright test` runs against the dev server.
