/**
 * Pure camera maths for the sky engine. No DOM, no astronomy library.
 *
 * Conventions
 * - 3×3 matrices are Float64Array(9), row-major: m[row * 3 + col].
 * - A "mount frame" vector for (lon, lat) is (cos lat · cos lon, cos lat · sin lon, sin lat).
 *     equatorial mount: lon = RA, lat = Dec  → the J2000 equatorial frame (right-handed).
 *     altaz mount:      lon = azimuth (0 = N, 90 = E), lat = altitude → axes North, East, Up ("NEU", left-handed).
 * - View space: x = right on screen, y = up on screen, z = forward (towards the centre of the view).
 * - Stereographic projection: plane point p = (x, y) / (1 + z), i.e. radius tan(θ/2) for a direction θ away
 *   from the view centre. The vertical field of view `fov` spans the canvas height, so
 *   pixels-per-plane-unit S = (height / 2) / tan(fov / 4).
 * - The sky is seen from inside the sphere: facing south, east is on the left.
 */
import type { ViewState } from '@/types';

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
export const MIN_FOV = 1;
export const MAX_FOV = 160;

export type Mat3 = Float64Array;
export type Mount = ViewState['mount'];

export function clampFov(fov: number): number {
  return Math.min(MAX_FOV, Math.max(MIN_FOV, fov));
}
export function clampLat(lat: number): number {
  return Math.min(90, Math.max(-90, lat));
}
/** Wrap to [0, 360) */
export function normLon(lon: number): number {
  const l = lon % 360;
  return l < 0 ? l + 360 : l;
}
/** Smallest signed difference a − b in (−180, 180] */
export function lonDelta(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  else if (d <= -180) d += 360;
  return d;
}

/** Unit vector of (lon, lat) in degrees, written to out[o..o+2]. */
export function lonLatToVec(lon: number, lat: number, out: Float64Array | Float32Array | number[], o = 0): void {
  const l = lon * DEG;
  const b = lat * DEG;
  const cb = Math.cos(b);
  out[o] = cb * Math.cos(l);
  out[o + 1] = cb * Math.sin(l);
  out[o + 2] = Math.sin(b);
}
export function vecToLon(x: number, y: number): number {
  return normLon(Math.atan2(y, x) * RAD);
}
export function vecToLat(x: number, y: number, z: number): number {
  return Math.atan2(z, Math.hypot(x, y)) * RAD;
}

export function mat3(): Mat3 {
  const m = new Float64Array(9);
  m[0] = m[4] = m[8] = 1;
  return m;
}
/** out = a · b (out may alias neither) */
export function mul33(a: Mat3, b: Mat3, out: Mat3): Mat3 {
  for (let r = 0; r < 3; r++) {
    const a0 = a[r * 3], a1 = a[r * 3 + 1], a2 = a[r * 3 + 2];
    out[r * 3] = a0 * b[0] + a1 * b[3] + a2 * b[6];
    out[r * 3 + 1] = a0 * b[1] + a1 * b[4] + a2 * b[7];
    out[r * 3 + 2] = a0 * b[2] + a1 * b[5] + a2 * b[8];
  }
  return out;
}
export function transpose33(a: Mat3, out: Mat3): Mat3 {
  out[0] = a[0]; out[1] = a[3]; out[2] = a[6];
  out[3] = a[1]; out[4] = a[4]; out[5] = a[7];
  out[6] = a[2]; out[7] = a[5]; out[8] = a[8];
  return out;
}
/** out[oo..] = m · v */
export function applyMat(m: Mat3, x: number, y: number, z: number, out: Float64Array | number[], oo = 0): void {
  out[oo] = m[0] * x + m[1] * y + m[2] * z;
  out[oo + 1] = m[3] * x + m[4] * y + m[5] * z;
  out[oo + 2] = m[6] * x + m[7] * y + m[8] * z;
}
/** out[oo..] = mᵀ · v (the inverse rotation) */
export function applyMatT(m: Mat3, x: number, y: number, z: number, out: Float64Array | number[], oo = 0): void {
  out[oo] = m[0] * x + m[3] * y + m[6] * z;
  out[oo + 1] = m[1] * x + m[4] * y + m[7] * z;
  out[oo + 2] = m[2] * x + m[5] * y + m[8] * z;
}

