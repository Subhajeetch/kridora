// ============================================================================
// 1. SEPARATE COLOR CONFIGURATION & 3D SHADING GENERATOR
// ============================================================================
// Change these values or pass any hex string / custom palette to <ChipFace />
// to completely re-skin the 3D chip face while preserving realistic 3D bevels.

export interface ChipColorPalette {
  name: string;
  base: string;            // Primary matte 3D surface color
  highlight: string;       // Bright top-left 3D bevel & corner specular highlight
  surfaceLight: string;    // Upper-left soft diffused surface gradient
  shadow: string;          // Bottom-right 3D bevel shadow
  deepShadow: string;      // 3D side-wall extrusion & deep ambient shadow
  grooveShadow: string;    // Carved bottom-corner circuit groove interior
  grooveHighlight: string; // Carved circuit groove bottom edge catch-light
  eyeCavity: string;       // Recessed eye socket base color
  eyeDeepSocket: string;   // Inner top shadow inside the recessed eye
  eyeRimHighlight: string; // Subtle bottom catch-light on the eye socket edge
  eyeGlow?: string;        // Optional emissive tint when in LED mode
}

/**
 * Helper utility: Converts a single Hex color into a full 3D shaded ChipColorPalette
 * by computing lighter specular highlights and darker ambient bevel shadows.
 */
export function createChipPaletteFromHex(
  hex: string,
  name = 'Custom Color',
  eyeCavityColor = '#212924'
): ChipColorPalette {
  const cleanHex = hex.trim().replace(/^#/, '');
  const normalizedHex = /^[\da-f]{3}$/i.test(cleanHex)
    ? cleanHex.split('').map((character) => character + character).join('')
    : /^[\da-f]{6}$/i.test(cleanHex)
      ? cleanHex
      : '459889';
  const num = parseInt(normalizedHex, 16);

  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;

  const adjust = (dr: number, dg: number, db: number, factor = 1) => {
    const nr = Math.min(255, Math.max(0, Math.round(r * factor + dr)));
    const ng = Math.min(255, Math.max(0, Math.round(g * factor + dg)));
    const nb = Math.min(255, Math.max(0, Math.round(b * factor + db)));
    return `#${((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1)}`;
  };

  return {
    name,
    base: `#${normalizedHex}`,
    highlight: adjust(72, 78, 74, 1.05),
    surfaceLight: adjust(32, 36, 34, 1.02),
    shadow: adjust(-38, -42, -38, 0.82),
    deepShadow: adjust(-65, -70, -65, 0.65),
    grooveShadow: adjust(-58, -62, -58, 0.70),
    grooveHighlight: adjust(48, 52, 48, 1.04),
    eyeCavity: eyeCavityColor,
    eyeDeepSocket: '#0f1411',
    eyeRimHighlight: adjust(55, 60, 56, 1.05),
    eyeGlow: adjust(95, 105, 100, 1.1),
  };
}

/**
 * Pre-configured Studio 3D Color Palettes.
 * `originalJade` matches the exact reference image green face.
 */
export const CHIP_COLOR_THEMES: Record<string, ChipColorPalette> = {
  originalJade: {
    name: 'Original Jade (Reference)',
    base: '#46998A',
    highlight: '#8BE0D0',
    surfaceLight: '#5DB5A5',
    shadow: '#2A685C',
    deepShadow: '#1B473F',
    grooveShadow: '#1D4D44',
    grooveHighlight: '#76CBBb',
    eyeCavity: '#232B26',
    eyeDeepSocket: '#111613',
    eyeRimHighlight: '#6BC0B0',
    eyeGlow: '#7FFFD4',
  },
  cyberGold: {
    name: 'Cyber Amber Gold',
    base: '#E09F3E',
    highlight: '#FFE099',
    surfaceLight: '#F2B857',
    shadow: '#9E6414',
    deepShadow: '#6E4208',
    grooveShadow: '#7A4B0B',
    grooveHighlight: '#FFD275',
    eyeCavity: '#26211A',
    eyeDeepSocket: '#14110C',
    eyeRimHighlight: '#FFCF70',
    eyeGlow: '#FFE680',
  },
  cobaltPulse: {
    name: 'Electric Cobalt',
    base: '#3B72D9',
    highlight: '#8AB4FF',
    surfaceLight: '#558BF0',
    shadow: '#204694',
    deepShadow: '#142E66',
    grooveShadow: '#183678',
    grooveHighlight: '#78A7FF',
    eyeCavity: '#1A202C',
    eyeDeepSocket: '#0D1118',
    eyeRimHighlight: '#70A0FF',
    eyeGlow: '#63B3ED',
  },
  coralClay: {
    name: 'Tactile Coral',
    base: '#E06358',
    highlight: '#FFABA3',
    surfaceLight: '#F07C71',
    shadow: '#9C352C',
    deepShadow: '#6E2019',
    grooveShadow: '#7D261E',
    grooveHighlight: '#FF9B91',
    eyeCavity: '#291E1E',
    eyeDeepSocket: '#171010',
    eyeRimHighlight: '#FF968C',
    eyeGlow: '#FEB2B2',
  },
  lavenderQuartz: {
    name: 'Lavender Quartz',
    base: '#8467C4',
    highlight: '#C7B2F7',
    surfaceLight: '#9B7FD9',
    shadow: '#52388C',
    deepShadow: '#382366',
    grooveShadow: '#422B75',
    grooveHighlight: '#B89FF0',
    eyeCavity: '#211C2B',
    eyeDeepSocket: '#120F18',
    eyeRimHighlight: '#B59CEB',
    eyeGlow: '#D6BCFA',
  },
  stealthObsidian: {
    name: 'Stealth Obsidian',
    base: '#374146',
    highlight: '#6D7D85',
    surfaceLight: '#49565C',
    shadow: '#1E2528',
    deepShadow: '#121618',
    grooveShadow: '#161B1E',
    grooveHighlight: '#5A6870',
    eyeCavity: '#14181A',
    eyeDeepSocket: '#080A0B',
    eyeRimHighlight: '#56646B',
    eyeGlow: '#4FD1C5',
  },
  matchaMint: {
    name: 'Matcha Mint',
    base: '#68A86E',
    highlight: '#ADE3B2',
    surfaceLight: '#7EC084',
    shadow: '#3E7043',
    deepShadow: '#294D2D',
    grooveShadow: '#315C36',
    grooveHighlight: '#9AD4A0',
    eyeCavity: '#202921',
    eyeDeepSocket: '#101611',
    eyeRimHighlight: '#94CF9A',
    eyeGlow: '#9AE6B4',
  },
};

