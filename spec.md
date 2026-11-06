# RippleFlow — Specification

> A powerful, lightweight motion-graphics editor that installs as a PWA on iPad and is tuned for Apple M1 (iPad Air 5 / iPad Pro M1+).

Status: **Draft v0.1** · Owner: @sibunayy · Target: **iPadOS 26+** Safari/standalone PWA (minimum), desktop Chrome/Safari/Firefox as secondary. Licence: MIT.

---

## 1. Goals, non-goals, principles

### Goals
1. After Effects-class 2D motion design (layers, keyframes, effects, mattes, parenting) that is genuinely usable with **touch + Apple Pencil**, and equally good with Magic Keyboard + trackpad.
2. **Installable and offline-first.** No server, no account. Everything runs on-device; the only network use is first load/updates.
3. **Fast on M1.** 1080p30 playback of a typical comp (≈20 layers, a few effects) at full speed; interactive editing at ≥60 fps UI.
4. **Small.** Initial JS ≤ 250 KB gzip (shell + renderer core); everything else lazy-loaded. No heavy framework.
5. **Open formats.** Native project = plain JSON in a zip; interchange via Lottie JSON; export to MP4, PNG sequence, GIF, WebM, SVG still.

### Non-goals (v1)
- 3D layers/cameras, particle systems, motion tracking, audio editing beyond a single reference track, scripting/expressions language (planned for v2, see §14), multi-user collaboration, cloud sync.

### Design principles
- **Touch-first, not touch-tolerant.** 44 pt minimum hit targets, direct manipulation, gestures for everything, no hover-only affordances (M1 iPads have no Pencil hover).
- **Everything animatable.** Any numeric/colour/vector/path property can hold keyframes.
- **Non-destructive.** Effects, masks, mattes and blend modes never alter source media.
- **Deterministic.** Same project + same frame = same pixels, on preview and export. Frame rendering is a pure function of `(document, time)`.
- **Budget the GPU, not the CPU.** M1's unified memory and tile-based GPU reward fewer passes and fewer render-target switches; design the renderer around that (§6).

---

## 2. Tech stack

| Concern | Choice | Rationale |
|---|---|---|
| Language | TypeScript (strict) | Safety on a large data model |
| Build | Vite + esbuild, `vite-plugin-pwa` (Workbox `generateSW`, prompt-for-update) | Fast, small output, code-splitting |
| UI | **Preact + @preact/signals** (~4 KB) + hand-written CSS (custom properties, container queries) | Fine-grained reactivity for timeline/inspector without VDOM churn |
| Rendering | **WebGPU** is the primary backend on iPadOS 26+ (compute-based blur/glow, fewer passes); **WebGL2** backend kept behind the same `Renderer` interface as the fallback for desktop browsers without WebGPU and as the first implementation (M1) | iPadOS 26 guarantees WebGPU in Safari; WebGL2 gets the renderer working early and covers other browsers |
| Vector raster | Own GPU path tessellation (earcut + stroker) with `Path2D`/`OffscreenCanvas` fallback for complex strokes | Resolution-independent, avoids 2D-canvas→texture upload per frame when path unchanged |
| Text | Shaping/measuring with Canvas 2D; glyphs rasterised to an **MSDF atlas** (lazy, cached) | Crisp at any scale, cheap per-character animation |
| Video decode | **WebCodecs** `VideoDecoder` + `mp4box.js` demux; fallback `HTMLVideoElement` + `requestVideoFrameCallback` | Frame-accurate scrubbing, hardware decode on M1 |
| Video encode | **WebCodecs** `VideoEncoder` (H.264/HEVC) + `mp4-muxer`; WebM via `webm-muxer` | Hardware encode, no wasm ffmpeg |
| Threads | Main thread = UI; **render worker** owns `OffscreenCanvas`+GL context; **decode worker** per video asset; **IO worker** for OPFS | Keeps UI at 60 fps while rendering |
| Storage | **OPFS** for assets/autosaves, **IndexedDB** for project index & settings; `navigator.storage.persist()` requested on first save | Large binary storage, survives eviction better |
| Files | File System Access API where present; otherwise `<input type=file>` import and Share Sheet / download export | iPadOS Safari lacks FSA — Files app via share/export |
| Tests | Vitest (unit), Playwright (WebKit, e2e + golden-image render tests) | WebKit matches iPad engine |
| Hosting | GitHub Pages via GitHub Actions (`main` → `gh-pages`); versioned asset hashes | Zero-cost, static |

Dependency policy: every dependency must be justified in the PR; prefer ≤ 5 KB gzip libs or lazy-loaded modules (`mp4box`, `mp4-muxer`, `gifenc`, `earcut`, `fflate`).

---

## 3. PWA & iPad requirements

- `manifest.webmanifest`: `display: standalone`, `orientation: any`, theme/background colours, 192/512/maskable icons, **apple-touch-icon** 180 px, `apple-mobile-web-app-capable`, status-bar style `black-translucent`, splash images for common iPad sizes.
- Service worker: precache shell; runtime-cache lazy chunks (stale-while-revalidate); **update toast** ("New version — Reload") never auto-reloads mid-edit.
- Works fully offline after first load (verified in CI by Playwright offline mode).
- Safe-area insets (`env(safe-area-inset-*)`), Stage Manager / Split View / Slide Over resize handling (layout is continuous, no fixed breakpoints beyond three: compact < 700 px, regular, wide > 1200 px).
- Disable browser gestures that conflict: `touch-action: none` on canvas/timeline, `overscroll-behavior: none`, prevent double-tap zoom, `-webkit-touch-callout: none`, `user-select: none` except text fields.
- Input: Pointer Events with `pressure`, `tiltX/Y`, `pointerType` (pen/touch/mouse); coalesced + predicted events for pen drawing; palm rejection (ignore touch while pen active in draw tools).
- Keyboard: full shortcut map for Magic Keyboard (§9.6); on-screen shortcut sheet via ⌘ long-press equivalent (`?` key / toolbar button).
- Memory: iPadOS can kill tabs at ~1.5–3 GB. Hard budget **≤ 1.2 GB** total (textures + decoded frames + JS). Evict LRU textures/frames; never hold more than N decoded frames per video (N = 8 default).
- Autosave every 10 s of idle after change and on `visibilitychange: hidden` / `pagehide`; crash recovery prompt on next launch.
- Haptics are unavailable on web; use subtle sound-free visual feedback (snap flashes).

---

## 4. Product overview & UI layout