/**
 * Mount-frame → view-space rotation. Rows are the screen-right, screen-up and forward axes written in the
 * mount frame. `up` is the derivative of the forward direction with respect to latitude, so it stays well
 * defined at the poles/zenith (there the longitude decides which way is up, which is what a level-horizon
 * mount needs when you look straight up).
 *
 * `roll` (equatorial mount only): celestial north appears rotated clockwise from screen-up by `roll` degrees.
 */
export function mountMatrix(mount: Mount, lon: number, lat: number, roll: number, out: Mat3): Mat3 {
  const l = lon * DEG;
  const b = lat * DEG;
  const cl = Math.cos(l), sl = Math.sin(l), cb = Math.cos(b), sb = Math.sin(b);
  const fx = cb * cl, fy = cb * sl, fz = sb;
  // "north" = d(forward)/d(lat)
  const nx = -sb * cl, ny = -sb * sl, nz = cb;
  // forward × north. Equatorial frame is right-handed → this is screen-right (west, RA decreasing).
  // The NEU frame is left-handed, so the same formula gives the mirror image and the sign flips.
  const s = mount === 'altaz' ? -1 : 1;
  const rx = s * (fy * nz - fz * ny), ry = s * (fz * nx - fx * nz), rz = s * (fx * ny - fy * nx);
  const rr = mount === 'altaz' ? 0 : roll * DEG;
  const c = Math.cos(rr), sn = Math.sin(rr);
  // screen right = r·cos + n·sin ; screen up = n·cos − r·sin
  out[0] = rx * c + nx * sn; out[1] = ry * c + ny * sn; out[2] = rz * c + nz * sn;
  out[3] = nx * c - rx * sn; out[4] = ny * c - ry * sn; out[5] = nz * c - rz * sn;
  out[6] = fx; out[7] = fy; out[8] = fz;
  return out;
}

/** Pixels per stereographic plane unit for a vertical fov over `heightPx`. */
export function fovScale(fovDeg: number, heightPx: number): number {
  return heightPx / 2 / Math.tan((fovDeg * DEG) / 4);
}

/** Horizontal field of view (degrees) for a given vertical fov and aspect = width / height. */
export function horizontalFov(fovDeg: number, aspect: number): number {
  return 4 * Math.atan(aspect * Math.tan((fovDeg * DEG) / 4)) * RAD;
}

/**
 * View-space z below which a direction is "too far behind" to take part in line drawing.
 * Stereographic projection blows up towards the anti-centre (z → −1), so line segments with an end beyond
 * `margin` × the screen half-diagonal (in plane units) are dropped instead of drawn. Never lets through
 * anything within ~11° of the anti-centre.
 */
export function clipZ(fovDeg: number, aspect: number, margin = 3): number {
  const t = Math.tan((fovDeg * DEG) / 4);
  const r = margin * t * Math.hypot(aspect, 1);
  const z = (1 - r * r) / (1 + r * r);
  return Math.max(z, -0.98);
}
/** Clipping predicate used for every line segment: both ends must pass. */
export function isClipSafe(viewZ: number, zClip: number): boolean {
  return viewZ >= zClip;
}

/**
 * Project a view-space-ready direction: `m` maps the vector's frame to view space.
 * Writes out[0] = x px, out[1] = y px (y down), out[2] = view z. Returns false (and writes NaN-free far values)
 * when the direction is at the anti-centre.
 */
export function projectVec(m: Mat3, S: number, cx: number, cy: number, x: number, y: number, z: number, out: Float64Array | number[]): boolean {
  const vx = m[0] * x + m[1] * y + m[2] * z;
  const vy = m[3] * x + m[4] * y + m[5] * z;
  const vz = m[6] * x + m[7] * y + m[8] * z;
  out[2] = vz;
  const w = 1 + vz;
  if (w < 1e-9) {
    out[0] = cx;
    out[1] = cy;
    return false;
  }
  out[0] = cx + (vx / w) * S;
  out[1] = cy - (vy / w) * S;
  return true;
}

/** Inverse of projectVec: pixel → unit vector in the frame `m` maps from. */
export function unprojectPx(m: Mat3, S: number, cx: number, cy: number, sx: number, sy: number, out: Float64Array | number[]): void {
  const px = (sx - cx) / S;
  const py = (cy - sy) / S;
  const r2 = px * px + py * py;
  const d = 1 / (1 + r2);
  const vx = 2 * px * d, vy = 2 * py * d, vz = (1 - r2) * d;
  applyMatT(m, vx, vy, vz, out);
}

