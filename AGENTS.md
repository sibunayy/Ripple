# AGENTS.md

RippleFlow: iPad-first motion-graphics PWA (Preact + signals, WebGL2, no backend). `CLAUDE.md` has the detailed architecture notes; `spec.md` is the source of truth for features (code comments cite "spec §x.y"); `plan.md` is the roadmap; `docs/acceptance.md` lists what is auto-verified vs. needs a real iPad.

## Parallel agent workflow (read first)

- This repo is the `main` worktree at `!AICoding/Ripple`. Agents work in sibling worktrees, never directly in `main`: `../wt-claude` (`agent/claude-engine`), `../wt-gemini` (`agent/gemini-ui`), `../wt-deepseek` (`agent/deepseek-tests`). Check `pwd` and `git branch --show-current` before editing.
- Stay in your lane (ownership table in `COORDINATION.md`). Don't edit `package.json`, `package-lock.json`, `vite.config.ts` or `tsconfig.json` without asking. Touching files owned by another lane needs a note in `COORDINATION.md`.
- Each worktree needs its own `npm ci` (node_modules is not shared).
- Run e2e and shots on your lane's ports so parallel agents don't collide (`--strictPort`): set `E2E_PORT` and `SHOTS_PORT`. Defaults 4179/4180; gemini lane 4279/4280; deepseek lane 4379/4380.
- Commit small and often on your branch. Don't push or merge to `main`; hand back with the verification results.

## Commands

- CI order: `npm run typecheck` → `npm test` → `npm run build` → `npm run size` → `npm run e2e`.
- Dev server: `npm run dev` → `http://localhost:5173/Ripple/`. The `/Ripple/` base is required (`BASE=/` for root hosting). Use `-- --port <n>` per lane for parallel dev servers.
- Single unit test: `npx vitest run tests/lottie.test.ts` or `npx vitest run -t "name substring"`. Unit tests are pure logic (no DOM or GL).
- `npm run e2e` needs a prior `npm run build`, starts `vite preview` itself, and runs Playwright Chromium on SwiftShader. Filter with `npm run e2e -- m4-blend`. First run may need `npx playwright install chromium`.
- `npm run size` fails over 250 KB gzipped JS in `dist/assets`. Hard budget: avoid new dependencies.
- `npm run shots shots/after` needs a prior build. `shots/before` holds baselines.
- tsc is strict with `noUncheckedIndexedAccess`; `npm run build` typechecks first.

## Architecture rules

- Engine (`src/model`, `eval`, `anim`, `render`, `shape`, `text`, `lottie`, `export`, `io`) must never import from `src/app` or `src/ui`.
- Before restructuring UI markup, read `docs/ui-contract.md`. The e2e suite depends on its `data-testid` landmarks, aria-labels, CSS tokens and `window.__ripple` globals. Update `scripts/e2e/ui.mjs` together with markup changes.
- Document is immutable with structural sharing. Edit only through commit-based actions in `src/app/state.ts`, never by mutating `current.value`.
- Layer index 0 is the TOP layer. Effect params are props `fx:<effectId>:<param>` (use `paramKey` in `src/render/effects.ts`; presets use `fx:@<effectType>:<param>`).
- PWA uses `registerType: 'prompt'`. Never add auto-reload on update.
- Deep link `?view=editor&template=<id>` opens the editor; localStorage `rf-onboarded-v1` skips onboarding.

## Testing quirks

- Visual features are covered only by e2e checks in `scripts/e2e/checks/mN-*.mjs` (`checks: [{ name, run({ page, ctx, URL_ }) }]`). Any console/page error fails the check. Scenes use the `window.T` helpers from `scripts/e2e/prelude.mjs`. Goldens have a small tolerance because of software GL.
- Touch/Pencil/palm-rejection can't be tested headlessly; see `docs/device-pass.md`.
