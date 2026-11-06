# RippleFlow — plan for milestones M4–M9

Status: M0–M3 are shipped (PWA shell, engine, keyframes/graph, shapes/pen/text). This document turns spec §13 (milestones) into an ordered, buildable plan for the rest of v1, based on what the code looks like today. Spec §7 stays the source of truth for feature definitions; this file is about **order, design decisions and exit criteria**.

## 0. What the current code means for the plan

| Area | State after M3 | Consequence |
|---|---|---|
| Renderer | One pass per layer, drawn straight into the default framebuffer; shape/text rasterised with Canvas2D → texture | Blend modes, masks, mattes, effects and precomps all need **render targets + a per-frame render graph** (M4 starts here). |
| Document | `Project{settings, layers[], markers, workArea}`; one flat comp | Precomps need a **`comps` map** (migration v1→v2) before anything else in M4. |
| Properties | `Prop<number\|number[]>` only; shape/text params in `Layer.props` | Mask paths and path morphing need `Prop<BezPath>` interpolation (same-node-count). Effects need a generic param bag using the same `props` mechanism. |
| Canvas editing | Move only; node editing for paths | Missing **scale/rotate transform handles**, snapping/guides, multi-select transforms — needed by M4 UX. |
| Threading | Everything on the main thread | Move the renderer to a **worker + OffscreenCanvas** during M5 (before video/export make it matter). |
| Tests | Pure-logic unit tests + ad-hoc headless-Chromium scripts | Promote the e2e scripts to a **golden-image suite in CI** at the start of M4 (blend/mask/matte correctness is only checkable visually). |

Known gaps carried over (tracked in spec §7.6/§7.7 notes): spatial bézier handles on motion paths, speed graph, graph zoom, saved curves, cross-row marquee, separate in/out ease, gradient/path keyframing, multi-shape groups. Each is slotted below.

## 1. Recommended order (one deviation from the spec)

`M4 compositing → **M4.5 export-lite** → M5 effects & colour → M6 media → M7 full export → M8 advanced → M9 polish`

**Why M4.5:** after M4 a user can build a full composition but cannot get it out of the app. A minimal export (PNG sequence + MP4 of the current comp, WebCodecs) turns every later milestone into something shareable, gives a real perf benchmark (offline render speed), and enables a **public beta after M5**. Full queue/GIF/WebM/`.ripple` stays in M7. If you prefer the spec order, drop M4.5 and nothing else changes.

Sizing: S ≈ 1 working session, M ≈ 2–3, L ≈ 4–6. Totals: M4 L, M4.5 M, M5 L+, M6 L, M7 M, M8 L+, M9 M.

---

## M4 — Compositing  (L)

**Goal:** layers combine correctly: blend modes, masks, mattes, precomps, adjustment layers, with proper transform handles.

**Design**
1. **Data (v2 migration).** `Project.comps: Record<id, Comp>` where `Comp{id,name,width,height,fps,duration,bg,layers,markers,workArea}`; `Project.main` points at the root comp; `settings` stays as the main comp's resolution/fps for backwards compatibility and is migrated into `comps[main]`. New layer types `precomp` (ref + time offset/stretch, collapse-transforms flag off in v1) and `adjustment`. New layer fields: `blend: BlendMode`, `masks: Mask[]`, `matte?: {layer: id, mode: 'alpha'|'alphaInv'|'luma'|'lumaInv'}`, `clip?: boolean` (clip to layer below).
2. **Render graph.** Replace the direct-to-screen loop with: comp target A + ping-pong target B (RGBA8, or RGBA16F when *linear light* is on); a pooled RT allocator keyed by (w,h,format). Per layer: draw content → (mask → matte → effects, later) → blend onto the accumulator. Layers with `normal` blend and no mask/matte/effect keep the current fast path (no extra RT).
3. **Blend modes.** All 27 spec modes in one fragment shader that reads `src` + `dst` (accumulator) — separable modes via a switch; non-separable (hue/sat/colour/luminosity) via the standard formulas; premultiplied-aware. Golden tests per mode against a CPU reference.
4. **Masks.** Mask = bézier path (reuses `BezPath` + the M3 node editor), mode (add/subtract/intersect/lighten/darken/difference/none), invert, feather, opacity, expansion. Rasterise each mask to an R8 texture with Canvas2D, feather with a separable blur, combine per mode, multiply into layer alpha. **Animated masks:** add `Prop<BezPath>` interpolation (per-node lerp; require equal node counts, UI keeps counts in sync); this also unlocks **shape path morphing** from M3.
5. **Mattes.** Matte layer renders into its own RT; consumer samples alpha/luma (optionally inverted); matte layer is hidden from the output by default (AE behaviour).
6. **Precomps.** Recursive `renderComp(compId, t)` with a per-frame cache keyed by (comp, time) so a precomp used twice is rendered once; cycle detection (`wouldCycle` analogue); "Pre-compose" command (selected layers → new comp, replace with a precomp layer); comp tab bar in the editor. Nested comps may differ in size/fps; time mapping `tChild = (t − start) * stretch`.
7. **Adjustment layers.** Render everything below into the accumulator, then run the layer's (future) effect stack on the accumulator masked by the layer's alpha. In M4 the only effect is opacity/blend (the plumbing is the point — effects arrive in M5).
8. **Transform handles + snapping** (carried-over UX gap): on-canvas scale/rotate/anchor handles with corner/edge drags, shift = uniform, ⌥ = from centre; marquee select; multi-layer transform; guides/grid/snap to edges, centres and other layers (snap radius in screen px). Required because masks/mattes make precise placement common.
9. **Parenting UI polish** (pick-whip drag in the layers panel instead of the dropdown), layer lock/solo/shy, layer colour labels.

