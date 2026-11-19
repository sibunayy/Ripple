# RippleFlow Console — Handoff: single-file prototype → multi-file web app

**Owner:** Nathan (designer; does not write code)
**Prepared:** 20 November 2026
**Source of truth:** `source/ripple-flow-console.html` (artifact "RippleFlow Console (Copy)", version 2, the inspector hierarchy pass)
**Live prototype:** https://claude.ai/code/artifact/d7077bf7-c042-40b1-a373-a2e262127af9 (private to Nathan)

---

## 1. Goal

Turn the working single-file prototype into a maintainable multi-file web app.
Keep every behaviour and every visual detail the same.
This job is a **restructure, not a redesign**.
New features and visual changes are out of scope until the port passes the parity checklist (section 10).

## 2. Target platform

- Primary: **Safari on iPadOS 16.4 or later**, with touch and Apple Pencil.
- Layouts: iPad landscape (about 1180 × 820) and iPad portrait (about 820 × 1180).
- Secondary: desktop Safari and Chrome with mouse and keyboard.
- Input rules: touch targets are 40–48 px. Pencil pressure and tilt drive the brush. Two-finger tap = undo. Three-finger tap = redo. Pinch zooms the canvas.

## 3. What the app is

RippleFlow is a motion design editor in the browser. It makes short 1920 × 1080, 30 fps animations ("comps").

| Area | Features |
|---|---|
| Shell | 40 px top bar. 48 px icon strips at left and right. Dockable left panel (280 px) and right panel (296 px). The panels auto-fold during canvas drags and playback. Timeline at the bottom: a 58 px peek that drags up to the dope sheet or graph. Portrait layout: the left panel is a drawer and the right panel is a bottom sheet. |
| Canvas | SVG stage. Select, marquee and lasso tools. Hand tool. Pinch zoom. Pen paths. Shapes (rect, ellipse, polygon, star, line, ring). Text. Scale and rotate handles. Motion path dots. Snap guides. Safe-area and thirds overlays. Quick action bar. |
| Layers | Text, shapes, path, solid, null, adjustment, shader (GLSL / WGSL), comp / group, image, audio, frame-by-frame drawing. Reorder, solo, hide, lock, parent, track matte, blend mode. |
| Animation | Keyframes for position, scale, rotation, opacity, anchor and trim paths. Easing presets and a bezier editor. Graph editor. Auto-key. Work area and loop. Markers. Copy and paste keyframes. |
| Procedural | Behaviours (wiggle, jitter, oscillate, bounce, pulse, orbit, drift, spin). Duplicator (line, circle, grid, with stagger). Text animators. Motion presets, including user-saved presets. |
| Effects | 25 SVG-filter effects (glow, blur, ripple, halftone, glitch, and more). Mix per effect. Bypass all. Reorder. Copy and paste the effect stack. |
| Drawing | Cels, onion skin, flip, brush / eraser / fill. Pencil pressure and tilt. |
| Export | MP4 (WebCodecs H.264 + a custom muxer), GIF (median-cut palette + LZW), PNG sequence (ZIP), Lottie JSON. No libraries. |
| Persistence | `localStorage`: the project and the UI preferences. Undo history is in memory. |

## 4. Non-negotiables

1. **Behaviour parity.** Every `data-act` action, gesture, shortcut and export must work as it does in the source file.
2. **No regressions on iPad Safari.** Test touch and Pencil paths, not only mouse.
3. **Keep the `localStorage` keys.** The prefix is `rfp-`. The keys are `project`, `left`, `right`, `tl`, `collapsed`, `collapsedV`, `collapsedV2`, `collapsedV3`, `theme`, `glow`, `tint`, `autofold`, `brush`, `onion`, `guide` and `myPresets`. Existing users must keep their work.
4. **No new runtime dependencies in phase 1.** The prototype has zero dependencies. Add only the build tools.
5. **Keep the design tokens.** Keep all CSS custom properties (`--bg`, `--surface*`, `--acc`, `--lit*`, `--fs-*`, `--r-*`, …) with the same names and values, including the light theme, `data-theme`, `data-tint` and `data-glow`.
6. **Keep the accessibility attributes.** Keep every `aria-*`, `role`, `title` and focus style.

