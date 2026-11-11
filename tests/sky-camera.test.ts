import { describe, expect, it } from 'vitest';
import * as Astronomy from 'astronomy-engine';
import {
  angleBetween, clipZ, fovScale, horizontalFov, isClipSafe, lonLatToVec, makeCamera, mat3, mountMatrix, mul33, projectLonLat, projectRaDec,
  slerpAppend, transpose33, unprojectLonLat, unprojectRaDec, lonDelta, normLon,
} from '@/sky/camera';
import { eqjToNeu } from '@/sky/ephemeris';
import type { ViewState } from '@/types';

const BROOKLYN = { name: 'Brooklyn, NY', lat: 40.6782, lon: -73.9442, tz: 'America/New_York', elevationM: 10 };
const W = 1280, H = 800;

/** Small deterministic PRNG so failures are reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function sep(aLon: number, aLat: number, bLon: number, bLat: number): number {
  const a = [0, 0, 0], b = [0, 0, 0];
  lonLatToVec(aLon, aLat, a);
  lonLatToVec(bLon, bLat, b);
  return angleBetween(a[0], a[1], a[2], b[0], b[1], b[2]);
}

describe('sky camera: matrices', () => {
  it('mount matrices are proper/improper rotations with orthonormal rows', () => {
    const r = rng(1);
    for (const mount of ['altaz', 'equatorial'] as const) {
      for (let i = 0; i < 200; i++) {
        const m = mountMatrix(mount, r() * 360, r() * 180 - 90, r() * 360, mat3());
        const p = mul33(m, transpose33(m, mat3()), mat3());
        for (let k = 0; k < 9; k++) expect(p[k]).toBeCloseTo(k % 4 === 0 ? 1 : 0, 12);
      }
    }
  });
  it('is well defined at the poles and the zenith', () => {
    for (const mount of ['altaz', 'equatorial'] as const) {
      for (const lat of [90, -90]) {
        const m = mountMatrix(mount, 123, lat, 0, mat3());
        for (let k = 0; k < 9; k++) expect(Number.isFinite(m[k])).toBe(true);
        const cam = makeCamera({ mount, lon: 123, lat, roll: 0, fov: 90 }, W, H);
        const c = projectLonLat(cam, 0, lat);
        expect(c.x).toBeCloseTo(W / 2, 6);
        expect(c.y).toBeCloseTo(H / 2, 6);
      }
    }
    // looking at the zenith while facing north (az 0): north horizon is at the bottom and east stays on the right, as when you tip your head back
    const cam = makeCamera({ mount: 'altaz', lon: 0, lat: 90, roll: 0, fov: 120 }, W, H);
    const north = projectLonLat(cam, 0, 45), east = projectLonLat(cam, 90, 45);
    expect(north.y).toBeGreaterThan(H / 2);
    expect(Math.abs(north.x - W / 2)).toBeLessThan(1e-6);
    expect(east.x).toBeGreaterThan(W / 2);
  });
});

describe('sky camera: orientation', () => {
  it('altaz: facing south, east is left, west is right, up is up', () => {
    const cam = makeCamera({ mount: 'altaz', lon: 180, lat: 20, roll: 0, fov: 100 }, W, H);
    expect(projectLonLat(cam, 150, 20).x).toBeLessThan(W / 2);
    expect(projectLonLat(cam, 210, 20).x).toBeGreaterThan(W / 2);
    expect(projectLonLat(cam, 180, 50).y).toBeLessThan(H / 2);
    // level horizon: two points at altitude 0 symmetric about the view direction have the same y
    expect(projectLonLat(cam, 140, 0).y).toBeCloseTo(projectLonLat(cam, 220, 0).y, 9);
  });
  it('equatorial: north up, RA increases to the left (sky seen from inside)', () => {
    const cam = makeCamera({ mount: 'equatorial', lon: 80, lat: 0, roll: 0, fov: 60 }, W, H);
    expect(projectLonLat(cam, 80, 10).y).toBeLessThan(H / 2);
    expect(projectLonLat(cam, 90, 0).x).toBeLessThan(W / 2);
  });
  it('roll turns celestial north clockwise on screen', () => {
    const cam = makeCamera({ mount: 'equatorial', lon: 80, lat: 0, roll: 90, fov: 60 }, W, H);
    const n = projectLonLat(cam, 80, 10);
    expect(n.x).toBeGreaterThan(W / 2 + 50);
    expect(n.y).toBeCloseTo(H / 2, 6);
    const cam40 = makeCamera({ mount: 'equatorial', lon: 80, lat: 0, roll: 40, fov: 60 }, W, H);
    const p = projectLonLat(cam40, 80, 5);
    const ang = (Math.atan2(p.x - W / 2, H / 2 - p.y) * 180) / Math.PI;
    expect(ang).toBeCloseTo(40, 6);
  });
});

describe('sky camera: project / unproject', () => {
  it('round-trips random directions in both mounts, with roll, to < 1e-6°', () => {
    const r = rng(42);
    let worst = 0;
    for (const mount of ['altaz', 'equatorial'] as const) {
      for (let i = 0; i < 3000; i++) {
        const view: ViewState = { mount, lon: r() * 360, lat: r() * 180 - 90, roll: r() * 360, fov: 1 + r() * 159 };
        const cam = makeCamera(view, W, H);
        const lon = r() * 360, lat = (Math.asin(r() * 2 - 1) * 180) / Math.PI;
        const p = projectLonLat(cam, lon, lat);
        if (!p.ok || p.z < -0.9) continue; // near the anti-centre pixels are astronomically far away
        const back = unprojectLonLat(cam, p.x, p.y);
        worst = Math.max(worst, sep(lon, lat, back.lon, back.lat));
      }
    }
    expect(worst).toBeLessThan(1e-6);
  });
  it('round-trips J2000 positions through the altaz mount with a real sky rotation', () => {
    const neu = eqjToNeu(new Date('2026-11-10T02:00:00Z'), BROOKLYN, mat3());
    const cam = makeCamera({ mount: 'altaz', lon: 200, lat: 35, roll: 0, fov: 80 }, W, H, neu);
    const r = rng(7);
    let worst = 0;
    for (let i = 0; i < 2000; i++) {
      const ra = r() * 360, dec = r() * 180 - 90;
      const p = projectRaDec(cam, ra, dec);
      if (p.z < -0.9) continue;
      const b = unprojectRaDec(cam, p.x, p.y);
      worst = Math.max(worst, sep(ra, dec, b.ra, b.dec));
    }
    expect(worst).toBeLessThan(1e-6);
  });
  it('pixel → sky → pixel is exact too', () => {
    const cam = makeCamera({ mount: 'equatorial', lon: 10, lat: -40, roll: 33, fov: 120 }, W, H);
    for (const [x, y] of [[0, 0], [W, H], [W / 2, H / 2], [17, 700]]) {
      const s = unprojectLonLat(cam, x, y);
      const p = projectLonLat(cam, s.lon, s.lat);
      expect(p.x).toBeCloseTo(x, 7);
      expect(p.y).toBeCloseTo(y, 7);
    }
  });
  it('the view centre maps to the canvas centre and the anti-centre is flagged', () => {
    const cam = makeCamera({ mount: 'altaz', lon: 77, lat: 12, roll: 0, fov: 50 }, W, H);
    const c = projectLonLat(cam, 77, 12);
    expect(c.x).toBeCloseTo(W / 2, 9);
    expect(c.y).toBeCloseTo(H / 2, 9);
    expect(c.z).toBeCloseTo(1, 12);
    const anti = projectLonLat(cam, 257, -12);
    expect(anti.ok).toBe(false);
    expect(Number.isFinite(anti.x) && Number.isFinite(anti.y)).toBe(true);
    // just short of the anti-centre the projection is finite but far outside any screen
    const near = projectLonLat(cam, 257, -11);
    expect(near.ok).toBe(true);
    expect(Math.hypot(near.x - W / 2, near.y - H / 2)).toBeGreaterThan(50 * W);
  });
});

describe('sky camera: field of view and clipping', () => {
  it('vertical fov spans the canvas height at any aspect', () => {
    for (const fov of [1, 30, 100, 160]) {
      for (const [w, h] of [[1280, 800], [390, 844], [800, 800]]) {
        const cam = makeCamera({ mount: 'equatorial', lon: 0, lat: 0, roll: 0, fov }, w, h);
        expect(projectLonLat(cam, 0, fov / 2).y).toBeCloseTo(0, 7);
        expect(projectLonLat(cam, 0, -fov / 2).y).toBeCloseTo(h, 7);
        const hf = horizontalFov(fov, w / h);
        expect(projectLonLat(cam, hf / 2, 0).x).toBeCloseTo(0, 6);
      }
    }
    expect(fovScale(60, 800)).toBeGreaterThan(fovScale(120, 800));
    expect(horizontalFov(90, 1)).toBeCloseTo(90, 9);
  });
  it('stereographic projection keeps small circles round (conformal)', () => {
    const cam = makeCamera({ mount: 'equatorial', lon: 0, lat: 0, roll: 0, fov: 120 }, W, H);
    const c = projectLonLat(cam, 40, 30);
    const a = projectLonLat(cam, 40, 30.01), b = projectLonLat(cam, 40 + 0.01 / Math.cos((30 * Math.PI) / 180), 30);
    const da = Math.hypot(a.x - c.x, a.y - c.y), db = Math.hypot(b.x - c.x, b.y - c.y);
    expect(da / db).toBeCloseTo(1, 3);
  });
  it('clip predicate: everything on screen is safe, the far hemisphere edge is not', () => {
    for (const fov of [1, 20, 60, 100, 140, 160]) {
      for (const aspect of [0.46, 1, 1.6, 2.4]) {
        const zc = clipZ(fov, aspect);
        expect(zc).toBeGreaterThanOrEqual(-0.98);
        const h = 800, w = h * aspect;
        const cam = makeCamera({ mount: 'equatorial', lon: 0, lat: 0, roll: 0, fov }, w, h);
        // the screen corner direction must be clip-safe
        const corner = unprojectLonLat(cam, 0, 0);
        expect(isClipSafe(projectLonLat(cam, corner.lon, corner.lat).z, zc)).toBe(true);
        // a direction 3° from the anti-centre never is
        expect(isClipSafe(projectLonLat(cam, 180, 3).z, zc)).toBe(false);
        // anything clip-safe lands within a bounded distance of the screen (no streaks to infinity)
        const r = rng(fov * 10 + aspect * 100);
        for (let i = 0; i < 300; i++) {
          const p = projectLonLat(cam, r() * 360, r() * 180 - 90);
          if (p.ok && isClipSafe(p.z, zc)) expect(Math.hypot(p.x - w / 2, p.y - h / 2)).toBeLessThan(3.01 * Math.hypot(w, h) / 2 + 80 * h);
        }
      }
    }
  });
  it('great-circle subdivision stays on the sphere and respects the step', () => {
    const a = [0, 0, 0], b = [0, 0, 0];
    lonLatToVec(10, 20, a);
    lonLatToVec(150, -40, b);
    const out: number[] = [];
    slerpAppend(a, 0, b, 0, 2, out, true);
    const n = out.length / 3;
    expect(n).toBeGreaterThan(60);
    for (let i = 0; i < n; i++) {
      expect(Math.hypot(out[i * 3], out[i * 3 + 1], out[i * 3 + 2])).toBeCloseTo(1, 12);
      if (i) expect(angleBetween(out[i * 3 - 3], out[i * 3 - 2], out[i * 3 - 1], out[i * 3], out[i * 3 + 1], out[i * 3 + 2])).toBeLessThanOrEqual(2 + 1e-9);
    }
    expect(out[out.length - 3]).toBeCloseTo(b[0], 12);
  });
  it('longitude helpers wrap correctly', () => {
    expect(normLon(-10)).toBe(350);
    expect(normLon(725)).toBe(5);
    expect(lonDelta(350, 10)).toBe(-20);
    expect(lonDelta(10, 350)).toBe(20);
  });
});

describe('sky ephemeris frame', () => {
  it('J2000 → (N, E, Up) matches astronomy-engine horizontal coordinates', () => {
    const date = new Date('2026-11-10T02:00:00Z');
    const obs = new Astronomy.Observer(BROOKLYN.lat, BROOKLYN.lon, BROOKLYN.elevationM);
    const neu = eqjToNeu(date, BROOKLYN, mat3());
    for (const body of ['Moon', 'Jupiter', 'Saturn', 'Mars'] as const) {
      const j = Astronomy.Equator(body as Astronomy.Body, date, obs, false, true);
      const v = [0, 0, 0];
      lonLatToVec(j.ra * 15, j.dec, v);
      const n = neu[0] * v[0] + neu[1] * v[1] + neu[2] * v[2];
      const e = neu[3] * v[0] + neu[4] * v[1] + neu[5] * v[2];
      const u = neu[6] * v[0] + neu[7] * v[1] + neu[8] * v[2];
      const d = Astronomy.Equator(body as Astronomy.Body, date, obs, true, true);
      const hz = Astronomy.Horizon(date, obs, d.ra, d.dec);
      const az = ((Math.atan2(e, n) * 180) / Math.PI + 360) % 360;
      const alt = (Math.asin(u) * 180) / Math.PI;
      expect(sep(az, alt, hz.azimuth, hz.altitude)).toBeLessThan(0.01);
    }
  });
  it('the celestial pole sits due north at the observer latitude', () => {
    const date = new Date('2026-11-10T02:00:00Z');
    const neu = eqjToNeu(date, BROOKLYN, mat3());
    const cam = makeCamera({ mount: 'altaz', lon: 0, lat: BROOKLYN.lat, roll: 0, fov: 60 }, W, H, neu);
    const pole = unprojectRaDec(cam, W / 2, H / 2);
    expect(pole.dec).toBeGreaterThan(89.7); // pole of date is ~0.15° from the J2000 pole in 2026
  });
});
