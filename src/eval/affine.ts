// 2D affine matrices as [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f.
export type Mat = [number, number, number, number, number, number];
export const IDENT: Mat = [1, 0, 0, 1, 0, 0];

export const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

export function invert(m: Mat): Mat | null {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-12) return null;
  return [
    m[3] / det, -m[1] / det, -m[2] / det, m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det,
  ];
}

export const apply = (m: Mat, x: number, y: number): [number, number] =>
  [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** T(position) · R(rotation) · S(scale) · T(−anchor). Scale in percent, rotation in degrees. */
export function compose(pos: number[], rotDeg: number, scalePct: number[], anchor: number[]): Mat {
  const r = (rotDeg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const sx = (scalePct[0] ?? 100) / 100, sy = (scalePct[1] ?? 100) / 100;
  const a = c * sx, b = s * sx, cc = -s * sy, d = c * sy;
  const ax = anchor[0] ?? 0, ay = anchor[1] ?? 0;
  return [a, b, cc, d, (pos[0] ?? 0) - (a * ax + cc * ay), (pos[1] ?? 0) - (b * ax + d * ay)];
}

/** Inverse of compose for similarity+axis scale (no skew): returns position/rotation/scale for an anchor. */
export function decompose(m: Mat, anchor: number[]): { position: [number, number]; rotation: number; scale: [number, number] } {
  const sx = Math.hypot(m[0], m[1]);
  const det = m[0] * m[3] - m[1] * m[2];
  const sy = sx ? det / sx : 0;
  const [px, py] = apply(m, anchor[0] ?? 0, anchor[1] ?? 0);
  return { position: [px, py], rotation: (Math.atan2(m[1], m[0]) * 180) / Math.PI, scale: [sx * 100, sy * 100] };
}