**Tests / exit:** golden-image suite in CI (headless Chromium + SwiftShader, ±2/255 tolerance) with scenes for all blend modes, every mask mode, feather, alpha/luma/inverted mattes, nested precomps, adjustment layer. Unit tests for comp migration, `Prop<BezPath>` interpolation, time remapping, cycle detection. **Exit:** golden tests green; 20-layer comp with masks/mattes holds 60 fps on M1 iPad (measure in the real device pass, §6).

**Risks:** RGBA16F render-target support/filtering (fallback to RGBA8 + dithering); SwiftShader vs real GPU differences in goldens (use tolerance + a "device" tag for M1-only checks).

---

## M4.5 — Export-lite  (M)

Deterministic `renderFrame(comp, frame) → texture` (already the shape of M4's graph) driving:
- **PNG sequence** (zip via `fflate`) and **single-frame PNG/JPEG/WebP**.
- **MP4 (H.264)** via WebCodecs `VideoEncoder` + a ~10 KB MP4 muxer (`mp4-muxer`), frames fed with `new VideoFrame(canvas)` (no `readPixels`), bitrate presets, work-area range, progress UI, cancel, background-safe (keeps screen awake via Wake Lock).
- iPad hand-off through `navigator.share({files})` and a download fallback.
- Feature detection with a clear message when WebCodecs H.264 isn't available.

**Exit:** a 10 s 1080p30 comp exports to a playable MP4 on iPad Safari at ≥ 1× realtime (target ≥ 2× by M7). e2e test exports a short clip and validates the container with `ffprobe`-equivalent parsing in Node.

---

## M5 — Effects & colour  (L+)

**Goal:** the "looks" milestone: effect stack per layer/adjustment layer, colour correction, presets. Ends with a **public beta**.

**Design**
1. **Effect framework.** `Layer.effects: EffectInstance[]` (`{id, type, enabled, props}` where params reuse the `Layer.props`-style `Prop` bag, so keyframes/graph/dope sheet work unchanged). Effect registry: `{id, name, category, params, passes}`. Panel with add/reorder/enable/solo, per-effect stopwatches, reset.
2. **Fusion.** Consecutive *per-pixel* effects (colour set, tint, invert, …) compile into one **uber-shader** (generated GLSL, cached by effect-chain signature); *neighbourhood* effects (blur, glow, shadow, distort) are explicit multi-pass nodes. Intermediate textures come from the M4 RT pool.
3. **Launch set.** Blur: Gaussian (separable, sigma-adaptive downsample for big radii), Directional, Radial, Box/Fast. Stylise: Glow (threshold → blur → add/screen, with colour & intensity), Drop Shadow, Inner/Outer Glow, Noise (value/simplex/grain, animated by seed + evolution), Fractal Noise, Pixelate/Mosaic, Chromatic Aberration, Vignette, Scanlines, Posterise. Distort: Displacement Map, Turbulent Displace, Wave Warp, Ripple, Bulge, Twirl. Generate: Gradient Ramp, Checkerboard, Grid.
4. **Colour correction.** Brightness/Contrast, Levels, **Curves** (UI: draggable bézier/monotone-cubic curve per channel → 256-entry LUT texture), Hue/Sat/Lightness, Vibrance, Exposure/Gamma, Colour Balance (lift/gamma/gain wheels), Tint/Tritone, Invert, Channel Mixer, Selective Colour (P1). Scopes: histogram/waveform (P1) rendered from a downsampled readback.
5. **Linear-light path.** When `settings.linearLight`, decode sRGB→linear on texture/uniform input and use RGBA16F targets; encode on present/export. Effects declare whether they expect linear (blur/glow) or perceptual (levels/curves) input and the graph inserts converts only where needed.
6. **Preset animations.** Presets are JSON "keyframe templates": `{targets: [{prop, keys:[{t,v,ease}], relative: boolean}], duration, anchor: 'in'|'out'|'playhead'}` applied to a selected layer's props (relative values scale from the layer's current values). Categories from spec §7.13 (In/Out/Emphasis/Loop/Text/Shape/Transitions); preview-on-hover thumbnails; user presets saved to OPFS/IndexedDB; export/import as `.ripple-preset`.
7. **Platform work in this milestone:** move rendering to a **Worker + OffscreenCanvas** (document snapshots posted via structured clone; the main thread keeps overlays/UI); start the **WebGPU** backend behind the same `Renderer` interface *only if* profiling shows WebGL2 effect chains missing budgets on M1 (otherwise defer — the interface keeps the door open).

