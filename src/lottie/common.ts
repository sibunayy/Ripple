// Shared Lottie (Bodymovin) tables.
import type { BlendMode } from '../render/blend';
import type { MaskMode, MatteMode } from '../model/layer';

export const BM_TO_LOTTIE: Partial<Record<BlendMode, number>> = {
  normal: 0, multiply: 1, screen: 2, overlay: 3, darken: 4, lighten: 5, colorDodge: 6, colorBurn: 7,
  hardLight: 8, softLight: 9, difference: 10, exclusion: 11, hue: 12, saturation: 13, color: 14, luminosity: 15,
};
export const LOTTIE_TO_BM: BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'colorDodge', 'colorBurn', 'hardLight', 'softLight', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];

export const MASK_TO_LOTTIE: Record<MaskMode, string> = { none: 'n', add: 'a', subtract: 's', intersect: 'i', lighten: 'l', darken: 'd', difference: 'f' };
export const LOTTIE_TO_MASK: Record<string, MaskMode> = { n: 'none', a: 'add', s: 'subtract', i: 'intersect', l: 'lighten', d: 'darken', f: 'difference' };
export const MATTE_TO_TT: Record<MatteMode, number> = { alpha: 1, alphaInv: 2, luma: 3, lumaInv: 4 };
export const TT_TO_MATTE: MatteMode[] = ['alpha', 'alpha', 'alphaInv', 'luma', 'lumaInv'];

export interface LottieReport { level: 'warn' | 'info'; msg: string }
export const LOTTIE_VERSION = '5.12.1';