### 4.1 Workspace (landscape, regular width)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Top bar: ☰ Menu · Project name · Undo/Redo · Tool palette · Export ▸     │
├───────────┬──────────────────────────────────────────┬───────────────────┤
│ Left      │                                          │ Right panel       │
│ panel     │              Viewer (canvas)             │ (tabbed)          │
│ Project / │       transform handles, guides,         │ Inspector ·       │
│ Assets /  │       pen/shape/text tools               │ Effects · Presets │
│ Layers    │                                          │ · Colour          │
│ (tabbed)  ├──────────────────────────────────────────┤                   │
│           │ Transport: ⏮ ▶ ⏭ · timecode · loop · zoom │                   │
├───────────┴──────────────────────────────────────────┴───────────────────┤
│ Timeline: layer rows │ property rows │ keyframes │ work area │ playhead  │
│ (toggle Dope-sheet ⇄ Graph editor)                                       │
└──────────────────────────────────────────────────────────────────────────┘
```

- All panels are **dockable/collapsible**; panel layout persisted per-device. Compact width collapses to a single viewer + bottom sheet with tabs (Layers / Timeline / Inspector / Effects).
- Dark theme default (neutral greys, one accent), light theme and auto via `prefers-color-scheme`; OLED-friendly near-black viewer surround. Colour tokens as CSS custom properties.
- Typography: system font (`-apple-system`), tabular numerals for timecodes.
- Motion: UI transitions ≤ 150 ms, respect `prefers-reduced-motion`.

### 4.2 Touch & gesture map

| Gesture | Action |
|---|---|
| One-finger drag on canvas | Tool action (select/move, draw, etc.) |
| Two-finger pinch / drag | Zoom / pan viewer (always, any tool) |
| Two-finger tap | Undo · Three-finger tap: Redo |
| Double-tap layer in viewer | Enter edit mode (path nodes / text edit) |
| Long-press on layer/keyframe | Context menu |
| Drag on timeline ruler | Scrub (with audio-less frame snap) |
| Pinch on timeline | Time zoom · Two-finger drag: pan |
| Pencil double-tap (Pencil 2) | Toggle last two tools (configurable) — via keyboard-event fallback where exposed |
| Pencil pressure | Stroke width in freehand/ink tool; optional |
| Swipe left on layer row | Quick actions (lock, solo, delete) |
| Drag keyframe | Move in time (snaps to frames, other keys, markers) |
| Marquee on timeline | Multi-select keyframes |

---

## 5. Data model

Single immutable-style JSON document; edits go through **commands** producing patches (structural sharing). Schema versioned (`"v": 1`) with forward migrations.

```ts
interface Project {
  v: 1;
  id: string; name: string;
  settings: { width: number; height: number; fps: number;       // fps: 1–120, also 23.976/29.97/59.94
              duration: number /* frames */; bg: ColorRGBA;
              colorSpace: 'srgb' | 'display-p3'; pixelAspect: number };
  assets: Record<AssetId, Asset>;          // image | video | font | lut | shader | lottie
  comps: Record<CompId, Comp>;             // v1: one root comp + nested precomps
  rootComp: CompId;
  presets?: UserPreset[];
}

interface Comp { id; name; width; height; fps; duration; bg; layers: Layer[]; markers: Marker[]; workArea: [in, out] }

interface Layer {
  id; name; type: 'shape'|'text'|'image'|'video'|'solid'|'null'|'precomp'|'adjustment'|'shader';
  parent?: LayerId;                         // transform parenting (§7.5)
  in: number; out: number; startTime: number; stretch: number; // frames; for trimming/slipping
  transform: { anchor: Prop<Vec2>; position: Prop<Vec2>; scale: Prop<Vec2>;
               rotation: Prop<number>; opacity: Prop<number>; skew?: Prop<number>; skewAxis?: Prop<number> };
  blend: BlendMode;
  matte?: { layer: LayerId; mode: 'alpha'|'alphaInv'|'luma'|'lumaInv' };  // track matte
  masks: Mask[];
  effects: EffectInstance[];                // ordered stack
  color: LabelColor; flags: { visible; solo; lock; shy; motionBlur; collapse /*continuous raster*/ };
  content: ShapeContent | TextContent | MediaRef | SolidContent | PrecompRef | ShaderContent;
}

type Prop<T> = { value: T } | { keys: Keyframe<T>[] };         // static or animated
interface Keyframe<T> { t: number /*frames, float*/; v: T;
  in: Ease; out: Ease;                       // per-side interpolation
  spatial?: { inTan: Vec2; outTan: Vec2 };    // for position: motion-path bezier handles
  hold?: boolean; }
type Ease = { type:'linear' } | { type:'hold' } | { type:'bezier', x1:number,y1:number,x2:number,y2:number }
          | { type:'preset', name:string } | { type:'spring', stiffness, damping, mass } ;
```

Notes
- **Time is in frames (float)** inside the document, converted to seconds only at the boundary, so fps changes are lossless re-timings (option: *keep timing* vs *keep frames*).
- **IDs** are short nanoid strings. **Assets** referenced by content hash (SHA-256 of bytes) → automatic de-dup.
- Paths: `{ closed: bool; verts: [{p: Vec2, in: Vec2, out: Vec2, mode: 'corner'|'smooth'|'mirrored'}] }`, vertex-count must match across keyframes (morphing); mismatch is auto-resolved by subdividing.
- Colour stored as linear-float RGBA in-memory; sRGB/P3 hex for UI. Gradients: stops with animatable colour & position.

### 5.1 Command / undo system
- Every mutation is a `Command { do(doc)→patches, label }`; history is a patch stack with coalescing (continuous drags = 1 entry). 200-step default, memory-capped.
- Selection, tool and UI state are **not** in history.
- Autosave serialises the document, not the history.

### 5.2 File format — `.ripple`
- ZIP container (`fflate`): `project.json`, `assets/<hash>.<ext>`, `thumb.png`, `meta.json`. Stored (no deflate) for already-compressed media.
- Open: via file picker / share-sheet "Open in RippleFlow" (PWA `file_handlers` where supported) / drag-and-drop.
- Save: autosave to OPFS ("Projects" library) + **Export .ripple** to Files via share sheet. "Save" is instant (writes to OPFS); "Save a Copy…" exports.

---

## 6. Rendering architecture (M1-tuned)

### 6.1 Frame pipeline
`evaluate(doc, t)` → **RenderList** → GPU passes. Evaluation is pure CPU (cheap); rasterisation and effects are GPU.

1. **Evaluate**: resolve animated props at `t` (bezier solve cached per segment), apply parenting matrices top-down, compute layer visibility (in/out, solo), expand precomps.
2. **Plan**: build a pass graph; cull layers outside viewport/time; detect *static subtrees* (no animated props, no time-varying media) and mark them cacheable.
3. **Execute** on the render worker:
   - Layer content → texture (shape: tessellated mesh drawn directly into layer RT; text: MSDF quads; image/video: sampled texture).
   - Layer **effect chain** → ping-pong between two RTs (`RGBA16F`; `RGBA8` when the chain is colour-safe and tiny).
   - Mask/matte → multiply alpha during the layer's final composite pass (matte layer rendered to an `R8`/`RGBA8` texture first, reused if the same matte feeds several layers).
   - **Composite** into the comp accumulation buffer using the blend mode in a shader (read from accum via framebuffer-fetch where available, otherwise ping-pong).
4. Present to the visible canvas; on export, read back / feed `VideoFrame` directly from `OffscreenCanvas` (`new VideoFrame(canvas)`), no `readPixels` in the hot path.

### 6.2 Performance techniques
- **Minimise pass count**: fuse adjacent cheap per-pixel effects (colour correction, levels, hue/sat, opacity, simple blend) into one **uber-shader** generated at runtime & cached by effect-signature.
- **Minimise render-target switches** (tile-based GPU): batch layers sharing a blend mode & no effects into a single direct draw into the accumulation buffer; use `invalidateFramebuffer` after use to avoid store-back.
- **Half-float** intermediates only when needed (glow/blur/colour-grading); `RGBA8` for plain compositing; `EXT_color_buffer_half_float`, `OES_texture_float_linear` feature-detected.
- **Separable, downsampled blurs**: dual-Kawase for large radii (glow, bloom, shadow), 2-pass Gaussian for small; quality auto-drops during interaction.
- **Dirty-region & frame cache**: LRU cache of rendered comp frames (RGBA8, budgeted) so loops & scrubbing back are instant; the cache key = hash of `(frame, doc revision of affected layers)`. RAM-preview fill in background while idle.
- **Adaptive quality**: Full / Half / Third / Quarter viewer resolution, auto-throttle if frame time > budget; DPR capped at 2 on viewer.
- **Texture atlases & pooling**: pool RTs by (size, format); never allocate per frame. Shape meshes cached by path hash; re-tessellate only when path/stroke props change.
- **Video**: decode worker keeps a small ring of `VideoFrame`s around the playhead; uses `importExternalTexture`-like zero-copy upload path (`texImage2D(VideoFrame)`), closes frames promptly. Proxy generation (½ res H.264, in OPFS) for 4K+ sources.
- **Frame pacing**: `requestAnimationFrame` driven; playback clock is time-based (drops frames rather than slowing audio-free playback); optional "play every frame".
- **Colour**: working space linear-light option (default off → "display-referred" like AE default, on → physically correct blends/glows). Display-P3 canvas where supported (`colorSpace: 'display-p3'`).
- Perf HUD (toggle): frame ms CPU/GPU (`EXT_disjoint_timer_query_webgl2` if exposed), pass count, texture MB, cache hit rate.

### 6.3 Renderer interface
```ts
interface Renderer { init(canvas): Promise<void>; render(list: RenderList, target: Target): void;
  readFrame(): VideoFrame; resize(w,h,dpr): void; dispose(): void; caps: Caps }