## 5. Recommended stack (phase 1)

- **Vite + TypeScript, vanilla ES modules.** Do not use a UI framework in phase 1.
- Keep the current rendering model: each panel has a `render*()` function that writes template strings to `innerHTML`, and one delegated event layer handles input. A port to modules is low risk. A rewrite to React or Svelte is high risk because pointer gestures, pointer capture and frozen-stage auto-fold depend on exact DOM timing.
- TypeScript: start with `strict: false` and `allowJs`. Add types to the document model first (section 7).
- Lint and format: ESLint + Prettier, with default rules.
- Tests: Vitest for pure logic. Playwright (WebKit + Chromium) for the UI parity checks.
- Phase 2 (only after Nathan approves): a PWA manifest and service worker for install on the iPad home screen. Optionally, IndexedDB for large projects.

> **Decision for Nathan:** confirm Vite + vanilla TypeScript. The alternative is a framework rewrite. That is a separate project.

## 6. Source map and proposed modules

All line numbers refer to `source/ripple-flow-console.html` (4,025 lines, about 374 KB).

| Lines | Content | Proposed module |
|---|---|---|
| 1–10 | Artifact host skeleton + small extra CSS (`.lname`, `.mkrow`, wave, `.mtag`, `.shcode`) | `index.html`, `styles/misc.css` |
| 13–53 | Design tokens, light theme, tint and glow variants | `styles/tokens.css` |
| 55–122 | Base, shell grid, top bar, icon strips | `styles/shell.css` |
| 123–152 | Panels, portrait drawer and sheet | `styles/panels.css` |
| 154–255 | Inspector controls (`.sec`, `.fld`, `.seg`, `.tog`, `.cchip`, `.prop`, colour picker, anchor grid) | `styles/inspector.css` |
| 256–301 | Left panel lists, presets list, glyph animations | `styles/lists.css` |
| 303–358 | Viewport, selection box, overlays, floats, quick bar | `styles/viewport.css` |
| 360–408 | Timeline, dope sheet, graph | `styles/timeline.css` |
| 410–543 | Popovers, menus, dialogs, toast, polish pass, drawing UI | `styles/overlays.css`, `styles/drawing.css` |
| 544–598 | **v8 inspector hierarchy pass** (the latest design; see section 8) | `styles/inspector-v8.css` (or merge into `inspector.css` **last**, so its higher specificity still wins) |
| 600–623 | App DOM skeleton | `index.html` |
| 627–708 | Globals, `store`, icon paths `P`, `ic()`, `esc()` | `core/dom.ts`, `core/store.ts`, `ui/icons.ts` |
| 710–722 | Easing tables, bezier solver | `anim/easing.ts` |
| 724–765 | `PROPS`, `GROUPS`, demo layers, project load and save, `val()` interpolation | `model/schema.ts`, `model/project.ts`, `anim/interpolate.ts` |
| 767–820 | State `S`, history (`commit`, `undo`, `redo`), `setVal`, `toggleKey` | `state/state.ts`, `state/history.ts`, `anim/keys.ts` |
| 822–896 | Shape geometry, fonts, text and shape SVG | `render/shapes.ts`, `render/text.ts` |
| 897–968 | Effect definitions and SVG filter builder | `fx/defs.ts`, `fx/filters.ts` |
| 969–1013 | `pose()`, behaviours, duplicator, matrices, parenting | `anim/pose.ts` |
| 1014–1331 | Shader layers (GLSL / WGSL presets, WebGL2 and WebGPU runtimes, shader dialog) | `shader/presets.ts`, `shader/runtime.ts`, `shader/ui.ts` |
| 1332–1440 | `buildCanvas`, `updateCanvas`, `layoutStage`, `placeSel` | `render/stage.ts` |
| 1441–1493 | Top bar, icon strips | `ui/topbar.ts`, `ui/strips.ts` |
| 1494–1578 | Left panel: Layers, Assets, Presets view | `ui/left-panel.ts`, `ui/presets.ts` |
| 1579–1876 | Right panel: property rows, easing block, inspector parts, effects view, `propsView`, `renderRight`, `updateFields` | `ui/inspector/*.ts` (see section 8) |
| 1877–1916 | Zoom float, quick bar, tool hints | `ui/floats.ts` |
| 1917–2101 | Timeline, ruler, dope sheet, graph editor | `ui/timeline.ts`, `ui/graph.ts` |
| 2102–2260 | Colour picker and every popover | `ui/popovers.ts`, `ui/color-picker.ts` |
| 2261–2647 | Export: raster, GIF, ZIP, Lottie, MP4 muxer, export dialog, `renderDialog` | `export/{raster,gif,zip,lottie,mp4,dialog}.ts` |
| 2648–2678 | Toast, `applyLayout`, `renderAll`, `persist`, `seek`, theme | `ui/toast.ts`, `ui/layout.ts` |
| 2679–2751 | Playback loop, audio, auto-fold | `playback/loop.ts`, `playback/audio.ts`, `ui/autofold.ts` |
| 2752–2857 | `newLayer`, motion presets, saved presets | `actions/layers.ts`, `actions/presets.ts` |
| 2858–3093 | **Action map `A`** (149 actions, keyed by `data-act`) | `actions/index.ts` (split by domain and merge into one map) |
| 3095–3111 | Multi-select helpers, `applyProp` | `state/selection.ts` |
| 3112–3352 | Frame-by-frame drawing: cels, rasteriser, onion skin, live ink, brush bar | `drawing/*.ts` |
| 3353–3589 | Cel timeline, flip, overlay, area select, handles, motion path, align, text animators, timeline gestures | `gestures/*.ts`, `ui/text-animators.ts` |
| 3590–3690 | Global event delegation: click → `A[data-act]`, change, input, focusout, pointerdown router | `events/delegate.ts` |
| 3691–3981 | Hold-to-reorder, drags (layer, timeline, sheet, scrub, keyframe, field, curve), canvas pointer logic, shapes, pan, pinch | `gestures/*.ts` |
| 3982–4020 | Keyboard shortcuts, multi-finger taps, ResizeObservers, boot | `events/keyboard.ts`, `main.ts` |

