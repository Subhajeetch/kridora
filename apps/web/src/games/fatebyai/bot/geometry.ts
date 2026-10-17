/** Pure geometry. No React, no animation: everything here is a plain function of numbers. */

export const VIEW_W = 480;
export const VIEW_H = 360;
/** Height of the full stage (SVG area + the ground-shadow strip beneath it). */
export const STAGE_H = 430;

/**
 * Cloud silhouette: seven circular lobes joined by filleted notches
 * (generated once, so the outline is exact arcs rather than hand-tuned curves).
 */
export const BODY_PATH =
  'M204.2 37.4A92 92 0 0 1 342.5 75.5A30 30 0 0 0 375.3 93.1A72 72 0 0 1 447.9 204A30 30 0 0 0 445.6 233.3A68 68 0 0 1 343.2 316.4A30 30 0 0 0 304.1 319A80 80 0 0 1 189.1 316.2A30 30 0 0 0 151.7 310.7A66 66 0 0 1 52.5 245.6A30 30 0 0 0 43.9 220.5A74 74 0 0 1 75.3 96.9A30 30 0 0 0 94.8 79.3A66 66 0 0 1 177.1 41.5A30 30 0 0 0 204.2 37.4Z';

/** Spots just inside each notch where the surface creases (soft ambient occlusion). */
export const NOTCHES: ReadonlyArray<readonly [number, number]> = [
  [341.5, 90.2], [434.2, 215.5], [305.2, 306.9], [183.5, 301.1], [60.6, 232.5], [98.6, 90.9], [197.1, 50.6],
];

/** Where the eyes sit on the face. */
export const EYE_ANCHOR = { y: 200, left: 190, right: 290 } as const;
/** Resting lean of the pills. Flip the sign (or change it per eye in `expressions.ts`) to match your artwork. */
export const REST_TILT = -12;
/** How far the face slides across the body when the bot looks fully to one side. */
export const LOOK_REACH = { x: 34, y: 20 } as const;

/** Heart used by the love expression, centred on the origin. */
export const HEART_PATH =
  'M0 36C-62-10-38-54-14-46-6-43 0-34 0-28 0-34 6-43 14-46 38-54 62-10 0 36Z';

const rad = (d: number) => (d * Math.PI) / 180;
const n = (v: number) => Math.round(v * 100) / 100;

type Pt = readonly [number, number];
export type EyeCurve = { a: Pt; c: Pt; b: Pt };

/** Eye centre-line: a quadratic curve, already rotated into face space. */
export function eyeCurve(len: number, bend: number, rotDeg: number): EyeCurve {
  const r = rad(rotDeg), cos = Math.cos(r), sin = Math.sin(r);
  const rot = (x: number, y: number): Pt => [x * cos - y * sin, x * sin + y * cos];
  const h = Math.max(len, 0.01) / 2;
  return { a: rot(0, -h), c: rot(bend, 0), b: rot(0, h) };
}

export const curveD = ({ a, c, b }: EyeCurve) =>
  `M${n(a[0])} ${n(a[1])}Q${n(c[0])} ${n(c[1])} ${n(b[0])} ${n(b[1])}`;

const at = ({ a, c, b }: EyeCurve, t: number): Pt => {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
};

/** Small highlight stroke on the upper-left of the eye, following its curve. */
export function glintD(cv: EyeCurve, thick: number): string {
  const p0 = at(cv, 0.1), p1 = at(cv, 0.3);
  const ox = -thick * 0.17, oy = -thick * 0.13;
  return `M${n(p0[0] + ox)} ${n(p0[1] + oy)}L${n(p1[0] + ox)} ${n(p1[1] + oy)}`;
}

/**
 * Polygon that covers everything ABOVE the eyelid line (used as a black shape in a mask).
 * `innerSign` is +1 for the left eye and -1 for the right, so "inner" always means "toward the nose".
 */
export function lidPoints(len: number, thick: number, lid: number, slantDeg: number, innerSign: number): string {
  const height = len + thick;
  const y0 = -height / 2 + lid * height;
  const k = Math.tan(rad(slantDeg)) * innerSign;
  const B = 220;
  return `${-B},${-B} ${B},${-B} ${B},${n(y0 + k * B)} ${-B},${n(y0 - k * B)}`;
}
