// @ts-nocheck

/* ---------- document ---------- */
// step = value change per point of horizontal drag (before the vertical speed multiplier)
export const PROPS = { x: { label: 'Position X', step: 1, min: -4000, max: 6000, u: '' }, y: { label: 'Position Y', step: 1, min: -4000, max: 6000, u: '' }, scale: { label: 'Scale', step: .5, min: 0, max: 1000, u: '%' }, rot: { label: 'Rotation', step: .5, min: -3600, max: 3600, u: '°' }, op: { label: 'Opacity', step: .5, min: 0, max: 100, u: '%' }, ax: { label: 'Anchor X', step: 1, min: -4000, max: 4000, u: '' }, ay: { label: 'Anchor Y', step: 1, min: -4000, max: 4000, u: '' }, ts: { label: 'Trim start', step: .4, min: 0, max: 100, u: '%' }, te: { label: 'Trim end', step: .4, min: 0, max: 100, u: '%' } };
export const TF = ['x', 'y', 'scale', 'rot', 'op', 'ax', 'ay', 'ts', 'te'];
export const KEYALL = ['x', 'y', 'scale', 'rot', 'op'];
// Inspector rows: Position and Anchor key X and Y together, like After Effects.
export const GROUPS = { pos: { label: 'Position', ps: ['x', 'y'], icon: 'move', axes: ['X', 'Y'] }, scale: { label: 'Scale', ps: ['scale'], icon: 'scaleI' }, rot: { label: 'Rotation', ps: ['rot'], icon: 'rotI' }, op: { label: 'Opacity', ps: ['op'], icon: 'opac' }, anchor: { label: 'Anchor point', ps: ['ax', 'ay'], icon: 'anchorI', axes: ['X', 'Y'] }, trim: { label: 'Trim paths', ps: ['ts', 'te'], icon: 'trim', axes: ['Start', 'End'] } };
export const st = (v) => ({ v }), an = (...k) => ({ keys: k.map(([t, v, e]) => ({ t, v, e: e || 'linear' })) });