**Tests / exit:** golden images per effect (parameter sweeps), uber-shader fusion equivalence tests (fused vs sequential within tolerance), LUT/curve unit tests, preset-apply unit tests. **Budgets:** 1080p, 5-effect stack, 60 fps preview on M1 iPad (otherwise automatic half/quarter-res preview quality, already planned in §10). **Exit → beta:** README/landing changes, in-app feedback link, crash-free autosave soak test.

---

## M6 — Media  (L)

1. **Asset manager.** Content-addressed assets (`sha-256` of bytes) in OPFS `assets/`, project references by hash; Assets panel (grid, rename, replace, delete-unused, "where used"); dedupe on import; missing-asset placeholder.
2. **Images.** PNG/JPEG/WebP/AVIF/HEIC (via Safari decode) → `ImageBitmap` → texture with mipmaps; premultiply handling; EXIF orientation; max texture size guard (tile/downscale >8192).
3. **SVG import** → native shape layers: path `d` parser (M/L/H/V/C/S/Q/T/A incl. arc→bézier), basic shapes, groups → one layer per shape (or a precomp for groups), fills/strokes/gradients, transforms, `viewBox`. Anything unsupported (filters, masks, CSS) reports a summary instead of failing.
4. **Video.** Demux with `mp4box.js` (MP4/MOV) → WebCodecs `VideoDecoder`; seek by nearest preceding keyframe then decode forward; **frame cache** (LRU, byte-budgeted ~25% of the memory budget); **proxy generation** (½/¼-res H.264 transcoded in a worker, stored in OPFS) selected automatically for 4K / HEVC-heavy sources and when scrubbing; playback uses a forward-decode ring buffer; `HTMLVideoElement`+`requestVideoFrameCallback` fallback. Time remapping and speed (constant) in the layer; audio is out of v1 scope (muted, noted in UI).
5. **Thumbnails** for library cards (render frame 0 of each project → WebP in IndexedDB) and the layer/asset lists.
6. **Memory governor.** Central budget (target ≤ 1.2 GB resident on 8 GB iPads), texture/frame LRU, `pagehide` flush, a "low memory" mode that drops proxies to ¼-res.

**Tests / exit:** unit tests for the SVG parser (corpus of ~40 real icons), decode-seek tests with a generated clip, memory-governor eviction tests. **Exit:** a 4K H.264 clip scrubs without stutter via proxy on M1 iPad; import → save → reload keeps assets.

---

## M7 — Export, files and backup  (M)

1. **Render queue**: multiple jobs, per-job comp/range/format/res scale/fps; persists across reloads (resumes or restarts cleanly).
2. **Formats**: MP4 H.264 + HEVC (where available), WebM VP9/AV1 (`webm-muxer`), **GIF** (`gifenc`, dithering, palette per frame/global, size estimate), PNG/JPEG/WebP sequences, single stills; alpha: PNG/WebP/WebM-VP9 with alpha; frame-rate/resolution overrides; "export current frame" shortcut.
3. **Speed**: worker-driven pipeline with 2–3 frames in flight, `VideoFrame(canvas)` zero-copy, hardware-encoder hints; benchmark in CI-like script on the device pass. Target ≥ 2× realtime at 1080p30.
4. **`.ripple` bundle**: zip (`fflate`) containing `project.json` (+ schema version) and `assets/`; import (picker + share-sheet "Open in RippleFlow" via the PWA file-handler/share-target where Safari supports it) and export; **"Export backup" nudge** for non-installed/ITP sessions (spec §15).
5. **Autosave hardening**: write-ahead copy (`<id>.json.tmp` → rename), versioned snapshots (last 5) with restore UI, corruption detection with recovery.

**Exit:** 1080p export ≥ 2× realtime on M1 iPad; `.ripple` round-trip test (export → delete → import → identical render hash).

---

## M8 — Advanced  (L+)

