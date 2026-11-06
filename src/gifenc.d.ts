declare module 'gifenc' {
  export interface GIF { writeFrame(index: Uint8Array, w: number, h: number, opts?: { palette?: number[][]; delay?: number; transparent?: boolean; transparentIndex?: number; repeat?: number; first?: boolean }): void; finish(): void; bytes(): Uint8Array }
  export function GIFEncoder(opts?: { auto?: boolean }): GIF;
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, opts?: { format?: 'rgb565' | 'rgb444' | 'rgba4444'; oneBitAlpha?: boolean | number; clearAlpha?: boolean; clearAlphaThreshold?: number; clearAlphaColor?: number }): number[][];
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: number[][], format?: 'rgb565' | 'rgb444' | 'rgba4444'): Uint8Array;
}