/**
 * Convenience camera for tests and one-off use: a full ViewState plus canvas size.
 * `eqjToNeu` is the J2000 → (North, East, Up) rotation for the place and time; it is required for the
 * altaz mount when projecting J2000 positions and ignored for the equatorial mount.
 */
export interface Camera {
  view: ViewState;
  width: number;
  height: number;
  /** mount frame → view */
  mount: Mat3;
  /** J2000 → view */
  eqj: Mat3;
  scale: number;
  zClip: number;
}

export function makeCamera(view: ViewState, width: number, height: number, eqjToNeu?: Mat3): Camera {
  const mount = mountMatrix(view.mount, view.lon, view.lat, view.roll, mat3());
  const eqj = mat3();
  if (view.mount === 'altaz') mul33(mount, eqjToNeu ?? mat3(), eqj);
  else eqj.set(mount);
  return { view, width, height, mount, eqj, scale: fovScale(view.fov, height), zClip: clipZ(view.fov, width / height) };
}

/** Project mount-frame coordinates (RA/Dec in equatorial mount, az/alt in altaz mount). */
export function projectLonLat(cam: Camera, lon: number, lat: number): { x: number; y: number; z: number; ok: boolean } {
  const v = [0, 0, 0];
  lonLatToVec(lon, lat, v);
  const o = [0, 0, 0];
  const ok = projectVec(cam.mount, cam.scale, cam.width / 2, cam.height / 2, v[0], v[1], v[2], o);
  return { x: o[0], y: o[1], z: o[2], ok };
}
/** Project a J2000 RA/Dec. */
export function projectRaDec(cam: Camera, ra: number, dec: number): { x: number; y: number; z: number; ok: boolean } {
  const v = [0, 0, 0];
  lonLatToVec(ra, dec, v);
  const o = [0, 0, 0];
  const ok = projectVec(cam.eqj, cam.scale, cam.width / 2, cam.height / 2, v[0], v[1], v[2], o);
  return { x: o[0], y: o[1], z: o[2], ok };
}
export function unprojectLonLat(cam: Camera, x: number, y: number): { lon: number; lat: number } {
  const o = [0, 0, 0];
  unprojectPx(cam.mount, cam.scale, cam.width / 2, cam.height / 2, x, y, o);
  return { lon: vecToLon(o[0], o[1]), lat: vecToLat(o[0], o[1], o[2]) };
}
export function unprojectRaDec(cam: Camera, x: number, y: number): { ra: number; dec: number } {
  const o = [0, 0, 0];
  unprojectPx(cam.eqj, cam.scale, cam.width / 2, cam.height / 2, x, y, o);
  return { ra: vecToLon(o[0], o[1]), dec: vecToLat(o[0], o[1], o[2]) };
}
export function isOnScreen(cam: Camera, x: number, y: number, margin = 0): boolean {
  return x >= -margin && y >= -margin && x <= cam.width + margin && y <= cam.height + margin;
}

/** Angle between two unit vectors, degrees. Accurate for tiny and near-180° angles. */
export function angleBetween(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
  return Math.atan2(Math.hypot(cx, cy, cz), ax * bx + ay * by + az * bz) * RAD;
}

/**
 * Great-circle interpolation from a to b in steps of at most `maxStepDeg`; appends the points (including a,
 * excluding b unless `includeEnd`) to `out` and returns the new length.
 */
export function slerpAppend(a: ArrayLike<number>, ao: number, b: ArrayLike<number>, bo: number, maxStepDeg: number, out: number[], includeEnd: boolean): void {
  const ax = a[ao], ay = a[ao + 1], az = a[ao + 2];
  const bx = b[bo], by = b[bo + 1], bz = b[bo + 2];
  const ang = angleBetween(ax, ay, az, bx, by, bz) * DEG;
  const n = Math.max(1, Math.ceil((ang * RAD) / maxStepDeg));
  const sinA = Math.sin(ang);
  for (let i = 0; i < n + (includeEnd ? 1 : 0); i++) {
    const t = i / n;
    if (sinA < 1e-9) {
      out.push(ax, ay, az);
      continue;
    }
    const wa = Math.sin((1 - t) * ang) / sinA;
    const wb = Math.sin(t * ang) / sinA;
    out.push(ax * wa + bx * wb, ay * wa + by * wb, az * wa + bz * wb);
  }
}
