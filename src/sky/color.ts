/**
 * Pure appearance curves: star colour from B−V, star size/brightness from magnitude, twilight limits,
 * CSS colour parsing. The GLSL star shader is generated from the same constants (see shaders.ts) so the
 * CPU (labels, picking) and GPU agree.
 */

export type RGB = [number, number, number];
export type RGBA = [number, number, number, number];

/** Star size curve constants: radius = (R0 + R1 · max(0, M0 − mag)^P) · zoom, in CSS px. */
export const STAR = {
  R0: 0.72,
  R1: 0.4,
  M0: 6.8,
  P: 1.22,
  /** Magnitude range over which a star fades in below the limiting magnitude */
  FADE: 0.45,
  /** Alpha curve: clamp(A0 − A1 · max(0, mag − AM), AMIN, 1) */
  A0: 1.0,
  A1: 0.115,
  AM: 2.5,
  AMIN: 0.42,
  /** Glow (halo) strength ramps from 0 at GLOW_FAINT to 1 at GLOW_BRIGHT */
  GLOW_FAINT: 2.6,
  GLOW_BRIGHT: -1.0,
  GLOW_SIZE: 2.4,
} as const;

/** Core radius of a star in CSS pixels (before the zoom factor). Monotonic: brighter is never smaller. */
export function starRadius(mag: number): number {
  return STAR.R0 + STAR.R1 * Math.pow(Math.max(0, STAR.M0 - mag), STAR.P);
}
/** Brightness multiplier of a star's core (1 for bright stars, less for faint ones). */
export function starAlpha(mag: number): number {
  return Math.min(1, Math.max(STAR.AMIN, STAR.A0 - STAR.A1 * Math.max(0, mag - STAR.AM)));
}
/** 0..1 fade for stars close to the limiting magnitude. */
export function limitFade(mag: number, limitingMag: number): number {
  return Math.min(1, Math.max(0, (limitingMag - mag) / STAR.FADE));
}
/** Stars grow slightly as you zoom in and shrink slightly at very wide fields. */
export function starZoom(fovDeg: number): number {
  return Math.min(1.9, Math.max(0.82, Math.pow(70 / fovDeg, 0.22)));
}

/**
 * B−V colour index → linear-ish display RGB (0..1, brightest channel = 1).
 * Anchors chosen so the hue is visible but not garish: O/B stars blue-white, A white, G pale yellow,
 * K orange, M orange-red.
 */
const BV_STOPS: [number, RGB][] = [
  [-0.4, [0.58, 0.7, 1.0]],
  [-0.2, [0.66, 0.77, 1.0]],
  [0.0, [0.8, 0.87, 1.0]],
  [0.3, [0.97, 0.97, 1.0]],
  [0.6, [1.0, 0.95, 0.84]],
  [0.8, [1.0, 0.89, 0.7]],
  [1.15, [1.0, 0.78, 0.52]],
  [1.5, [1.0, 0.66, 0.38]],
  [1.85, [1.0, 0.56, 0.3]],
  [2.4, [1.0, 0.47, 0.25]],
];
export function bvToRgb(bv: number | undefined): RGB {
  const x = bv === undefined || !isFinite(bv) ? 0.6 : Math.min(2.4, Math.max(-0.4, bv));
  for (let i = 1; i < BV_STOPS.length; i++) {
    const [b1, c1] = BV_STOPS[i];
    if (x <= b1) {
      const [b0, c0] = BV_STOPS[i - 1];
      const t = (x - b0) / (b1 - b0);
      return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
    }
  }
  return BV_STOPS[BV_STOPS.length - 1][1];
}

/**
 * Faintest magnitude visible at a given Sun altitude (degrees) through twilight and daylight.
 * Full darkness below −18°; nothing but the very brightest objects once the Sun is up.
 */
const TW: [number, number][] = [
  [-18, 8.5],
  [-15, 7.0],
  [-12, 5.6],
  [-9, 4.0],
  [-6, 2.3],
  [-3, 0.4],
  [0, -2.0],
  [3, -4.0],
  [6, -5.5],
];
export function twilightLimit(sunAltDeg: number): number {
  if (sunAltDeg <= TW[0][0]) return 99;
  for (let i = 1; i < TW.length; i++) {
    if (sunAltDeg <= TW[i][0]) {
      const t = (sunAltDeg - TW[i - 1][0]) / (TW[i][0] - TW[i - 1][0]);
      return TW[i - 1][1] + (TW[i][1] - TW[i - 1][1]) * t;
    }
  }
  return TW[TW.length - 1][1];
}

/** Light-pollution strength 0..1 from the limiting magnitude: ≥ 6.5 → almost none, ≤ 4.5 → full. */
export function lightPollution(limitingMag: number): number {
  const t = Math.min(1, Math.max(0, (6.6 - limitingMag) / 2.1));
  return t * t * (3 - 2 * t) * 0.97 + (limitingMag < 7.2 ? 0.03 * Math.min(1, (7.2 - limitingMag) / 0.6) : 0);
}
/** Milky Way visibility 0..1 from the limiting magnitude: gone at ≤ 5.0, full at ≥ 7. */
export function milkyWayVisibility(limitingMag: number): number {
  const t = Math.min(1, Math.max(0, (limitingMag - 5.0) / 2.0));
  return t * t * (3 - 2 * t);
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Parse "#rgb", "#rrggbb", "#rrggbbaa", "rgb(…)" or "rgba(…)" into 0..1 components. */
export function parseCssColor(input: string | undefined | null, fallback: RGBA): RGBA {
  if (!input) return fallback;
  const s = input.trim();
  if (s.startsWith('#')) {
    const h = s.slice(1);
    if (h.length === 3 || h.length === 4) {
      const v = [...h].map((c) => parseInt(c + c, 16) / 255);
      if (v.some((n) => !isFinite(n))) return fallback;
      return [v[0], v[1], v[2], v[3] ?? 1];
    }
    if (h.length === 6 || h.length === 8) {
      const v = [0, 2, 4, 6].filter((i) => i < h.length).map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
      if (v.some((n) => !isFinite(n))) return fallback;
      return [v[0], v[1], v[2], v[3] ?? 1];
    }
    return fallback;
  }
  const m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return fallback;
    const ch = (p: string) => (p.endsWith('%') ? (parseFloat(p) / 100) * 255 : parseFloat(p));
    const r = ch(parts[0]), g = ch(parts[1]), b = ch(parts[2]);
    let a = 1;
    if (parts[3] !== undefined) a = parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    if (![r, g, b, a].every(isFinite)) return fallback;
    return [r / 255, g / 255, b / 255, a];
  }
  return fallback;
}
export function rgbaCss(c: RGBA, alphaMul = 1): string {
  return `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${+(c[3] * alphaMul).toFixed(3)})`;
}
