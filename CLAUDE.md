# Ripple Flow

Motion design tool (layers, keyframes, easing, timeline, export) shipped as an installable PWA.
Primary target: iPad Air 5 (M1, 60Hz, 820x1180 pt viewport) as an installed Home Screen app, using Apple Pencil and touch.
Owner is not a coder: explain changes in plain words, keep diffs small, never leave the app broken between steps.

# Stack
- Vanilla HTML/CSS/JS, ES modules, no build step, no frameworks, no npm runtime deps
- Static hosting on GitHub Pages (HTTPS)
- Rendering: WebGPU + WGSL, no engine/library. Requires iPadOS 26+ (Safari 26). No WebGL fallback unless asked
- Canvas 2D only for UI chrome and for drawing text/shapes into textures

# Layout
- index.html, styles.css, manifest.webmanifest, sw.js
- js/main.js (boot), js/state.js (document model + undo), js/timeline.js, js/input.js, js/export.js, js/storage.js, js/ui/*
- js/gpu/device.js (adapter, device, canvas config, device-lost recovery), js/gpu/render.js, js/gpu/resources.js (buffers, textures, cache), js/gpu/shaders/*.wgsl.js (WGSL as exported template strings, so no fetch or build step)
- One feature per file. Read only the files the task needs.

# Architecture rules
- The document is plain JSON (layers, keyframes, easing, duration, fps). Stored, undone and exported as data.
- render(doc, timeSeconds) is a pure function. Playback, scrubbing, thumbnails and export all call it. No hidden animation state.
- All state changes go through state.js (one function per action) so undo/redo works for everything.
- Time is in seconds as floats; convert to frames only at export. Use rAF timestamps with delta time, never assume a frame rate.

# iPad / WebKit rules (all iPad browsers run WebKit, so Safari behaviour applies everywhere)
- Use Pointer Events only (no mouse/touch events). Pencil = pointerType "pen" (pressure, tilt). Call setPointerCapture on pointerdown.
- Canvas and timeline get `touch-action: none`. Disable text selection and callouts on UI (`user-select: none; -webkit-touch-callout: none`).
- Tap targets >= 44pt. No hover-only controls. Nothing essential behind long-press.
- Viewport: `width=device-width, initial-scale=1, viewport-fit=cover`; pad UI with `env(safe-area-inset-*)`. Use `100dvh`, not `100vh`.
- Handle resize and orientation change (Split View / Stage Manager change the size at any time).
- No File System Access pickers in Safari. Export via `<a download>` with a Blob, or `navigator.share({ files })`. Feature-detect before using.
- Video export: render each frame with render(doc, t), then capture. Prototype the capture path (MediaRecorder on canvas.captureStream from the WebGPU canvas) on the iPad before building UI around it. Fall back to a PNG frame sequence.
- Audio only starts after a user gesture.
- iOS limits total canvas memory: reuse 2D canvases; release ones you're done with (set width and height to 0).

# WebGPU rules
- Feature-detect `navigator.gpu`; if missing or requestAdapter() returns null, show a clear "needs iPadOS 26+" screen.
- Request adapter and device once in device.js; everything else receives the device. Listen to `device.lost` and rebuild all GPU resources from the document (backgrounding the app can lose the device).
- Configure the canvas with `navigator.gpu.getPreferredCanvasFormat()` and `alphaMode: "premultiplied"`. Size the backing store to clientWidth/Height x devicePixelRatio on resize.
- Create pipelines, bind group layouts, samplers and shader modules once and cache them. Per frame: write uniforms with `queue.writeBuffer`, encode one command buffer, submit once.
- WGSL uniform/storage structs follow WGSL alignment (vec3 and vec4 align to 16 bytes); keep the JS-side Float32Array layout in sync and comment the offsets.
- Text and vector shapes: draw with Canvas 2D or OffscreenCanvas, upload with `queue.copyExternalImageToTexture`, re-upload only when content changes.
- Call `.destroy()` on textures and buffers when layers are deleted. Respect `device.limits` (e.g. maxTextureDimension2D) for imported images.
- In dev, log `device.onuncapturederror` and wrap new pipeline code in pushErrorScope/popErrorScope.

# Storage
- Projects in IndexedDB via js/storage.js only. Autosave on change (debounced ~1s).
- Call navigator.storage.persist() on first launch; WebKit is more likely to grant it for Home Screen apps.
- Safari tabs and the installed Home Screen app have separate storage. Always test in the installed app.
- Offer "Export project (.json)" as the user's real backup.

# PWA / service worker
- Cache-first for app files. Bump CACHE_VERSION in sw.js on every deploy, or the iPad keeps the old version.
- Service workers need HTTPS. A LAN IP from the iPad is not secure, so test on the GitHub Pages deploy (or an HTTPS tunnel).
- Manifest: display "standalone", 180x180 apple-touch-icon, plus 192 and 512 icons.

# Performance
- Target 60fps playback on iPad Air 5. Don't allocate objects inside the render loop.
- Redraw only on change or during playback. Never run an idle rAF loop.
- Static layers render once to a cached texture; re-render only when their keyframed properties change.
- Don't create GPU buffers, textures, bind groups or pipelines per frame.

# Workflow
- Change only what the task asks. No drive-by refactors or new dependencies without asking.
- Done means: works in the installed PWA on iPad (or Safari responsive mode at 820x1180 and 1180x820), no console errors, CACHE_VERSION bumped if app files changed.
- Debug with targeted console.log; owner can read the iPad console via Safari Web Inspector on a Mac.
- Status, next steps and known bugs live in PROGRESS.md. Update it before the session ends.
- Commit after each working step with a plain-English message.

# Compact instructions
When compacting, keep: files modified, open bugs, decisions made, and the current task's done criteria.