```
`WebGL2Renderer` is built first (M1); `WebGPURenderer` lands in M5 and becomes the default on iPadOS 26+ once it passes the same golden images (±1 LSB tolerance). WebGL2 remains the fallback.

### 6.4 Motion blur & timing
- Layer-level motion blur: N sub-frame samples (default 8, adaptive up to 32) accumulated in `RGBA16F`, shutter angle 0–720°, phase offset. Only layers with the flag + animated transform are re-rendered per sample.
- Time remap, stretch, reverse, freeze frame, frame blending (off / blend / optical-flow-lite *later*).

---

## 7. Feature specification

Priority tags: **P0** = v1.0 must ship, **P1** = v1.x, **P2** = later.

### 7.1 Layers (P0)
- Types: Shape, Text, Image, Video, Solid, Null, Precomp (nested comp), Adjustment (affects layers below), Shader (§7.12).
- Operations: add, duplicate, delete, rename, reorder (drag), group-to-precomp, split at playhead, trim in/out (drag edges), slip (move content within bounds), time-stretch, lock/hide/solo/shy, colour labels, multi-select, align & distribute, copy/paste (incl. cross-project via clipboard JSON).
- Layer-level 2D transform: anchor, position (with separable X/Y option), scale (linked/unlinked, negative = flip), rotation (with turns), opacity, skew.
- Precomps: open/enter via double-tap, breadcrumb navigation, collapse-transformations toggle, time-remap.
- **Layer panel**: thumbnail, visibility eye, solo, lock, label colour, blend-mode column, matte column, parent-pick-whip column (touch: tap "link" icon then tap target layer).

### 7.2 Blend modes (P0)
Normal, Dissolve (stochastic, deterministic noise), Darken, Multiply, Colour Burn, Linear Burn, Darker Colour, Lighten, Screen, Colour Dodge, Linear Dodge (Add), Lighter Colour, Overlay, Soft Light, Hard Light, Vivid Light, Linear Light, Pin Light, Hard Mix, Difference, Exclusion, Subtract, Divide, Hue, Saturation, Colour, Luminosity. Plus *Alpha Add*, *Stencil/Silhouette Alpha/Luma* (P1). All implemented to match Photoshop/AE formulas (verified by golden tests against reference values). Blend applies in working colour space (§6.2).

### 7.3 Colour correction (P0 → P1)
Effects (all keyframeable, GPU, fusable):
- **P0**: Brightness/Contrast, Exposure/Gamma/Offset, Levels (per-channel + input/output/gamma), **Curves** (RGB + per-channel, editable spline UI), Hue/Saturation/Lightness, Colourise/Tint, Invert, Threshold, Posterize, Vibrance, Temperature/Tint, Fill, Tritone/Gradient Map.
- **P1**: Lift/Gamma/Gain colour wheels, Selective colour, Channel mixer, **3D LUT** (.cube import, trilinear), Colour balance, Lumetri-lite look presets, vectorscope/waveform/histogram scopes (compute on downsampled frame).
- Adjustment layers apply any stack to everything beneath, restricted by masks.

### 7.4 Masking & mattes (P0)
- **Masks** on any layer: unlimited, each with path (editable bezier, animatable, §7.7), mode (Add, Subtract, Intersect, Lighten, Darken, Difference, None), opacity, feather (uniform; variable-width feather P1), expansion, invert.
- Mask creation: pen tool, rectangle/ellipse/rounded rect, "auto-trace alpha" (P2).
- **Track mattes**: Alpha, Alpha Inverted, Luma, Luma Inverted, with any layer as the matte (matte layer auto-hidden, toggle). Touch UX: tap matte pick-whip, tap source layer.
- Stencil/silhouette blend modes (P1).
- Clipping to parent shape group / "clip to layer below" convenience toggle.

### 7.5 Parenting (P0)
- Any layer can be parented to any other (including Null) without cycles (cycle detection on assignment).
- Child inherits transform (position, scale, rotation; opacity optional toggle), anchored at parent's anchor.
- Re-parenting keeps visual position (compensating transform) by default; hold modifier to "jump".
- Null objects have on-canvas handles; show parent link lines in viewer.
- Parent chains up to depth 64; evaluated once per frame via topological order.

### 7.6 Keyframes, easing, graph editor (P0)
- Stopwatch toggle per property → creates keyframe at playhead. Auto-key mode: editing an animated property writes a keyframe.
- Keyframe interpolations: **Linear, Hold, Auto-Bezier, Bezier (editable), Ease In/Out/Both (preset), Spring, Overshoot/Bounce, Steps**; separate in/out per keyframe; spatial bezier (motion path) for position with on-canvas editable handles; "auto-orient to path".
- **Dope-sheet view**: keyframes as diamonds with shape indicating ease; multi-select, box-select, nudge ±1 frame via arrows, drag to retime, scale selection in time (pinch), copy/paste, reverse, snap to markers/playhead/other keys.
- **Graph editor**: value graph and speed graph; drag bezier handles (touch-sized), per-axis separation, normalise view, fit-to-selection, cubic-bezier numeric entry, **easing library** (Sine/Quad/Cubic/Quart/Quint/Expo/Circ/Back/Elastic/Bounce × In/Out/InOut = 30 curves), user-saved curves.
- Property types: number, Vec2/Vec3, colour (interpolated in linear or perceptual OKLab — setting), path (vertex interpolation), text (per-character animators P1), enum (hold only), boolean (hold).
- Time tools: markers (named, coloured), work area (in/out) for preview & export, loop region, jump to next/prev keyframe, time-display toggle (frames / timecode / seconds).
- **M2 implementation notes.** Each keyframe stores one easing for the segment *after* it (not separate in/out per key), which is what the graph-editor handles edit; the 30-curve library is 24 cubic-béziers plus Elastic/Bounce as function curves. Not yet built: spatial (motion-path) bézier handles on the canvas (the motion path is drawn, not editable), per-axis separated easing, speed graph, graph zoom/pan, user-saved curves, cross-row marquee selection (marquee sweeps within one property row; tap a property name to select all its keys), time-display toggle.
- **Sequence keyframes** / stagger: select layers → "Sequence layers" with offset and overlap (P1).
- Property linking without expressions: "link to parent property" (P1); expressions (P2).

### 7.7 Shapes & editable curves (P0)
- Shape primitives: Rectangle (per-corner radius), Ellipse, Polygon, Star, Line, Path (pen), Freehand (Pencil ink with smoothing → bezier fit).
- **Pen / node editor**: add/delete/convert nodes (corner ↔ smooth ↔ mirrored), drag handles, segment drag, break/join handles, close/open path, node multi-select with box, snap to grid/guides/other nodes, numeric coordinate entry. Large (≥ 28 px) node targets with zoom-compensated sizing.
- **Shape group content model** (AE-style): Group → [paths…, fills, strokes, gradient fill/stroke, modifiers]. Reordering modifiers changes results.
- Fill: solid, linear/radial/angular gradient (editable on-canvas handles), fill rule (non-zero/even-odd), opacity.
- Stroke: width (pressure profile P1), cap (butt/round/square), join (miter/round/bevel), miter limit, dashes (+ offset animatable), gradient strokes.
- **Path modifiers** (P0→P1): Trim Paths (start/end/offset — the motion-graphics staple), Offset Path, Round Corners, Zig-Zag, Wiggle Paths, Repeater (copies, offset transform, opacity ramp), Merge/Boolean (Add, Subtract, Intersect, Exclude; P1), Twist/Pucker & Bloat (P2).
- Convert to/from: text → outlines (P1), SVG import (paths, groups, fills, strokes, gradients) → shape layers (P0), shape → SVG export (P1).
- Path morphing: animate path vertices; vertex-count mismatch auto-resolved.

- **M3 implementation notes.** *Deviations (deliberate, for M3 scope):* (1) shape and text layers are rasterised with Canvas2D at preview-buffer resolution, clipped to their on-screen bounds, and uploaded as premultiplied textures; mesh tessellation (§6.1) is deferred and only needed if profiling on M1 hardware says so. (2) A shape layer holds ONE geometry (rect, ellipse, polygon, star or bézier path) plus one fill, one stroke, optional trim paths and an optional repeater — not the full AE group/modifier tree; multiple shapes are multiple layers (or precomps from M4). (3) Animatable shape/text parameters live in `Layer.props` (e.g. `fill.color`, `stroke.width`, `trim.end`, `shape.size`, `text.size`) and are addressed by the same keyframe/graph/dope-sheet machinery as transforms. (4) Gradient stops/endpoints and path nodes are static (not keyframable) in M3; path morphing arrives with masks in M4. (5) Text layers support single-style text (family, size, tracking, line height, align, bold/italic, fill/stroke/gradient) with on-canvas editing; text animators, box text and text-on-path are M8. *Fonts:* Inter, Source Serif 4, JetBrains Mono and **Space Grotesk** (the chosen display face, SIL OFL) are bundled as Latin-subset variable woff2; imported .ttf/.otf/.woff/.woff2 fonts are stored in IndexedDB and shared across projects. *Tools:* V select, H hand, R rectangle, E ellipse, Y polygon, S star, L line, P pen, T text; pen = tap for corners, drag for smooth handles, tap first node to close, Enter/double-tap to finish; node editing = tap node, drag node/handles (Alt breaks symmetry), double-tap the path to insert, Delete removes.

- **M4 implementation notes.** Render graph: per-comp accumulator RT; plain normal-blend layers draw straight onto it, layers with a blend mode, mask, matte or (M5) effects render to a pooled RT first, then combine via the blend shader (all 27 modes, W3C compositing, verified against a CPU reference by the golden suite) / modulate passes. Masks are Canvas2D-rasterised (add, subtract, intersect, lighten, darken, difference; invert, opacity, feather via `ctx.filter` blur, expansion via stroke) and path shapes can be keyframed (linear node interpolation, equal node counts; structural edits collapse to one key). Mattes: alpha / inverted alpha / luma / inverted luma, plus *clip to layer below*; matte sources are hidden. Precomps: `Project.comps`, recursive render, time offset, comps edited by swapping the editing view (history clears on entering/leaving a comp). Adjustment layers: coverage × mask × matte mixed over the accumulator; their effect stack arrives with M5. Transform handles (corner scale, shift = uniform; rotate handle, shift = 15° steps) and snapping to comp/other-layer edges and centres (Alt disables). *Deferred:* multi-layer transform, marquee select, guides/grid, lock/solo/shy, pick-whip parenting, per-frame precomp caching, non-integer comp-fps resampling, collapse-transformations.

- **M5 implementation notes.** `Layer.effects` is an ordered stack; parameters are ordinary animatable props `fx:<id>:<param>` (keyframes/graph/dope sheet work unchanged). Consecutive per-pixel colour effects fuse into **one generated shader** (cached by effect-chain signature; equivalence with sequential passes is a golden test); single-pass spatial effects share a generated template; blur/glow/drop-shadow are multi-pass (separable 25-tap Gaussian, automatic ½/¼-res for large radii). 29 effects: Brightness/Contrast, Exposure, Hue/Sat, Levels, **Curves** (monotone-cubic LUT, per-channel, touch editor), Tint, Tritone, Invert, Threshold, Posterize, Vibrance, Temperature/Tint, Fill, Noise/Grain, Vignette, Scanlines, Gradient Ramp, Pixelate, Chromatic Aberration, Directional/Radial/Gaussian Blur, Wave Warp, Ripple, Twirl, Bulge, Turbulent Displace, Glow, Drop Shadow. Adjustment layers run the same stack on everything below. **Linear light** (project toggle) uses RGBA16F targets (when float render targets exist), sRGB decode at texture/colour inputs and encode at present; effects flagged *perceptual* (levels, curves, hue/sat…) are evaluated in sRGB inside linear projects. **Presets:** 22 built-ins (In/Out/Emphasis/Loop/Shape) as relative keyframe templates, user presets saved to IndexedDB and exported/imported as `.ripple-preset`. *Deferred:* the Worker/OffscreenCanvas renderer and a WebGPU backend (profiling-gated per plan.md §3), scopes (histogram/waveform), lift/gamma/gain wheels, selective colour, displacement-map effect (needs layer-as-input), per-effect solo, effect copy/paste.

- **M6 implementation notes.** Assets are content-addressed (SHA-256) in OPFS `assets/` (IndexedDB fallback) and referenced from `Project.assets` (document v3); identical imports dedupe and duplicated projects share files. Import via picker, Assets tab or drag-and-drop onto the viewer: PNG/JPEG/WebP/AVIF/GIF(first frame)/HEIC (whatever the browser decodes), **SVG → native shape layers** (path/rect/circle/ellipse/line/polyline/polygon, nested groups, transforms baked in, solid + linear/radial gradient fills and strokes, opacity, caps/joins; unsupported features — text, clip-paths, masks, filters, `<use>` — are reported in a toast), or SVG as a flat image, and video. **Video** uses `HTMLVideoElement` (hardware decode on iPad): preview plays muted and re-syncs on drift, scrubbing seeks and redraws on `seeked`, export seeks every frame before rendering so output is deterministic; layers get source-start and speed controls. Media textures are LRU-evicted under a 384 MB budget. Library cards show a rendered frame-0 thumbnail. *Deviations / deferred:* WebCodecs + mp4box demuxing, frame cache and **proxy generation** are deferred — `<video>` handles 4K H.264/HEVC natively on Apple silicon; revisit if device testing shows scrub stalls. No audio in v1. Missing-asset placeholders and "relink" are not built (a layer with a missing file draws nothing); removing an asset from a project keeps the stored file because other projects may share it.

- **M7 implementation notes.** *Render queue:* jobs run one at a time in the background (Wake Lock held while running), editing continues, the Export button shows a live count; job specs persist so an interrupted queue reappears as *interrupted* with Restart (re-run from the saved project). *Formats:* MP4 (H.264) and WebM (VP9) via WebCodecs + mp4-muxer/webm-muxer, animated GIF (gifenc, per-frame palette, 1-bit transparency, centisecond delays), PNG/JPEG/WebP sequences (streamed zip) and stills; resolution (full/half/quarter), range, **frame-rate override** (time-resampled, not frame-blended) and transparent background for PNG/WebP/GIF. WebM alpha and ProRes are not offered (WebCodecs cannot encode alpha). Share sheet via Web Share when a gesture is available, otherwise Download. *Bundles:* `.ripple` = zip of `manifest.json`, `project.json`, `assets/<sha256>` (hash-verified on import) and the imported fonts used by text layers; import from the library creates a new project id; per-card **Backup**, plus a non-installed-site nudge. *Safety net:* automatic version snapshots (≤1/min, last 5) with an "Earlier versions" restore list in Settings, and automatic recovery from a snapshot when a project file fails to parse. *Not built:* PWA `file_handlers`/share-target (Safari does not support them), OPFS atomic rename (snapshots serve the same purpose), measured realtime-multiple benchmark on M1 hardware (the dialog reports the achieved multiple per job; the ≥2× target needs a device pass).

- **M8 implementation notes.** *Shaders:* `shader` layers and a *Custom Shader* effect run Shadertoy-style GLSL ES 3.0 (`mainImage`, `iResolution/iTime/iFrame/iChannel0`; the layer variant reads the composite below, the effect variant its own input); `// @uniform name float|vec2|color|bool min max default` comments generate animatable controls; compile errors are mapped to the user's line numbers and a failing shader simply draws nothing; 7 gallery examples. The editor is a plain monospace textarea (CodeMirror was deliberately skipped for bundle size). No timeout watchdog beyond WebGL context-loss recovery. *Lottie export* (lottie-web profile): solids, nulls, shape layers (paths/rect/ellipse/star/polygon, fill, stroke, linear/radial gradients, trim, repeater), parenting, precomps, masks, alpha/luma/inverted mattes (sources emitted directly above their consumer), 16 blend modes, basic text, embedded images, markers; bézier handles map 1:1, hold → `h:1`, elastic/bounce are baked to samples; every dropped feature (effects, adjustment/video/shader layers, mask feather, text animators, linear light…) appears in a compatibility report shown after export. *Lottie import* (`.json` and `.lottie`): one ripple shape layer per geometry with its group's fill/stroke/trim/repeater, non-identity group transforms become null parents, precomps → comps, embedded images → assets, masks/mattes/blend/parenting/markers, old-format keyframes; expressions, effects, 3D, time-remap, stretch and animated gradients are reported. **Round-trip suite:** `scripts/e2e/checks/m8-lottie.mjs` renders 14 feature scenes in RippleFlow and in lottie-web (devDependency) from the exported JSON and compares sampled pixels (±24/255). *Motion blur:* temporal supersampling (shutter angle, 2–32 samples, half-float accumulator) for layers flagged `motionBlur`; the viewer previews with ≤4 samples (MB toggle), exports use the project setting; not applied inside precomps. *Text animators:* range selector (start/end/offset, characters/words/lines; square, ramp, triangle, round, smooth) driving per-glyph position, scale, rotation, opacity and colour, plus six one-tap templates (fade/rise by character, pop by word, line reveal, typewriter, wave). *3D LUT:* `.cube` import (≤65³, DOMAIN_MIN/MAX honoured) stored as 8-bit RGB in the effect, trilinear `TEXTURE_3D`; as a project-level output transform, put it on a top adjustment layer. *Deferred:* dotLottie *export*, Lottie text-on-path, per-glyph blur/tracking animators, Lottie shape modifiers beyond trim/repeater/round-corners, scripted expressions.