1. **Shader layers & effects.** GLSL ES 3.0 fragment editor (CodeMirror 6, lazy-loaded) with Shadertoy-style uniforms (`iTime`, `iResolution`, `iMouse`-less, `iChannel0` = layer below/ref layer), custom uniforms declared via `// @uniform name type min max default` comments → auto-generated, **keyframable** controls; live compile with line-accurate errors, safe-fallback on failure, per-shader perf warning; starter gallery (gradient, plasma, voronoi, scanline, kaleidoscope…). Sandbox: no network/DOM access by construction; iteration/time guards via a watchdog (device-lost recovery).
2. **Lottie export.** Profile-based (Lottie-web compatible; features unsupported in the target are listed in a **compat report** before export): shape layers (paths/primitives/fill/stroke/gradients/trim/repeater/round corners), solids, nulls/parenting, precomps, transform/opacity keyframes with bézier `i/o` handles (hold keys → `h:1`), masks, track mattes, basic text, images, markers, layer timing. Elastic/Bounce eases are **baked to keyframes** at export (sampled adaptively).
3. **Lottie import.** Bodymovin JSON → native layers/props (no lottie runtime dependency in the document); `.lottie` (dotLottie zip) support; warnings for unsupported features (expressions, 3D, some effects) with graceful degradation.
4. **Round-trip suite.** devDependency `lottie-web` rendered headlessly vs RippleFlow render of the same JSON, per-feature scenes, perceptual-diff threshold; CI artifact reports.
5. **Motion blur.** Per-layer switch + comp shutter angle/phase; temporal supersampling (N sub-frames accumulated in RGBA16F; adaptive N from motion magnitude), off in interactive preview unless "motion blur" toggled, always on in export.
6. **Text animators.** Range selector (start/end/offset, chars/words/lines, shape: square/ramp/triangle/round/smooth) with per-animator properties (position, scale, rotation, opacity, colour, blur, tracking); "animate in by char/word/line" presets; needs per-glyph layout (move text rasterisation to glyph runs).
7. **3D LUT**: `.cube` import (17³/33³ → 2D strip texture or `TEXTURE_3D`), intensity, as an effect and as a project-level output transform.
8. **Carried-over debt (pick up here if not done earlier):** spatial bézier handles on motion paths, speed graph, graph zoom, saved curves, gradient keyframing, shape groups.

**Exit:** Lottie round-trip suite green for the supported profile; a shader layer and a text animator survive save/load/export.

---

## M9 — Polish & 1.0  (M)

Onboarding tour + starter templates (logo reveal, lower third, kinetic type, loader), accessibility pass (focus order, VoiceOver labels, reduced-motion, contrast, min 44 pt targets already enforced), full keyboard map + shortcut sheet, Pencil ergonomics pass (palm rejection, hover where exposed), **real-device performance tuning**, splash screens/icon set, offline-first soak tests, docs site (GitHub Pages `/docs`), in-app help, final bug bash. **Open decisions to close here:** product name/trademark check (avoid Adobe-derived terms; spec §16), licence notices screen for bundled fonts/libs, analytics stance (default: none).

**Exit:** all spec §14 P0 acceptance criteria met; tagged `v1.0.0`.

---

## 2. Cross-cutting tracks (run alongside every milestone)

- **Quality gate in CI** (from M4): unit tests + golden-image tests (artifact diffs) + Playwright smoke e2e (create → draw → keyframe → save → reload) + size budget (JS gz ≤ 250 KB, lazy chunks for shader editor / Lottie / video demux).
- **Real-iPad pass at the end of every milestone** (checklist in `docs/device-pass.md`, to be created in M4): install from Pages, touch/Pencil gestures, memory (Safari remote inspector), thermal/perf traces, offline launch. Headless Chromium does not prove touch behaviour — this has been the main unverified risk since M0.
- **Schema/versioning:** every document-shape change bumps `Project.v` with a tested `migrate()` step; old `.ripple` files must keep opening.
- **Performance budgets** (spec §10) are asserted in a benchmark script that runs headlessly for regressions and on-device for truth.

## 3. Decisions (confirmed by the user)

1. **M4.5 export-lite before M5:** yes.
2. **Public beta:** after M5.
3. **WebGPU:** only if profiling demands it; stay on WebGL2 otherwise.
4. **Audio:** out of v1.
5. **Product name:** **RippleFlow** (renamed from "Ripple"). The repo, GitHub Pages path (`/Ripple/`), `.ripple` file extension and internal identifiers keep the old name for now; a formal trademark/name check is still due before the public beta (M9 checklist).

## 4. Next action

Start **M4** with the v2 document migration + render-graph refactor behind a feature-parity golden test (everything that renders today must render pixel-identically), then add blend modes → masks → mattes → precomps → adjustment layers → transform handles, one PR each.
