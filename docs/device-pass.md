# Real-device test pass (iPad, M1 or later)

Headless Chromium proves the engine and the UI logic; it cannot prove touch behaviour, Safari-specific limits or performance. Run this before tagging 1.0. Record the device, iPadOS version and Safari build with the results.

## Install & offline
- [x] Open the Pages URL in Safari → Add to Home Screen → launches full-screen with the splash image
- [x] Airplane mode → relaunch → library loads; create a project; draw a shape
- [x] Update toast appears after a new deploy and does not reload mid-edit

## Touch & Pencil
- [-] Pinch-zoom / two-finger pan in the viewer; no page zoom or rubber-banding. (Tools are used on canvas during two finger zoom/pan. Page scroll when moving two finger on interface.)
- [x] Pencil: draw with the pen tool; resting palm does not move anything; drag nodes and handles; double-tap to add a node
- [x] Scale and rotate handles are comfortably grabbable (44 pt targets); slider-style numeric fields drag smoothly with a finger and don't fight vertical scrolling of the inspector; tap opens the keypad
- [x] Timeline: drag keyframes, trim bars, graph handles with a finger and with the Pencil
- [ ] External keyboard shortcuts (see shortcuts.md); `?` opens help (Not needed)

- [ ] Two-finger tap undoes and three-finger tap redoes; a pinch-zoom or pan never triggers either; no stray shape is left behind when tapping with a drawing tool active
- [ ] Press-and-hold (~0.45 s) on a layer row, a keyframe row and the canvas opens a menu; lifting the finger doesn't activate an item; the system callout/selection bubble doesn't appear
- [ ] Icons (tools, layer lock/visibility/shy, transport) are legible at arm's length in both light and dark mode

## Rendering & memory
- [x] Build the acceptance scenario (docs/acceptance.md #2) at 1080p30; playback holds 60 fps preview (note the ƒ overlay), or Auto quality settles on a stable step
- [ ] 4K project, 20 layers with masks/mattes: no tab reload (jetsam) during a 5-minute editing session; memory in Web Inspector stays under ~1.2 GB
- [ ] 4K H.264 clip: scrubbing and playback are smooth
- [ ] Context loss recovery: background the app for a minute, return → viewer redraws

## Export & files
- [ ] MP4 1080p30 10 s: note the "× realtime" figure in the queue (target ≥ 2×); plays in Photos/Files with correct colours and frame count
- [ ] GIF and PNG sequence open correctly; Share… opens the share sheet; Download lands in Files
- [ ] `.ripple` backup → delete project → import → identical
- [ ] Lottie export → play in lottie-web / a mobile player → matches for the supported subset

## Storage
- [x] Force-quit the app mid-edit → relaunch → last state restored
- [x] Storage persistence granted (Settings → Safari → Advanced → Website Data shows the site); install exempts from the 7-day cap
