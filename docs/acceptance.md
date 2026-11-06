# v1.0 acceptance status (spec §13)

“Automated” = covered by `npm test` / `npm run e2e` (headless Chromium with software GL, run in CI on every PR). “Device” = needs the real-iPad pass in [device-pass.md](device-pass.md). Nothing below is claimed as passing on an iPad.

| # | Criterion | Automated | Device |
|---|---|---|---|
| 1 | Install, launch offline, 1080p30 project with custom background, switch to 60 fps and 4K without reload | Offline reload from the service-worker precache; settings change (size, fps, bg) without reload | Add-to-Home-Screen install, splash, real offline launch |
| 2 | 10-second animation: pen-drawn shapes, text, image, video; parenting, track matte, mask, 5 blend modes, Glow + Gaussian Blur + colour curve; easing edited in the graph | Each ingredient has golden/e2e coverage (27 blend modes vs CPU reference, masks, mattes, parenting, glow/blur/curves, image + video import, graph editing); a rich mixed project round-trips save/reload with identical JSON and pixels | Building the full scenario by hand with touch/Pencil; performance while doing it |
| 3 | Built-in preset on text and shape; custom preset saved and reused in another project | Yes (UI e2e) | — |
| 4 | Autosave survives a forced tab kill | Yes (page closed without unload handlers, reopened) | Real jetsam / force-quit |
| 5 | Export MP4, GIF, PNG sequence with correct colours and frame count | Container/magic bytes, frame counts (incl. frame-rate override), dimensions, alpha, queue; MP4 where the browser has an H.264 encoder | Opening in Files/Photos, colour accuracy, share sheet |
| 6 | Custom shader effect with a keyframed slider; Lottie export with compatibility report; re-import matches within tolerance | Shader effect + keyframed uniform → Lottie export shows the report → re-import; 14 feature scenes rendered by RippleFlow and lottie-web from the exported JSON agree within ±24/255 | Playback in a mobile Lottie player |
| 7 | Performance budgets (§10) on an M1 iPad Air | Preview auto-quality and the ƒ overlay exist; no numbers are asserted in CI (software GL is not representative) | **Not verified.** Includes the ≥ 2× realtime 1080p export target |

## Known gaps carried into 1.0 (also listed in spec.md implementation notes)
Worker/OffscreenCanvas renderer and WebGPU backend (profiling-gated), WebCodecs/mp4box video pipeline and proxies (video uses `<video>`), audio, spatial bézier handles on motion paths, speed graph, multi-layer transform and marquee selection, mask feather in Lottie, product-name trademark clearance.
