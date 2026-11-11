/** Display formatting for astronomical quantities. */

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const COMPASS_WORDS: Record<string, string> = { N: 'north', NE: 'northeast', E: 'east', SE: 'southeast', S: 'south', SW: 'southwest', W: 'west', NW: 'northwest' };

/** 16-point compass abbreviation for an azimuth (0 = N, 90 = E). */
export function compass(az: number): string {
  return COMPASS[Math.round((((az % 360) + 360) % 360) / 22.5) % 16];
}

/** 8-point compass word, e.g. "southwest". */
export function compassWord(az: number): string {
  const eight = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((((az % 360) + 360) % 360) / 45) % 8];
  return COMPASS_WORDS[eight];
}

/** "5h 55m 10s" from RA in degrees. */
export function formatRa(raDeg: number): string {
  const h = (((raDeg % 360) + 360) % 360) / 15;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const ss = Math.round(((h - hh) * 60 - mm) * 60);
  return `${hh}h ${String(mm).padStart(2, '0')}m ${String(ss % 60).padStart(2, '0')}s`;
}

/** "+07° 24′" from declination in degrees. */
export function formatDec(decDeg: number): string {
  const sign = decDeg < 0 ? '−' : '+';
  const a = Math.abs(decDeg);
  const d = Math.floor(a);
  const m = Math.round((a - d) * 60);
  return `${sign}${String(m === 60 ? d + 1 : d).padStart(2, '0')}° ${String(m === 60 ? 0 : m).padStart(2, '0')}′`;
}

export function formatDeg(v: number, digits = 0): string {
  return `${v.toFixed(digits)}°`;
}

/** Light-years with sensible rounding and units: "8.6 light-years", "1,340 light-years", "2.5 million light-years". */
export function formatDistanceLy(ly: number | undefined): string {
  if (ly == null || !isFinite(ly) || ly <= 0) return 'unknown';
  if (ly >= 1e9) return `${(ly / 1e9).toFixed(1)} billion light-years`;
  if (ly >= 1e6) return `${(ly / 1e6).toFixed(ly >= 1e7 ? 0 : 1)} million light-years`;
  if (ly >= 1000) return `${(Math.round(ly / 10) * 10).toLocaleString('en-US')} light-years`;
  if (ly >= 100) return `${Math.round(ly)} light-years`;
  return `${ly.toFixed(1)} light-years`;
}

export function formatMag(mag: number | undefined): string {
  return mag == null ? '—' : mag.toFixed(Math.abs(mag) < 10 ? 2 : 1).replace('-', '−');
}

/** Apparent size: arcminutes → `1.1°`, `24′` or `45″`. */
export function formatAngularSize(arcmin: number): string {
  if (arcmin >= 60) return `${(arcmin / 60).toFixed(1)}°`;
  if (arcmin >= 1) return `${arcmin.toFixed(arcmin >= 10 ? 0 : 1)}′`;
  return `${Math.round(arcmin * 60)}″`;
}

/** How wide something is in "hands held at arm's length": fist ≈ 10°, three fingers ≈ 5°, little finger ≈ 1°. */
export function handSpan(deg: number): string {
  if (deg >= 40) return `about ${Math.round(deg / 10)} fists at arm's length`;
  if (deg >= 22) return `about one outstretched hand span (${Math.round(deg)}°)`;
  if (deg >= 13) return `about a fist and a half (${Math.round(deg)}°)`;
  if (deg >= 8) return `about one fist (${Math.round(deg)}°)`;
  if (deg >= 4) return `about three fingers (${Math.round(deg)}°)`;
  if (deg >= 1.5) return `about two fingers (${deg.toFixed(0)}°)`;
  return `about a little-finger width (${deg.toFixed(1)}°)`;
}

export const EQUIPMENT_LABEL = { 'naked-eye': 'Naked eye', binoculars: 'Binoculars', 'small-telescope': 'Small telescope', telescope: 'Telescope' } as const;