## 7. Architecture notes for the port

- **One state object.** `S` holds the UI state. `layers`, `markers`, `DUR`, `projName` and `compBg` hold the document. Many functions read these as module globals. Move them into one `state` module with exported getters and setters. Do not copy the values. `undo` and `redo` **replace** `layers` (`layers = JSON.parse(...)`), so every module must read the current reference.
- **History.** `commit(label)` pushes a full JSON snapshot and then calls `saveProj()`. Keep this behaviour.
- **Render functions** write `innerHTML` and are re-entrant. `renderAll()` order: `applyLayout`, `renderTop`, `renderStrips`, `renderLeft`, `renderRight`, `renderTL`, `renderFloats`, `renderPop`, `setPF`, `persist`. `updateCanvas()` and `updateFields()` are the fast paths used during drags and playback. Do not replace them with full re-renders.
- **Event delegation.**
  - Clicks go to `A[el.dataset.act](el, event)`.
  - `pointerdown` goes through one ordered router (lines ~3655–3690). **The order matters**, because handles, keyframes, fields and the canvas overlap.
  - `change` handles `[data-sel]` selects and `[data-ezv]` inputs. `input` handles live text fields.
  - Keep `suppressClick`, `dragging` and the `longPress()` helper exactly as they are. Taps, holds and drags depend on them.
- **Inline HTML safety.** All user text goes through `esc()`. Keep this rule in every template.
- **Host-specific code to isolate:**
  - The export Save button calls `window.claude.use('downloads')` (the Claude artifact runtime) and falls back to `<a download>`. In the standalone app, use the anchor, or `navigator.share` with files on iPad. Keep the call behind an adapter.
  - `<meta name="claude:viewport-fit-sides">` and the first `<style>` block (line 1) come from the artifact host. Replace them with a normal `index.html` head that includes `viewport-fit=cover`.
