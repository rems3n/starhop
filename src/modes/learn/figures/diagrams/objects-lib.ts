/**
 * Shared helpers for the "objects" unit diagrams (star colours, life cycle, nebulae, galaxies, clusters, planets).
 * This is a .ts file, so the diagram registry (which globs ./diagrams/*.tsx) does not treat it as a diagram.
 */

/** Seeded pseudo-random generator (Park–Miller) so drawings do not reshuffle on every render. */
export function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Gaussian (Box–Muller) from a uniform generator. */
export function gauss(r: () => number) {
  const u = Math.max(1e-9, r());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

// ───────────── Light and colour ─────────────

/** hc/k in nm·K */
const HCK = 1.4388e7;
/** Planck spectral radiance per unit wavelength, arbitrary units (λ in nm, T in K). */
export function planck(lambdaNm: number, T: number): number {
  const l = lambdaNm * 1e-3; // µm keeps numbers moderate
  return 1 / (l ** 5 * (Math.exp(HCK / (lambdaNm * T)) - 1));
}
/** Wien's law: wavelength of peak emission in nm. */
export const wienPeakNm = (T: number) => 2.8978e6 / T;

/** CIE 1931 colour-matching functions, multi-lobe Gaussian fit of Wyman, Sloan & Shirley (2013). */
function g(l: number, mu: number, s1: number, s2: number) {
  const t = (l - mu) / (l < mu ? s1 : s2);
  return Math.exp(-0.5 * t * t);
}
function cmf(l: number): [number, number, number] {
  const x = 1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2);
  const y = 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1);
  const z = 1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8);
  return [x, y, z];
}
const gamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

/** Linear sRGB (0–1, brightest channel = 1) of an ideal glowing body at temperature T, as a display colour. */
function bbLinear(T: number): [number, number, number] {
  let X = 0, Y = 0, Z = 0;
  for (let l = 380; l <= 780; l += 5) {
    const p = planck(l, T);
    const [x, y, z] = cmf(l);
    X += p * x; Y += p * y; Z += p * z;
  }
  let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let gg = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b = 0.0557 * X - 0.204 * Y + 1.057 * Z;
  r = Math.max(0, r); gg = Math.max(0, gg); b = Math.max(0, b);
  const m = Math.max(r, gg, b) || 1;
  return [r / m, gg / m, b / m];
}
const bbCache = new Map<number, string>();
/** CSS colour of a glowing body at temperature T (K). Computed from Planck's law and the CIE eye response (sRGB, D65 white). */
export function tempColor(T: number): string {
  const k = Math.round(T / 25) * 25;
  let c = bbCache.get(k);
  if (!c) {
    const [r, gg, b] = bbLinear(k).map(gamma);
    c = `rgb(${Math.round(r * 255)},${Math.round(gg * 255)},${Math.round(b * 255)})`;
    bbCache.set(k, c);
  }
  return c;
}

/** Approximate surface temperature from the B−V colour index (Ballesteros 2012). */
export const bvToTemp = (bv: number) => 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));

/** Display colour of visible light of one wavelength (nm), for drawing a spectrum strip. Simple piecewise approximation. */
export function wavelengthColor(l: number): string {
  let r = 0, gg = 0, b = 0;
  if (l < 440) { r = -(l - 440) / 60; b = 1; }
  else if (l < 490) { gg = (l - 440) / 50; b = 1; }
  else if (l < 510) { gg = 1; b = -(l - 510) / 20; }
  else if (l < 580) { r = (l - 510) / 70; gg = 1; }
  else if (l < 645) { r = 1; gg = -(l - 645) / 65; }
  else { r = 1; }
  const f = l < 420 ? 0.3 + (0.7 * (l - 380)) / 40 : l > 700 ? 0.3 + (0.7 * (780 - l)) / 80 : 1;
  const c = (v: number) => Math.round(255 * Math.pow(Math.max(0, v * f), 0.8));
  return `rgb(${c(r)},${c(gg)},${c(b)})`;
}

// ───────────── Numbers ─────────────

/** Round to n significant figures. */
export function sig(v: number, n = 2): number {
  if (v === 0) return 0;
  const p = Math.pow(10, n - Math.ceil(Math.log10(Math.abs(v))));
  return Math.round(v * p) / p;
}
export const fmt = (v: number) => v.toLocaleString('en-US');

/** "3 million years", "12 billion years", "450 years" … */
export function years(y: number): string {
  if (y >= 1e9) return `${fmt(sig(y / 1e9, 2))} billion years`;
  if (y >= 1e6) return `${fmt(sig(y / 1e6, 2))} million years`;
  if (y >= 1e4) return `${fmt(sig(y / 1e3, 2))} thousand years`;
  if (y >= 1) return `${fmt(sig(y, 2))} year${sig(y, 2) === 1 ? '' : 's'}`;
  return `${fmt(sig(y * 365.25, 2))} days`;
}

// ───────────── Images inside diagrams ─────────────

const BASE = (import.meta.env?.BASE_URL as string | undefined) ?? './';
/** URL of a shipped image such as "img/M42-1.jpg" (works under the app's relative base). */
export const imgUrl = (file: string) => `${BASE}${file}`;

/** Credit of a photo used inside a diagram; copied exactly from public/data/images.json. */
export interface PhotoCredit {
  file: string;
  label: string;
  kind: 'photograph' | 'false-color' | 'illustration' | 'simulation';
  credit: string;
  license: string;
  sourceUrl: string;
}

// ───────────── Main-sequence stars (rough textbook relations) ─────────────

/** Luminosity in Suns from mass in Suns (piecewise mass–luminosity relation, Wikipedia "Mass–luminosity relation"). */
export function msLum(M: number): number {
  if (M < 0.43) return 0.23 * Math.pow(M, 2.3);
  if (M < 2) return Math.pow(M, 4);
  if (M < 55) return 1.4 * Math.pow(M, 3.5);
  return 32000 * M;
}
/** Radius in Suns (rough: R ∝ M^0.8). */
export const msRadius = (M: number) => Math.pow(M, 0.8);
/** Surface temperature (K) from luminosity and radius (Stefan–Boltzmann, Sun = 5,772 K). */
export const msTemp = (M: number) => 5772 * Math.pow(msLum(M) / msRadius(M) ** 2, 0.25);
/**
 * Main-sequence lifetime in years: the classic rule t ≈ 10 billion yr × M^−2.5, plus ~3 million years because
 * even the heaviest stars take a few million years to burn through their cores. Good to a factor of ~2.
 */
export const msLifetime = (M: number) => 1e10 * Math.pow(M, -2.5) + 3e6;
/** Inverse of msLifetime: the mass of star whose main-sequence life equals `t` years (for cluster turn-offs). */
export function turnoffMass(t: number): number {
  if (t <= 3.05e6) return 200;
  return Math.pow((t - 3e6) / 1e10, -1 / 2.5);
}