- **M9 implementation notes.** *Onboarding:* a four-slide first-run welcome (once, `localStorage`), in-app **Help** (guide, shortcuts, formats, licences, version; `?` key) and four code-built **starter templates** (logo reveal, lower third, kinetic type, loader). *Accessibility:* modal dialogs trap focus, close on Escape and restore focus; every control has an accessible name (checked by an e2e sweep); 44 pt hit targets on coarse pointers; `prefers-reduced-motion` honoured; contrast of the two themes checked against WCAG AA for text. *Pencil:* touches within 1.5 s of pen input are ignored (palm rejection). *Performance tooling:* preview-quality setting (Auto/Full/Half/Quarter) where Auto steps the buffer scale down when playback draws slower than ~42 fps and back up when it recovers, plus an ƒ overlay (fps, CPU ms, buffer, RTs, passes); exports always render at full quality. *Packaging:* iPad launch images (10 sizes, not precached), docs in `docs/`, `docs/device-pass.md`, `docs/acceptance.md` (which criteria are automated vs still need an iPad). *Not done / honest status:* on-device performance tuning and the §13 criterion 7 budgets have **not** been measured — they need the device pass — so the project is versioned **1.0.0-rc.1** and no `v1.0.0` tag has been cut; the product name still needs a trademark clearance.

