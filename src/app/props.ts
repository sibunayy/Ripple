import { isAnimated } from '../anim/interp';
import { allProps, type Layer, type PropKey } from '../model/layer';

export const PROP_ORDER = ['position', 'scale', 'rotation', 'opacity', 'anchor'];
const LABELS: Record<string, string> = {
  position: 'Position', scale: 'Scale', rotation: 'Rotation', opacity: 'Opacity', anchor: 'Anchor',
  'fill.color': 'Fill colour', 'fill.opacity': 'Fill opacity', 'stroke.color': 'Stroke colour', 'stroke.width': 'Stroke width', 'stroke.opacity': 'Stroke opacity',
  'trim.start': 'Trim start', 'trim.end': 'Trim end', 'trim.offset': 'Trim offset',
  'rep.copies': 'Copies', 'rep.position': 'Repeat offset', 'rep.rotation': 'Repeat rotation', 'rep.scale': 'Repeat scale', 'rep.opacityStart': 'Start opacity', 'rep.opacityEnd': 'End opacity',
  'shape.size': 'Size', 'shape.round': 'Roundness', 'shape.points': 'Points', 'shape.outer': 'Outer radius', 'shape.inner': 'Inner radius',
  'text.size': 'Font size', 'text.tracking': 'Tracking', 'text.leading': 'Line height',
};
export const propLabel = (k: PropKey) => LABELS[k] ?? k;
/** Names of the vector components for multi-value props. */
export const compLabels = (k: PropKey, n: number): string[] =>
  n === 4 ? ['R', 'G', 'B', 'A'] : n === 2 ? ['X', 'Y'] : [''];
export const animatedProps = (l: Layer): PropKey[] => {
  const keys = allProps(l).filter(([, p]) => isAnimated(p)).map(([k]) => k);
  return [...PROP_ORDER.filter((k) => keys.includes(k)), ...keys.filter((k) => !PROP_ORDER.includes(k))];
};
