# Formats

## Import
| Kind | Formats | Notes |
|---|---|---|
| Images | PNG, JPEG, WebP, AVIF, GIF (first frame), HEIC | whatever the browser can decode; stored once by content hash |
| Vector | SVG | imported as editable shape layers (paths incl. arcs, rect/circle/ellipse/line/poly*, groups, transforms, gradients). Text, clip-paths, masks, filters and `<use>` are reported and skipped; or import as a flat image |
| Video | MP4/MOV (H.264/HEVC), WebM | decoded by the browser; muted |
| Lottie | `.json`, `.lottie` | shapes, solids, nulls, precomps, masks, mattes, blend modes, text (basic), embedded images, markers, keyframes with bézier easing. Expressions, effects, 3D, time-remap are reported |
| Projects | `.ripple` | project + media + imported fonts |
| Fonts | `.ttf` `.otf` `.woff` `.woff2` | stored on the device, shared by all projects |
| Colour | `.cube` 3D LUTs | up to 65³ |

## Export
MP4 (H.264) · WebM (VP9) · animated GIF (optional transparency) · PNG / JPEG / WebP sequences (zip) · stills · Lottie JSON · `.ripple`. Resolution (full/half/quarter), range (work area / whole comp), frame-rate override and, where the format allows, a transparent background.
Video encoders depend on the browser; when one is missing the app says so and suggests an alternative.

## Lottie compatibility (export profile "lottie-web")
Exported: solid, null, shape (path, rectangle, ellipse, star/polygon, fill, stroke, gradients, trim paths, repeater), precomps, transforms and every keyframed parameter, hold keys, bézier easing (elastic/bounce are baked to samples), masks (all modes), alpha/luma/inverted mattes, 16 blend modes, basic text, images (embedded), markers, parenting.
Not exported (listed in the compatibility report after export): effects, adjustment layers, shader layers, video, mask feather, text animators, motion blur, linear-light compositing.
