// Phase 2 module map: [first line in scripts/split/legacy-main.phase1.ts, module path].
// A top-level statement goes to the last entry whose line is <= the statement's first line.
export const MAP = [
  [7, 'core/dom'], [10, 'model/project'], [12, 'core/store'], [15, 'ui/icons'], [90, 'core/dom'],
  [93, 'anim/easing'], [108, 'model/schema'], [114, 'model/project'], [137, 'anim/interpolate'],
  [150, 'state/state'], [164, 'render/guides'], [170, 'state/state'], [180, 'state/history'], [187, 'anim/keys'],
  [205, 'render/stage'], [207, 'render/shapes'], [236, 'render/text'], [251, 'render/shapes'],
  [281, 'fx/defs'], [311, 'fx/filters'], [352, 'anim/pose'],
  [397, 'shader/presets'], [603, 'shader/runtime'], [691, 'shader/ui'],
  [714, 'render/stage'], [824, 'ui/topbar'], [852, 'ui/strips'], [877, 'ui/left-panel'], [879, 'ui/presets'], [919, 'ui/left-panel'],
  [962, 'ui/inspector/controls'], [995, 'anim/clipboard'], [1017, 'ui/inspector/easing'], [1044, 'ui/inspector/controls'],
  [1054, 'ui/inspector/effects'], [1075, 'ui/inspector/extras'], [1126, 'ui/inspector/paint'], [1133, 'ui/inspector/props-view'],
  [1212, 'ui/inspector/index'], [1261, 'ui/floats'], [1300, 'ui/timeline'], [1378, 'ui/graph'],
  [1485, 'ui/color-picker'], [1517, 'ui/popovers'],
  [1644, 'export/dialog'], [1652, 'export/raster'], [1671, 'export/gif'], [1720, 'export/zip'], [1736, 'export/lottie'],
  [1846, 'export/png'], [1859, 'export/gif'], [1895, 'export/mp4'], [1955, 'export/dialog'], [2001, 'ui/dialog'],
  [2030, 'ui/toast'], [2039, 'ui/layout'], [2062, 'playback/audio'], [2097, 'playback/loop'], [2112, 'ui/autofold'],
  [2135, 'actions/layers'], [2153, 'actions/presets'], [2240, 'actions/index'],
  [2478, 'state/selection'], [2492, 'gestures/area-select'], [2497, 'drawing/cels'], [2517, 'drawing/raster'],
  [2638, 'drawing/ink'], [2709, 'drawing/brush-bar'], [2725, 'ui/inspector/drawing'], [2736, 'gestures/cel-timeline'],
  [2774, 'drawing/overlay'], [2792, 'gestures/area-select'], [2820, 'gestures/handles'], [2865, 'actions/align'],
  [2878, 'ui/text-animators'], [2904, 'gestures/timeline'], [2973, 'events/delegate'], [3071, 'gestures/reorder'],
  [3120, 'gestures/drags'], [3269, 'gestures/canvas'], [3364, 'events/keyboard'], [3397, 'main'],
];
