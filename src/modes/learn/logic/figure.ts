/** Tiny constellation stick figures as SVG path data, drawn from the catalog lines. Pure. */
const D = Math.PI / 180;

function vec(ra: number, dec: number): [number, number, number] {
  return [Math.cos(dec * D) * Math.cos(ra * D), Math.cos(dec * D) * Math.sin(ra * D), Math.sin(dec * D)];
}

export interface Figure {
  /** SVG path for all the lines */
  d: string;
  /** Star dots (line vertices), unique */
  dots: { x: number; y: number }[];
  size: number;
}

/**
 * Stereographic projection centred on the middle of the figure, north up, east to the left (as the sky
 * looks from the ground), scaled to fit a `size` × `size` box with `pad` px of margin.
 */
export function buildFigure(lines: [number, number][][], size = 72, pad = 8): Figure {
  const pts = lines.flat();
  if (!pts.length) return { d: '', dots: [], size };
  const c: [number, number, number] = [0, 0, 0];
  for (const [ra, dec] of pts) {
    const v = vec(ra, dec);
    c[0] += v[0];
    c[1] += v[1];
    c[2] += v[2];
  }
  const n = Math.hypot(c[0], c[1], c[2]) || 1;
  const cz: [number, number, number] = [c[0] / n, c[1] / n, c[2] / n];
  // east and north unit vectors at the centre
  let east: [number, number, number] = [-cz[1], cz[0], 0];
  const en = Math.hypot(east[0], east[1]);
  east = en < 1e-9 ? [1, 0, 0] : [east[0] / en, east[1] / en, 0];
  const north: [number, number, number] = [cz[1] * east[2] - cz[2] * east[1], cz[2] * east[0] - cz[0] * east[2], cz[0] * east[1] - cz[1] * east[0]];
  const proj = (ra: number, dec: number): [number, number] => {
    const v = vec(ra, dec);
    const z = v[0] * cz[0] + v[1] * cz[1] + v[2] * cz[2];
    const k = 2 / (1 + Math.max(-0.99, z));
    return [-(v[0] * east[0] + v[1] * east[1] + v[2] * east[2]) * k, -(v[0] * north[0] + v[1] * north[1] + v[2] * north[2]) * k];
  };
  const flat = lines.map((l) => l.map(([ra, dec]) => proj(ra, dec)));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const l of flat) for (const [x, y] of l) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const span = Math.max(maxX - minX, maxY - minY, 1e-6);
  const s = (size - 2 * pad) / span;
  const ox = (size - (maxX - minX) * s) / 2 - minX * s;
  const oy = (size - (maxY - minY) * s) / 2 - minY * s;
  const r = (v: number) => Math.round(v * 10) / 10;
  const seen = new Set<string>();
  const dots: { x: number; y: number }[] = [];
  let d = '';
  for (const l of flat) {
    l.forEach(([x, y], i) => {
      const px = r(x * s + ox), py = r(y * s + oy);
      d += `${i ? 'L' : 'M'}${px} ${py}`;
      const k = `${px},${py}`;
      if (!seen.has(k)) {
        seen.add(k);
        dots.push({ x: px, y: py });
      }
    });
  }
  return { d, dots, size };
}
