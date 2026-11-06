import { isAnimated } from '../anim/interp';
import type { Layer, Prop, TransformKey } from '../model/layer';

export const PROP_ORDER: TransformKey[] = ['position', 'scale', 'rotation', 'opacity', 'anchor'];
export const PROP_LABEL: Record<TransformKey, string> = { position: 'Position', scale: 'Scale', rotation: 'Rotation', opacity: 'Opacity', anchor: 'Anchor' };
export const animatedProps = (l: Layer): TransformKey[] => PROP_ORDER.filter((k) => isAnimated(l.transform[k] as Prop<unknown>));
