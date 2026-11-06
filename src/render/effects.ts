// Effects hook (M5 fills this in). For now layers carry no effects.
import type { Layer } from '../model/layer';
import type { GLRenderer, RT } from './gl';
export function effectsInput(_r: GLRenderer, _l: Layer, rt: RT, _t: number, _k: number): RT { return rt; }
