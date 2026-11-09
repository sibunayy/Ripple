# Parallel agent coordination

## Lanes

| Lane | Worktree / branch | Model | Owns | Ports (E2E / SHOTS) |
|---|---|---|---|---|
| Lead / engine | `../wt-claude` · `agent/claude-engine` | Claude Sonnet 5.5 (`claude`) | `src/model`, `eval`, `anim`, `render`, `shape`, `text`, `lottie`, `export`, `io`, `tests/` for those | 4179 / 4180 |
| Web UI | `../wt-gemini` · `agent/gemini-ui` | Gemini 4 Argon via GCP Vertex (`gemini`) | `src/app/*.tsx`, `src/ui`, `scripts/shots.mjs`, `docs/ui-contract.md` | 4279 / 4280 |
| Other Gemini tasks | `../wt-gemini` (same branch, run sequentially) | Gemini 3.8 Flash via API key (`gemini-api` agent with `model: google/gemini-3.8-flash`) | scripts, tooling, small refactors, review | 4279 / 4280 |
| Tests & docs | `../wt-deepseek` · `agent/deepseek-tests` | DeepSeek V4.1 Flash (`free`) | `tests/`, `docs/` (except ui-contract), new files in `scripts/e2e/checks/` | 4379 / 4380 |

The Gemini UI and Gemini 3.8 Flash roles share one worktree, so don't run them at the same time.

## Rules

1. One agent per worktree at a time.
2. Don't edit another lane's files. If you need a change there, add a line under "Requests" below and carry on.
3. Dependency, lockfile and config changes (`package.json`, `vite.config.ts`, `tsconfig.json`) are lead-only.
4. Before handing back, run `typecheck → test → build → size` (and `e2e` for anything visual) in your own worktree and report the output.
5. Merge into `main` is done by the lead or the user, in order: engine → UI → tests/docs. Run the full CI sequence after each merge.
6. Keep your branch current with `git rebase main` once `main` has moved.

## Requests

<!-- <from lane> → <to lane>: what you need, and why -->
