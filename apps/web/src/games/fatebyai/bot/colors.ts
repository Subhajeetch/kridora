/**
 * Colour system. Everything the bot paints is derived from ONE face colour, so
 * `<CloudBot color="#ff8a3d" />` re-lights the whole character: highlights drift
 * warm, shadows drift cool, the eyes become a tinted near-black.
 */

export const DEFAULT_FACE_COLOR = '#26B7A6';
export const DEFAULT_ACCENT_COLOR = '#FF4D7D'; // heart eyes

/** Ready-made faces, taken from the clouds in the reference art plus a few extras. */
export const FACE_PRESETS = [
  { name: 'Teal', value: '#26B7A6' },
  { name: 'Tangerine', value: '#FF8A1F' },
  { name: 'Cocoa', value: '#9A6A45' },
  { name: 'Tomato', value: '#F2554B' },
  { name: 'Marshmallow', value: '#F4F1F6' },
  { name: 'Blueberry', value: '#5B7CFA' },
  { name: 'Orchid', value: '#B56CF0' },
  { name: 'Lime', value: '#8BD64B' },
] as const;

export type Palette = {
  base: string;
  light: string;
  lighter: string;
  shade: string;
  deep: string;
  rim: string;
  eyeTop: string;
  eyeBottom: string;
  eyeBevel: string;
  heartTop: string;
  heartBottom: string;
  /** "r,g,b" of the ground shadow. */
  shadowRgb: string;
};

type HSL = { h: number; s: number; l: number };
type RGB = [number, number, number];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function parseHex(input: string): RGB | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl([r, g, b]: RGB): HSL {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const sn = clamp(s, 0, 100) / 100, ln = clamp(l, 0, 100) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

const toHex = (rgb: RGB) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
const hsl = (h: number, s: number, l: number) => toHex(hslToRgb({ h: (h + 360) % 360, s, l }));

/** Move hue `h` a fraction of the way toward `target` along the shortest arc. */
const towardHue = (h: number, target: number, amount: number) => {
  const d = ((target - h + 540) % 360) - 180;
  return (h + d * amount + 360) % 360;
};

const FALLBACK = parseHex(DEFAULT_FACE_COLOR) as RGB;

export function createPalette(face: string, eye?: string, accent: string = DEFAULT_ACCENT_COLOR): Palette {
  const { h, s, l } = rgbToHsl(parseHex(face) ?? FALLBACK);

  // Painter's trick: lights lean warm, shadows lean cool.
  const light = hsl(towardHue(h, 62, 0.07), s - 4, l + (100 - l) * 0.34);
  const lighter = hsl(towardHue(h, 62, 0.1), s - 14, l + (100 - l) * 0.74);
  const shade = hsl(towardHue(h, 262, 0.09), s + 6, l * 0.72);
  const deep = hsl(towardHue(h, 262, 0.14), s + 10, l * 0.44);
  const rim = hsl(towardHue(h, 205, 0.14), s, l + (100 - l) * 0.2);

  const eyeRgb = eye ? parseHex(eye) : null;
  const eyeHsl = eyeRgb ? rgbToHsl(eyeRgb) : { h, s: clamp(s * 0.4, 10, 34), l: 8 };
  const eyeTop = hsl(eyeHsl.h, eyeHsl.s, eyeHsl.l + 8);
  const eyeBottom = hsl(eyeHsl.h, eyeHsl.s, Math.max(eyeHsl.l - 2, 0));

  const acc = rgbToHsl(parseHex(accent) ?? (parseHex(DEFAULT_ACCENT_COLOR) as RGB));

  return {
    base: toHex(hslToRgb({ h, s, l })),
    light,
    lighter,
    shade,
    deep,
    rim,
    eyeTop,
    eyeBottom,
    eyeBevel: lighter,
    heartTop: hsl(acc.h, acc.s, clamp(acc.l + 12, 0, 92)),
    heartBottom: hsl(towardHue(acc.h, 330, 0.08), acc.s, acc.l * 0.82),
    shadowRgb: hslToRgb({ h: towardHue(h, 262, 0.14), s: clamp(s * 0.6, 0, 60), l: 10 }).join(','),
  };
}

const luminance = ([r, g, b]: RGB) => {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

/** Dark or white text, whichever reads better on `color`. */
export function readableInk(color: string): string {
  const L = luminance(parseHex(color) ?? FALLBACK);
  return (1.05 / (L + 0.05)) > (L + 0.05) / 0.059 ? '#ffffff' : '#10191a';
}

/** A dark backdrop in the colour opposite the face, so the bot always pops. */
export function stageTint(face: string) {
  const { h, s } = rgbToHsl(parseHex(face) ?? FALLBACK);
  const hue = s < 10 ? 268 : (h + 180) % 360;
  return {
    page: hsl(hue, 30, 6.5),
    stage: hsl(hue, 34, 13),
    stageHi: hsl(hue, 34, 24),
    word: hsl(hue, 32, 28),
  };
}