### 7.8 Text (P0)
- Point text and paragraph (box) text; edit on canvas with native iPad keyboard (hidden `contenteditable` proxy; supports dictation, hardware keyboard, IME).
- Properties: font family, weight, size, tracking, leading, baseline shift, alignment (L/C/R/justify), all-caps, small-caps, fill & stroke (with stroke-behind/over), per-run styling (character-level colour/size/font).
- Fonts: system fonts accessible by name; **import .ttf/.otf/.woff2** (stored in assets via `FontFace`); curated bundled open-licence set (Inter, a serif, a mono, a display; lazy-loaded, ≤ 300 KB total).
- **Text animators (P0-lite / P1-full)**: range selector (start/end/offset, units: characters/words/lines), shapes (square/ramp/triangle/round/smooth), properties per animator (position, scale, rotation, opacity, colour, blur, tracking) — the core of kinetic typography; plus "Animate in by character / word / line" presets.
- Text on path (P1), convert to shapes (P1), source-text keyframes (hold).

### 7.9 Image import (P0)
- PNG, JPEG, WebP, HEIC (via Safari decode), AVIF, GIF (first frame; animated GIF as video-like P1), SVG (→ vector shape layers or raster, user choice).
- Sources from Files, Photos, drag-and-drop, paste. Large images downscaled to GPU max texture size via mip chain (kept original in OPFS for export).
- Mipmapped trilinear + anisotropic (when available) sampling for downscale quality; optional pixel-art nearest mode.

