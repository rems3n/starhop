/**
 * Milky Way: the contour polygons are painted once into a small equirectangular canvas (x = RA 0..360,
 * y = Dec +90..−90), each brightness level adding a little light, then blurred. The background shader
 * samples it per pixel, so the band is soft and costs nothing per frame on the CPU.
 */
import type { MilkyWay } from '@/types';

export const MW_W = 1024;
export const MW_H = 512;

/** Make RA continuous along a ring so polygons that cross RA 0/360 are not torn. */
export function unwrapRing(ring: [number, number][]): { pts: [number, number][]; winds: number } {
  const pts: [number, number][] = [];
  let prev = 0;
  let off = 0;
  ring.forEach(([ra, dec], i) => {
    if (i > 0) {
      const d = ra - prev;
      if (d > 180) off -= 360;
      else if (d < -180) off += 360;
    }
    prev = ra;
    pts.push([ra + off, dec]);
  });
  // A ring that runs all the way round the sky ends a full turn away from where it started.
  let closing = 0;
  if (ring.length > 1) {
    const d = ring[0][0] - ring[ring.length - 1][0];
    closing = d > 180 ? -360 : d < -180 ? 360 : 0;
  }
  const winds = Math.round((off + closing) / 360);
  return { pts, winds };
}

export function rasteriseMilkyWay(mw: MilkyWay): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const levels = [...mw.levels].sort((a, b) => a.level - b.level);
  if (!levels.length) return null;
  const raw = document.createElement('canvas');
  raw.width = MW_W;
  raw.height = MW_H;
  const ctx = raw.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, MW_W, MW_H);
  ctx.globalCompositeOperation = 'lighter';
  const X = (ra: number) => (ra / 360) * MW_W;
  const Y = (dec: number) => ((90 - dec) / 180) * MW_H;
  const per = 1 / levels.length;
  levels.forEach((lv, li) => {
    // outer levels are faint, inner ones add progressively more
    const add = Math.round(255 * per * (0.55 + 0.9 * (li / Math.max(1, levels.length - 1))) * 0.72);
    ctx.fillStyle = `rgb(${add},${add},${add})`;
    // One path for all rings and all three wrapped copies, filled once: the even-odd rule has to see the
    // copies together or the two band edges (which start at different RAs) leave a wedge up to the pole.
    ctx.beginPath();
    for (const shift of [-360, 0, 360]) {
      for (const ring of lv.polygons) {
        if (ring.length < 3) continue;
        const { pts, winds } = unwrapRing(ring);
        pts.forEach(([ra, dec], i) => {
          if (i === 0) ctx.moveTo(X(ra + shift), Y(dec));
          else ctx.lineTo(X(ra + shift), Y(dec));
        });
        if (winds !== 0) {
          // the ring circles the sky: close it over the north pole so even-odd filling of the
          // northern and southern edges leaves the band between them
          // (first repeat the starting point one full turn on, so the shifted copies tile without a gap)
          const last: [number, number] = [pts[0][0] + winds * 360, pts[0][1]];
          ctx.lineTo(X(last[0] + shift), Y(last[1]));
          ctx.lineTo(X(last[0] + shift), Y(90) - 4);
          ctx.lineTo(X(pts[0][0] + shift), Y(90) - 4);
        }
        ctx.closePath();
      }
    }
    ctx.fill('evenodd');
  });
  // blur: draw three wrapped copies through a blur filter so the RA seam stays seamless
  const out = document.createElement('canvas');
  out.width = MW_W;
  out.height = MW_H;
  const octx = out.getContext('2d');
  if (!octx) return raw;
  octx.fillStyle = '#000';
  octx.fillRect(0, 0, MW_W, MW_H);
  if ('filter' in octx) octx.filter = 'blur(5px)';
  for (const dx of [-MW_W, 0, MW_W]) octx.drawImage(raw, dx, 0);
  return out;
}