- **Browser APIs in use:** WebCodecs (MP4), WebGPU and WebGL2 (shaders), `PointerEvent` pressure, `altitudeAngle` and `getCoalescedEvents`, `ResizeObserver`, `DOMMatrix`, CSS `color-mix()`, CSS `:has()`.
- **Document model (type these first):**
  - Layer: `{ id, name, type, hue, hue2?, vis, lock, fx: Effect[], p: Record<'x'|'y'|'scale'|'rot'|'op'|'ax'|'ay'|'ts'|'te', Prop>, inP?, outP?, parent?, pt?, matte?, blend?, flipX?, flipY?, rep?, mods?, anims?, … }`, plus fields per type (text: `text`, `size`, `weight`, `font`, `track`, `lead`, `wsp`, `fop`, `tsw`, `tsc`, `align`, `tcase`, …; shapes: `w`, `h`, `r`, `cr`, `n`, `ir`, `sw`, `sc`, `sop`, `dash`, `dgap`, `doff`, `cap`, `join`, `fill`, `grad`, `gtype`, `gang`, `grad_r`; drawing: `cels[]`; shader: `preset`, `code`, `sp0`–`sp3`, `spd`, `opaque`; audio: `src`, `adur`, `wave`, `vol`, `mute`).
  - Prop: `{ v: number }` when static, or `{ keys: { t: frame, v: number, e: easeName | [x1, y1, x2, y2] }[] }` when animated.

## 8. Inspector design spec (v8): keep this exactly

The right panel (Properties tab) was redesigned on 20 Nov 2026 for iPad touch. The structure is:

1. **Header**: colour dot · layer type (small, muted) above an editable layer name · Hide / Lock / Solo icon toggles. With multi-select, the type line reads "N layers · editing all".
2. **Transform**: Position (X, Y), Scale, Rotation, Anchor point (X, Y) with a "Presets" link. Each property row = the label on top, then the value fields and the keyframe controls (◀ ◆ ▶) on one line, so all diamonds line up in one column. An animated property shows its label in the accent colour. Then "Align to composition" (6 buttons) and Flip H / Flip V / Reset.
3. **Layer**: Opacity (can be keyframed) + Blend mode. This is the only layer-opacity control.
4. **Content section** (title by type): **Text** (content, font + weight, Size & spacing, Paragraph) · **Shape** (geometry) · **Path** (smooth, closed, fill) · **Shader** · **Drawing** · **Fill** (solid and comp).
5. **Fill & stroke** (shapes), **Stroke** (ring, line, path) or **Fill & outline** (text): each colour chip is paired with its own Opacity. The Fill group has an on/off switch. Trim paths is a property row inside the Stroke group.
6. Text animators (text only) · Duplicator · Behaviours.
7. **Timing & links**: in / out, set in / out at the playhead, length, parent, track matte.

Type hierarchy: section title 14 px / 650 / text colour > group label 11 px uppercase, faint > property label 12.5 px, muted.
Sizes: panel 296 px; fields and selects 38 px (42 px on `pointer: coarse`); section headers 44 px (48 px on coarse); alignment buttons 40 px (44 px on coarse).
Inspector component split: `ui/inspector/header.ts`, `transform.ts`, `layer.ts`, `content-*.ts` (one file per layer type), `paint.ts`, `extras.ts` (animators, duplicator, behaviours), `timing.ts`, `controls.ts` (`pf`, `selH`, `grid2`, `sec`, `propRow`, `fldBox`).

## 9. Migration plan

| Phase | Work | Done when |
|---|---|---|
| 0. Baseline | Put the source HTML in `legacy/`. Write Playwright parity scripts against it (section 10). Capture reference screenshots in light, dark, landscape and portrait. | The scripts pass on the legacy file. |
| 1. Scaffold | Vite + TypeScript project. Move the CSS into `styles/` in the **same order** as in the source. Move the DOM skeleton into `index.html`. Put all the JS into one `legacy-main.ts`. | The app runs from `npm run dev`. The screenshots match the reference with zero pixel difference, or a stated small tolerance. |
| 2. Split modules | Move code into the modules from section 6, one domain at a time. Run the parity scripts after each move. | All scripts pass. No circular-import errors at runtime. |
| 3. Types | Type the document model, `S`, history and actions. Turn on `strict` per module where it is cheap. | `tsc --noEmit` is clean. |
| 4. Unit tests | Vitest for `val()`, `bez()`, `pose()`, `mat()`/`world()`, the Lottie builders, `lzw`, `medianCut`, `zipStore`, `muxMp4` box sizes. | Tests pass in CI. |
| 5. Host adapter | Replace `window.claude.use('downloads')` with the anchor download / `navigator.share`. Clean up the `index.html` head. | MP4, GIF, PNG and Lottie export and save on iPad Safari. |
| 6. (Optional, ask first) | PWA manifest, icons, offline cache. | Nathan approves. |