### 7.10 Video import (P0)
- MP4/MOV (H.264, HEVC, ProRes only if WebCodecs allows), WebM. Audio ignored in render (P1: waveform display + one audio track preview + muxed audio on export).
- Frame-accurate scrubbing, in/out trimming, speed/time-remap, loop, freeze frame, alpha channel (HEVC-alpha where decodable).
- Auto-proxy for > 1080p; relink-to-original on export.
- Import from Photos/Files/drag-drop; estimated memory shown for large clips; sensible warnings.

### 7.11 Effects (P0 core, P1 broader) & presets

| Category | P0 | P1 / P2 |
|---|---|---|
| Blur & sharpen | Gaussian, Box, Directional (motion), Radial, Zoom, Sharpen | Bokeh/lens, Smart blur, Camera-lens blur with depth matte, Unsharp mask |
| Stylise | **Glow** (threshold/radius/intensity/colours), **Drop Shadow**, Inner Shadow, Outline/Stroke, Noise (grain), Pixelate/Mosaic, Vignette | Halftone, Scanlines/CRT, Chromatic aberration, RGB split, Glitch, Bloom, Edge detect, Emboss |
| Distort | Transform, Mirror, Tile, Wave, Ripple, Bulge/Pinch, Twirl | Displacement map, Turbulent displace, Mesh warp, Liquify-lite, Lens distortion |
| Generate | Gradient ramp, Fractal noise (simplex, animated evolution), Grid, Checkerboard, Fill | Voronoi, Cell patterns, Lens flare, Light rays, Beam, Radio waves |
| Keying & matte | Luma key, Colour key (simple) | Chroma key with spill suppression, Matte choker/feather |
| Time | Echo, Posterize time | Time displacement, Trails, Frame blend |
| Transition | Linear/radial wipe, Dissolve, Slide | Iris, Block dissolve, Glitch transition, Shader transitions |
| Colour | See §7.3 | |

Effect stack UX: add via searchable picker; drag to reorder; per-effect enable/bypass; opacity/mask per effect (effect blend with original; P1); copy effects to other layers; keyframes on every parameter; fuse-aware (the UI shows "fused ×3" in Perf HUD).

**Preset animations (P0):**
- Library browsable by category with live looping previews; tap to apply to selected layers at the playhead (or layer in-point); tap-and-hold to preview.
- Categories: **In** (fade, slide, scale-pop, drop-bounce, wipe, typewriter, blur-in, rotate-in, elastic-pop), **Out** (mirror set), **Emphasis** (pulse, shake, wiggle, heartbeat, jello, tada), **Loop** (float, spin, breathe, orbit), **Text** (char-by-char, word-by-word, line reveal, wave, scramble), **Shape** (trim-path draw-on, morph pulse, ripple burst), **Transitions**.
- Presets are just serialised property-patches (`{props → keyframes relative to a time anchor}`); users can **save selection as preset**, import/export `.ripplepreset` JSON.
- Presets scale to layer duration/anchor (in-point/out-point/playhead) and respect fps.

### 7.12 Shader support (P1 flagship)
- **Shader layer**: a full-comp fragment shader (GLSL ES 3.00, WebGL2) rendering generative content, with `uniform float u_time, u_frame; uniform vec2 u_resolution; uniform sampler2D u_input` (layer below, for adjustment-style use).
- **Shader effect**: same, attached to any layer, input = layer pixels. Output goes through the standard pipeline (masks, mattes, blend modes).
- **Auto-generated parameters UI** from annotated uniforms:
  ```glsl
  uniform float u_intensity;   // @ui slider min=0 max=2 default=1 name="Intensity"
  uniform vec3  u_tint;        // @ui color default=#ff8800
  uniform vec2  u_center;      // @ui point
  uniform sampler2D u_tex;     // @ui image
  ```
  All annotated uniforms are **keyframeable properties**.
- In-app editor: monospaced code editor (lazy-loaded CodeMirror 6 mini build, GLSL highlighting), live compile with inline error markers, hot-apply with no playback stop, built-in snippets (noise, SDF, ray-march starter, colour grade, displacement, transition).
- **Shadertoy-compatible shim** (`mainImage(out vec4, in vec2)`, `iTime`, `iResolution`, `iChannel0-3`) for paste-in of single-pass shaders (P1).
- Sandboxing: compile timeout + watchdog (render at lower res if frame > 100 ms; auto-disable shader with banner), no network, no texture reads outside provided samplers, uniform array size caps.
- Multipass (buffers A–D with feedback) P2; WebGPU/WGSL P2; compute shaders P2.
- Share: shaders are saved as assets in project; import/export `.glsl` with annotations.

### 7.13 Lottie import/export (P1 flagship)
**Export** (Bodymovin-compatible JSON, `.json`, plus `.lottie` zip container P1):
- Supported: shape layers (paths, rect, ellipse, star, fill, stroke, gradients, groups, trim paths, repeater, round corners), solids, null/parenting, precomps, transform & opacity keyframes with bezier easing, masks (all modes), track mattes (alpha/luma, inverted), text (as shapes by default, or glyph-embedded P1), images (embedded base64 or external).
- **Compatibility report** before export: list of unsupported features (effects like blur-other-than-Gaussian, shaders, video layers, most blend modes beyond Multiply/Screen/Overlay/…, motion blur) with options to *rasterise*, *drop*, or *abort*. Target profiles: **Web (lottie-web)**, **iOS (lottie-ios)**, **dotLottie / thorvg** (strict subset).
- Validate output through a bundled schema check; preview inside a lottie renderer (lazy-loaded `lottie-web` in sandboxed iframe) to confirm visual parity.

**Import**:
- Parse Bodymovin JSON → native RippleFlow layers/properties (no runtime lottie dependency in the document). Supports shapes, transforms, keyframes (bezier `i/o` handles → RippleFlow easing), masks, mattes, precomps/assets, parenting, trim paths, repeater, gradients, text (basic), images (embedded/external), layer timing (`ip/op/st/sr`), markers.
- Warnings list for unsupported items (expressions, certain effects); import still succeeds with placeholders.
- dotLottie (`.lottie`) zip support via `fflate`.

### 7.14 Project settings (P0)
- **New project dialog** with presets: HD 1920×1080, 4K 3840×2160, Square 1080², Vertical 1080×1920, Instagram/TikTok/YouTube/Twitter sizes, Lottie 512², Custom.
- Editable any time: width, height, pixel aspect, **fps** (preset list + custom, 1–120), duration (frames / timecode), **background colour** (with alpha for transparent export), colour space, working-space linear toggle, motion-blur defaults, preview quality, time display format, grid/guides/safe-margins settings.
- Changing resolution offers: *scale content* / *keep layer sizes* (anchors centre).
- Per-comp overrides for precomps.

