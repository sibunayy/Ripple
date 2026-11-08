# UI contract — what a redesign must keep

RippleFlow's engine (document model, evaluation, renderer, export, I/O) is separate from the interface. A UI overhaul should only touch `src/app/*.tsx` (components), `src/ui/*` (shared widgets, `theme.css`) and `index.html`. This page lists what those layers promise to the rest of the app and to the tests, so the swap can be verified instead of hoped for.

## Layers

| Layer | Path | Rule |
|---|---|---|
| Engine | `src/model`, `src/eval`, `src/anim`, `src/render`, `src/shape`, `src/text`, `src/lottie`, `src/export`, `src/io` | No imports from `src/app` or `src/ui`. A redesign never edits these. |
| App state | `src/app/state.ts`, `tools.ts`, `playback.ts` | Signals and commands the UI calls (`selection`, `current`, `commit`-based actions such as `toggleSolo`, `setProp`). Keep names and semantics; add, don't rename. |
| Components | `src/app/*.tsx`, `src/ui/*.tsx` | Free to restructure, restyle and replace. |
| Theme | `src/ui/theme.css` | All colours, sizes and shadows come from `:root` tokens. |

## Controls added by the touch overhaul
- `NumField` renders `role=slider` with `aria-label` = the property name (e.g. `Position X`); tapping it swaps in an `input[aria-label=<same name>]` (type to commit with Enter/Tab/blur, Escape cancels). Checks must click the slider before filling the input.
- Icons are inline SVG (`src/ui/Icon.tsx`, Lucide data in `icons-data.ts`) with `aria-hidden`; icon-only buttons keep their `aria-label`.
- Inspector sections are `button.sec-head[aria-expanded]`; context menus are `[role=menu]` / `[role=menuitem]` opened by long-press or right-click.
- Touch gestures (`src/app/gestures.ts`): two-finger tap = undo, three-finger tap = redo, touch pointers only.

## Must-keep behaviour

- **Landmarks** (`data-testid`): `library`, `project-card`, `editor`, `topbar`, `viewer-panel`, `stage`, `side-panel`, `timeline`, `layer-row` (with `data-selected`). The stage contains the GL `<canvas aria-label="Composition viewer">` and the `svg.overlay`; pointer maths in `Viewer.tsx` assumes the stage is scaled by CSS transform.
- **Accessible names**: every control has one (an e2e sweep enforces it). Names used by tests: *Back to library, Tools, Zoom in/out, Performance overlay, Add solid layer, Add composition, Hide/Show layer, Solo layer, Lock layer, Mark layer shy, Layer name*, plus dialogs labelled *Export*, *Help*, *Project settings*.
- **Dialogs**: `role=dialog`, focus trapped, Escape closes and restores focus (`src/ui/dialog.ts`).
- **Page never scrolls** (`html, body { position: fixed }`); panels scroll internally. No page zoom or rubber-banding on iPad.
- **Touch**: 44 pt hit targets on `(pointer: coarse)`, palm rejection in the viewer, `touch-action` rules on the canvas and timeline, `prefers-reduced-motion`, light and dark themes.
- **Globals** used by tests and tooling: `window.__ripple.{renderer,doc,load,save}`; deep link `?view=editor[&template=…]`; localStorage key `rf-onboarded-v1`.
- **Keyboard**: the shortcut map in [shortcuts.md](shortcuts.md) lives in `Editor.tsx` (`useShortcuts`).
- **Tokens** the CSS exposes (all must stay defined): `--bg --surface --surface-2 --line --text --muted --accent --accent-text --danger --ok --on-danger --scrim --scrim-light --shade --shadow --checker-a --checker-b --radius --hit --name-w`. `--name-w` must match `NAME_W` in `Timeline.tsx`.

## Verifying a swap

```bash
npm run shots shots/before      # on the old UI (needs a build): dark/light × desktop/iPad PNGs
# …build the new UI…
npm run typecheck && npm test
npm run build && npm run size   # JS gz budget 250 KB
npm run e2e                     # includes m11-ui-contract and the a11y sweep
npm run shots shots/after       # compare against before/
```

If the redesign changes markup the e2e suite selects by class (`.tl-row.sub`, `.dialog`, `.btn`…), update `scripts/e2e/ui.mjs` and the checks together; checks should prefer the `UI` map and `aria-label`s over class names. Then repeat the iPad items in [device-pass.md](device-pass.md) (touch, Pencil, palm rejection, pinch/pan), which headless Chromium cannot prove.