Commit after each phase with a clear message. Do not mix moves and behaviour changes in one commit.

## 10. Parity checklist (automate with Playwright; WebKit at 1180 × 820 and 820 × 1180)

- [ ] Loads with no console errors. The demo project shows 4 layers; "YOUR LOGO" is selected.
- [ ] Tool strip: every tool selects. Holding Select, Shape or Brush opens its flyout.
- [ ] Canvas: tap selects, drag moves (snap guides appear at the centre), corner handle scales, knob rotates, pinch zooms, two-finger tap undoes.
- [ ] Inspector: tap ◆ on Position animates it (the label turns accent). Horizontal drag on Scale changes the value. A tap on a field opens exact entry. Anchor "Presets" opens the 3 × 3 grid and moves the anchor without moving the layer. Header Hide / Lock / Solo toggle. Renaming updates the Layers list and the timeline.
- [ ] Layer section: Blend mode applies `mix-blend-mode` on the stage group.
- [ ] Text: content, font, weight, size, tracking, leading, word space, alignment, style, case, fill + gradient, outline width shows the outline colour chip.
- [ ] Shapes (rect, ellipse, star, polygon, line, ring) and path: geometry, fill on / off, stroke, dash / gap / offset, cap / join, trim paths keyframes.
- [ ] Effects tab: add, toggle, reorder (hold and drag), mix, bypass all, copy / paste stack.
- [ ] Easing tab: curve handle drag, presets, copy / paste / mirror.
- [ ] Presets: built-in presets apply with the direction, start, stagger, duration and intensity options. Save and apply a user preset.
- [ ] Timeline: expand by drag or tap; dope sheet; graph editor drag; keyframe drag-retime; marquee select; layer slide (hold the bar); trim handles; work area; markers; loop.
- [ ] Drawing: brush with pressure (simulate `pointerType: 'pen'`), eraser, fill, cels, onion skin, flip.
- [ ] Shader layer: preset runs (WebGL2 fallback when WebGPU is missing); the code dialog applies and reverts.
- [ ] Export: all four formats finish and download.
- [ ] Persistence: reload keeps the project and the panel state. Settings → reset restores the demo.
- [ ] Theme: Auto / Dark / Light, Reduce glow, Ocean / Aqua tint.
- [ ] Portrait: the left drawer and the right bottom sheet open, drag and close. Picking a draw tool folds the sheet.

## 11. Known quirks (port as they are; fix only with approval)

- `S.collapsed` migrations use the keys `collapsedV`, `collapsedV2` and `collapsedV3`. Keep them so that saved panel states stay valid.
- The `A.flip` and `A.flipseg` actions exist but are not wired to any visible control.
- The `.row`, `.pg` and `.kf` CSS rules are partly legacy. `.kf` is still used in the timeline sub-rows; `.pg` no longer renders in the inspector.
- The asset library items are placeholders: tapping one shows a toast and adds nothing.
- The eyedropper picks a layer's base colour, not a pixel.
- Exports are silent: there is no audio in MP4.
- Images and audio from `blob:` URLs are dropped on reload (by design in the prototype).

## 12. Out of scope

- A visual redesign of any area.
- A framework rewrite.
- Backend, accounts, cloud sync, collaboration.
- New features from the backlog.

## 13. Open decisions for Nathan

1. Stack: Vite + vanilla TypeScript (recommended) or a framework rewrite.
2. Repository hosting: a new GitHub repo (name?) or this folder only.
3. PWA install on iPad: yes or no, after parity.
4. App name for the package and the manifest: "RippleFlow"?