### 7.15 Save / new / open / export (P0)
- **Project library** (home screen): grid of projects with thumbnails, last edited, rename, duplicate, delete, import `.ripple`, new from template (blank, lower-third, logo sting, kinetic text, social post).
- New (with confirm if unsaved — though autosave means no data loss), Save (instant), Save a Copy, Export `.ripple`, Revert to last save, auto-version snapshots (keep last 10 autosaves, restore from "History").
- **Export** (render queue, runs in worker, cancellable, progress + ETA, screen wake lock to avoid sleep):
  - **MP4** H.264 / HEVC (bitrate/quality, resolution scaling, fps), optional HEVC-alpha (P1).
  - **WebM** VP9 w/ alpha (P1), **PNG sequence** (zip), **GIF** (dither/palette options), **Animated WebP/APNG** (P1), **Still PNG/JPEG** of current frame, **SVG** still (P2), **Lottie** (§7.13), **.ripple**.
  - Range: full / work area / current frame; resolution multiplier 0.25–2×.
  - Delivery: Share Sheet (`navigator.share({files})`) → Files / Photos / AirDrop; download fallback.
  - Expected throughput target: 1080p30 H.264 export ≥ 2× realtime on M1 for a 20-layer comp.

### 7.16 Viewer & editing aids (P0)
- Zoom/pan (pinch), fit/100%/200%, transparency checkerboard, **safe margins**, rulers, guides (drag from rulers), grid, snapping (grid, guides, layer bounds/centres, canvas edges, with snap-flash feedback), pixel-grid at high zoom.
- Transform handles: scale (with corner/edge), rotate (outside corner), anchor-point move, skew; modifier = hold second finger/keyboard Shift for proportional/15° increments (on-screen toggle chips in the toolbar for touch).
- Viewer overlays toggles: motion paths, masks, layer bounds, parent lines, labels.
- Region of interest & preview resolution control; background: comp background / checkerboard / custom.
- RAM-preview indicator (green bar under ruler for cached frames).

---

## 8. Architecture & code layout

```
ripple/
├─ index.html
├─ public/                 manifest, icons, splash, fonts (open-licence)
├─ src/
│  ├─ app/                 shell, routing (library ⇄ editor), PWA registration, settings
│  ├─ ui/                  components (Panel, Slider, Scrubber, ColorPicker, CurveEditor, …) + theme.css
│  ├─ model/               types, schema, migrations, commands, history, selectors (pure, no DOM)
│  ├─ anim/                interpolation, easing library, bezier solver, spring, graph math
│  ├─ eval/                time → resolved layer state; parenting; precomp expansion; hit-testing
│  ├─ render/
│  │   ├─ gl/              WebGL2 renderer, pass graph, RT pool, tessellation, MSDF text
│  │   ├─ shaders/         blend modes, effects (glsl), uber-shader generator
│  │   ├─ worker.ts        render worker entry (OffscreenCanvas)
│  │   └─ gpu/             (later) WebGPU backend
│  ├─ media/               image/video/font import, decode worker, proxies, thumbnails
│  ├─ io/                  .ripple zip, OPFS store, IndexedDB index, autosave, share/export
│  ├─ export/              encoders (mp4/webm/gif/png-seq), render queue
│  ├─ interop/             lottie import/export, svg import
│  ├─ tools/               select, pen, shape, text, hand, zoom, freehand
│  ├─ timeline/            dope-sheet, graph editor, ruler, layer rows (canvas-rendered for speed)
│  ├─ presets/             built-in animation presets (JSON) + loader
│  └─ shader-lab/          shader editor, uniform annotation parser, snippets
├─ tests/                  unit, golden images, e2e
└─ .github/workflows/      ci.yml (lint, typecheck, test, build), deploy.yml (Pages)
```

Rules
- `model/`, `anim/`, `eval/` are **pure TS** with no DOM → fully unit-testable and shareable with workers.
- UI ⇄ render worker communicate over a typed message channel; the document is transferred as **patches**, not re-sent whole. Pointer events handled on main, hit-testing done in `eval/` on the main thread against a cached scene snapshot.
- Timeline rows and keyframe lanes are drawn on a `<canvas>` (virtualised) to stay smooth with hundreds of keyframes; DOM only for focus/accessibility proxies.
- Lazy chunks: `export/*`, `interop/*`, `shader-lab/*`, `presets` thumbnails, fonts, `mp4box`.

---

## 9. UX details

### 9.1 Tools
Select (V), Hand (H), Zoom (Z), Pen (P), Rectangle/Ellipse/Polygon/Star (R/E/Y/S shape flyout), Text (T), Freehand ink (B), Mask tool (M), Anchor point (A, via modifier), Eraser-for-nodes (P1).

### 9.2 Inspector
Context-aware: shows transform + layer-type sections + masks + effects. Every numeric field is a **scrubby slider** (drag horizontally to adjust, tap to type with numeric keypad; long-press for fine-adjust), with stopwatch/keyframe button and right-click equivalent (long-press) menu: *Reset*, *Link*, *Copy value*, *Easing…*.

### 9.3 Colour picker
HSB/OKLCH wheel + sliders, hex, eyedropper (EyeDropper API when available; in-viewer sample otherwise), swatches (project + global), opacity, gradient editor with draggable stops.

### 9.4 Feedback
Toasts for non-blocking info; blocking dialogs only for destructive actions; undo is always available instead of confirmations where possible.

### 9.5 Accessibility
- VoiceOver labels for all controls; timeline has keyboard + screen-reader accessible list proxy.
- Contrast ≥ 4.5:1 for text; focus rings; Dynamic Type respected in UI chrome (rem units); reduced-motion mode; colour-blind-safe label palette + icons.

### 9.6 Keyboard shortcuts (Magic Keyboard)
Space play/pause · J/K/L shuttle · ←/→ ±1 frame (⇧ ±10) · ⌥←/→ jump to keyframe · I/O set work area in/out · N/M marker · ⌘Z/⇧⌘Z undo/redo · ⌘D duplicate · ⌘C/V/X · ⌘S save · ⌘E export · ⌘N new · ⌘⇧C precompose · S/R/P/T/A/U reveal Scale/Rotation/Position/Opacity(T)/Anchor/Animated props · ⌘[ / ⌘] send backward/forward · ⌘K layer settings · `?` shortcut sheet. Fully re-mappable (P2).

---

## 10. Performance budgets & targets

Reference device: **iPad Air 5 (M1, 8 GB) in Safari standalone**.

| Metric | Budget |
|---|---|
| Cold start (cached) to interactive library | < 1.2 s |
| First load (uncached, 4G) | < 3 s, shell ≤ 250 KB gz |
| Editor open (typical project) | < 1.5 s |
| UI interaction latency (touch→visual) | < 50 ms; pen ink < 16 ms |
| Viewer playback 1080p30, ~20 layers, 3 glow/blur | 30 fps steady, ≥ 90% frames on time |
| Viewer playback 1080p60 simple (≤ 8 layers, no heavy effects) | 60 fps |
| Scrub latency (video layers w/ proxy) | < 80 ms to settled frame |
| Timeline with 2,000 keyframes | 60 fps pan/zoom |
| Memory peak (typical) | < 800 MB; hard ceiling 1.2 GB |
| Export 1080p30 H.264 | ≥ 2× realtime |
| Undo/redo | < 30 ms for typical edit |
| Autosave of 50 MB project | non-blocking, < 300 ms main-thread |

CI runs a headless perf benchmark (Playwright WebKit, software GL → relative regression guard, ±15%) and a manual device checklist before each release.

---

## 11. Quality, testing & security

- **Unit**: interpolation/easing math, bezier solver, command/undo, migrations, parenting cycles, Lottie round-trips, GLSL annotation parser.
- **Golden-image render tests**: curated set of ~60 scenes (every blend mode, mask mode, matte, effect, shape modifier, text feature) rendered via headless WebKit/Chromium; per-pixel tolerance; diff reports as CI artifacts.
- **Property/fuzz tests**: random documents → render doesn't throw, no NaN, memory returns to baseline.
- **E2E**: create project → add shape → keyframe → export; offline load; install-manifest validity; autosave recovery after forced reload.
- **Static**: ESLint, `tsc --noEmit`, bundle-size gate (fail if shell > 250 KB gz).
- **Security/privacy**: no analytics or network calls beyond static hosting; strict CSP (`script-src 'self'`; shader code compiled only through WebGL, never `eval`/`new Function`); imported files treated as untrusted (size caps, Lottie/SVG sanitised — no script, no external fetch); shader watchdog (§7.12).
- **Error handling**: global error boundary → "Recover last autosave" flow; GPU context-loss handler (`webglcontextlost/restored`) rebuilds resources transparently.

---

## 12. Milestones

| M | Name | Scope | Exit criteria |
|---|---|---|---|
| **M0** | Foundations | Repo, Vite+TS+Preact, CI/CD to Pages, PWA shell installable on iPad, theme, panel layout, project library, OPFS store, autosave | Installs to Home Screen, works offline, deploys on merge |
| **M1** | Core engine | Document model, commands/undo, evaluator, WebGL2 renderer (solids, transforms, opacity, normal blend), playback clock, viewer w/ zoom/pan, timeline (layers + playhead) | Animated solids play 60 fps; undo works |
| **M2** | Keyframes | Property stopwatch, dope-sheet, bezier interpolation, graph editor, easing library, markers, work area | Can animate position/scale/rotation/opacity with custom curves |
| **M3** | Shapes & text | Pen tool, node editing, primitives, fill/stroke/gradient, trim paths, repeater, text layers, on-canvas editing, font import | Draw-on logo animation achievable |
| **M4** | Compositing | All blend modes, masks, track mattes, parenting + nulls, precomps, adjustment layers | Golden tests pass for blends/masks/mattes |
| **M5** | Effects & colour | Effect framework + uber-shader fusion, blur/glow/shadow/noise/distort, colour-correction set, curves UI, preset animation library | Perf budgets hold with effect stacks |
| **M6** | Media | Image import, SVG import, video import via WebCodecs, proxies, thumbnails | 4K clip scrubs smoothly via proxy |
| **M7** | Export | Render queue, MP4/PNG/GIF/WebM, share sheet, `.ripple` import/export | 1080p export ≥ 2× realtime |
| **M8** | Advanced | Shader layers/effects + editor, Lottie export & import, motion blur, text animators, 3D-LUT | Lottie round-trip suite green |
| **M9** | Polish & 1.0 | Onboarding/templates, accessibility pass, perf tuning on device, docs, icons/splash, bug bash | All P0 acceptance criteria met |

Each milestone ends with a tagged release deployed to Pages and a short demo project in `examples/`.

---

## 13. Acceptance criteria (v1.0)

1. Install to iPad Home Screen, launch offline, create a 1080p30 project with a custom background colour, change to 60 fps and 4K, all without reload.
2. Build a 10-second animation using shapes (pen-drawn), text, an image, and a video; with parenting, a track matte, a mask, 5 blend modes, Glow + Gaussian Blur + a colour curve, and easing edited in the graph editor.
3. Apply a built-in preset to a text layer and a shape layer; save a custom preset and reuse it in another project.
4. Autosave survives a forced tab kill; reopening restores the last state.
5. Export MP4 (H.264), GIF, and PNG sequence; open in Files/Photos with correct colours and frame count.
6. Write a custom shader effect with a keyframed slider parameter; export the project to Lottie (compat report shown) and re-import the result with visually matching playback (within golden tolerance for the supported subset).
7. Performance budgets in §10 pass on an M1 iPad Air.

---

## 14. Roadmap beyond v1

Expression engine (sandboxed JS subset: `wiggle`, `loopOut`, `linkTo`), 2.5D/3D layers & camera, particles, audio waveform & mux, motion tracking (point/planar via WebGPU), multi-pass shaders & compute, variable-width strokes, boolean live-ops, collaborative editing (CRDT over WebRTC), Files-provider integration, Apple Pencil hover/squeeze when Safari exposes them, plugin API for community effects (WGSL/GLSL + JSON manifest).

---

## 15. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| iPadOS tab memory kills (jetsam) | Lost work, crashes on big video | Hard memory budget, LRU eviction, proxies, autosave on `pagehide`, recovery flow |
| WebCodecs gaps/bugs on Safari versions | Video import/export failures | Feature-detect, `HTMLVideoElement` fallback, minimum iPadOS check with clear message, test matrix |
| No File System Access API on iPadOS | Clumsy file handling | OPFS library as primary, Share Sheet for export, `.ripple` import via picker; clear UX around "where are my files" |
| WebGL2 limits (no compute, texture size 8k–16k, no float linear on some) | Effect quality/perf on fallback path | WebGPU primary on iPadOS 26+; WebGL2 feature detection and downsampled effects as fallback |
| Pencil hover/double-tap/squeeze not exposed to web | Reduced pen UX | Don't depend on them; offer on-screen/keyboard alternatives |
| Scope creep (it is "After Effects") | Never ships | Strict P0/P1/P2 gating; milestone exit criteria; ship M0–M5 as public beta |
| Lottie feature mismatch across players | Export looks different elsewhere | Target profiles, compat report, round-trip golden tests with lottie-web |
| Safari audio/autoplay and background-throttling | Playback glitches | Time-based clock, no audio dependency in v1 |
| Storage eviction (Safari ITP 7-day rule for non-installed sites) | Data loss | Encourage install (exempt from 7-day cap), request `persist()`, prominent "Export backup" |

---

## 16. Decisions

Resolved 2026-11-06:
1. **Minimum OS: iPadOS 26.** WebGPU and stable WebCodecs are guaranteed; no legacy fallbacks for older Safari on iPad.
2. **Linear-light compositing: off by default** (After Effects-familiar look); per-project toggle.
3. **Licence: MIT.**
4. **Bundled fonts:** Inter (sans), Source Serif (serif), JetBrains Mono (mono), plus one open-licence display face (to be chosen; must be OFL/Apache). Lazy-loaded, ≤ 300 KB total.

Still open:
- Naming/IP: avoid After Effects trademarks in UI strings and presets; use own terminology.
