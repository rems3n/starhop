/**
 * WebGL2 renderer. Owns every GPU resource. All geometry is static (J2000 unit vectors uploaded once);
 * a frame is a handful of uniforms and ~10–20 draw calls.
 *
 * Pass order: sky background (+ Milky Way) → grids → ecliptic → boundaries → constellation lines → stars
 *             → Sun/Moon/planets → ground + horizon line.
 */
import type { Catalog } from '@/data/catalog';
import type { FaintStars, LayerState, MilkyWay } from '@/types';
import { DEG, lonLatToVec, slerpAppend, transpose33, type Mat3 } from './camera';
import { bvToRgb, type RGBA } from './color';
import { OBLIQUITY_J2000 } from './ephemeris';
import { rasteriseMilkyWay } from './milkyway';
import { BODY_FS, BODY_VS, FULLSCREEN_VS, GROUND_FS, LINE_FS, LINE_VS, SKY_FS, STAR_FS, STAR_VS } from './shaders';

export interface SkyTokens {
  lines: RGBA;
  boundaries: RGBA;
  grid: RGBA;
  ecliptic: RGBA;
  label: RGBA;
  highlight: RGBA;
  night: RGBA;
}

/** One body to draw this frame (filled by the engine, reused between frames). */
export interface BodySprite {
  visible: boolean;
  type: number; // 0 planet, 1 Sun, 2 Moon
  x: number; // CSS px
  y: number;
  r: number; // CSS px disc radius
  color: [number, number, number];
  alpha: number;
  lx: number;
  ly: number;
  lz: number;
}

/** Everything the renderer needs for one frame. Owned and mutated in place by the engine. */
export interface FrameParams {
  width: number; // CSS px
  height: number;
  dpr: number;
  fov: number;
  eqj: Mat3; // J2000 → view
  hor: Mat3; // (N, E, Up) → view
  zClip: number;
  layers: LayerState;
  /** Effective limiting magnitude after twilight */
  starLimit: number;
  starZoom: number;
  sun: Float32Array; // NEU unit vector
  sunAlt: number;
  day: number; // 0..1
  lightPollution: number;
  milkyWay: number;
  bodies: BodySprite[];
}

interface Program {
  prog: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}
interface LineSet {
  data: Float32Array;
  count: number;
  vao: WebGLVertexArrayObject | null;
  buf: WebGLBuffer | null;
}
interface StarSet {
  data: Float32Array; // 7 floats per star: x y z mag r g b
  mags: Float32Array;
  count: number;
  vao: WebGLVertexArrayObject | null;
  buf: WebGLBuffer | null;
}

const SEG_DEG = 2.5;

function pushArc(out: number[], a: number[], b: number[]): void {
  const pts: number[] = [];
  slerpAppend(a, 0, b, 0, SEG_DEG, pts, true);
  for (let i = 0; i + 5 < pts.length; i += 3) out.push(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], pts[i + 4], pts[i + 5]);
}

export function buildConstellationLines(catalog: Catalog): Float32Array {
  const out: number[] = [];
  const a = [0, 0, 0], b = [0, 0, 0];
  for (const c of catalog.constellations) {
    for (const line of c.lines) {
      for (let i = 0; i + 1 < line.length; i++) {
        lonLatToVec(line[i][0], line[i][1], a);
        lonLatToVec(line[i + 1][0], line[i + 1][1], b);
        pushArc(out, a, b);
      }
    }
  }
  return new Float32Array(out);
}

export function buildBoundaryLines(catalog: Catalog): Float32Array {
  const out: number[] = [];
  const seen = new Set<string>();
  const key = (p: [number, number]) => `${Math.round(p[0] * 200)},${Math.round(p[1] * 200)}`;
  const a = [0, 0, 0], b = [0, 0, 0];
  for (const c of catalog.constellations) {
    for (const poly of c.boundary) {
      const n = poly.length;
      for (let i = 0; i < n; i++) {
        const p = poly[i], q = poly[(i + 1) % n];
        const kp = key(p), kq = key(q);
        if (kp === kq) continue;
        const k = kp < kq ? `${kp}|${kq}` : `${kq}|${kp}`;
        if (seen.has(k)) continue; // neighbours share edges; draw each once
        seen.add(k);
        lonLatToVec(p[0], p[1], a);
        lonLatToVec(q[0], q[1], b);
        pushArc(out, a, b);
      }
    }
  }
  return new Float32Array(out);
}

/** Longitude/latitude grid: meridians every 15°, parallels every 10°, in whichever frame the matrix maps from. */
export function buildGrid(): Float32Array {
  const out: number[] = [];
  const a = [0, 0, 0], b = [0, 0, 0];
  for (let lon = 0; lon < 360; lon += 15) {
    const top = lon % 90 === 0 ? 90 : 80;
    for (let lat = -top; lat < top; lat += SEG_DEG) {
      lonLatToVec(lon, lat, a);
      lonLatToVec(lon, lat + SEG_DEG, b);
      out.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    }
  }
  for (let lat = -80; lat <= 80; lat += 10) {
    for (let lon = 0; lon < 360; lon += SEG_DEG) {
      lonLatToVec(lon, lat, a);
      lonLatToVec(lon + SEG_DEG, lat, b);
      out.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    }
  }
  return new Float32Array(out);
}

export function eclipticVec(lonDeg: number, out: number[]): void {
  const l = lonDeg * DEG, e = OBLIQUITY_J2000 * DEG;
  out[0] = Math.cos(l);
  out[1] = Math.sin(l) * Math.cos(e);
  out[2] = Math.sin(l) * Math.sin(e);
}
export function buildEcliptic(): Float32Array {
  const out: number[] = [];
  const a = [0, 0, 0], b = [0, 0, 0];
  for (let lon = 0; lon < 360; lon += SEG_DEG) {
    eclipticVec(lon, a);
    eclipticVec(lon + SEG_DEG, b);
    out.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  }
  return new Float32Array(out);
}

function buildStarData(n: number, ra: (i: number) => number, dec: (i: number) => number, mag: (i: number) => number, bv: (i: number) => number | undefined): { data: Float32Array; mags: Float32Array } {
  const data = new Float32Array(n * 7);
  const mags = new Float32Array(n);
  const v = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    lonLatToVec(ra(i), dec(i), v);
    const c = bvToRgb(bv(i));
    const o = i * 7;
    data[o] = v[0]; data[o + 1] = v[1]; data[o + 2] = v[2];
    data[o + 3] = mag(i);
    data[o + 4] = c[0]; data[o + 5] = c[1]; data[o + 6] = c[2];
    mags[i] = mag(i);
  }
  return { data, mags };
}

/** Number of entries in an ascending array that are < limit. */
export function countBelow(sorted: Float32Array, limit: number): number {
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < limit) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export class Renderer {
  gl: WebGL2RenderingContext | null = null;
  /** Stats of the last drawn frame */
  drawCalls = 0;
  vertices = 0;
  glErrors = 0;
  lost = false;

  private stars: StarSet;
  private faint: StarSet | null = null;
  private conLines: LineSet;
  private boundaries: LineSet;
  private grid: LineSet;
  private ecliptic: LineSet;
  private pSky!: Program;
  private pGround!: Program;
  private pStar!: Program;
  private pLine!: Program;
  private pBody!: Program;
  private quadBuf: WebGLBuffer | null = null;
  private quadVao: WebGLVertexArrayObject | null = null;
  private emptyVao: WebGLVertexArrayObject | null = null;
  private mwTex: WebGLTexture | null = null;
  private mwCanvas: HTMLCanvasElement | null = null;
  private maxPoint = 64;
  private m32 = new Float32Array(9);
  private t64 = new Float64Array(9);
  private checkErrors: boolean;

  constructor(private canvas: HTMLCanvasElement, catalog: Catalog, private tokens: SkyTokens, opts?: { checkErrors?: boolean }) {
    this.checkErrors = !!opts?.checkErrors;
    const s = catalog.stars;
    const sd = buildStarData(s.length, (i) => s[i].ra, (i) => s[i].dec, (i) => s[i].mag, (i) => s[i].bv);
    this.stars = { ...sd, count: s.length, vao: null, buf: null };
    const mk = (data: Float32Array): LineSet => ({ data, count: data.length / 6, vao: null, buf: null });
    this.conLines = mk(buildConstellationLines(catalog));
    this.boundaries = mk(buildBoundaryLines(catalog));
    this.grid = mk(buildGrid());
    this.ecliptic = mk(buildEcliptic());
    if (catalog.milkyWay) this.mwCanvas = rasteriseMilkyWay(catalog.milkyWay);
    this.initGL();
  }

  get hasMilkyWay(): boolean {
    return !!this.mwCanvas;
  }
  get starData(): Float32Array {
    return this.stars.data;
  }
  get starMags(): Float32Array {
    return this.stars.mags;
  }
  get faintCount(): number {
    return this.faint?.count ?? 0;
  }

  setMilkyWay(mw: MilkyWay): void {
    this.mwCanvas = rasteriseMilkyWay(mw);
    this.uploadMilkyWay();
  }

  setFaintStars(f: FaintStars): void {
    const sd = buildStarData(f.ra.length, (i) => f.ra[i], (i) => f.dec[i], (i) => f.mag[i], (i) => f.bv[i]);
    if (this.faint && this.gl) {
      this.gl.deleteBuffer(this.faint.buf);
      this.gl.deleteVertexArray(this.faint.vao);
    }
    this.faint = { ...sd, count: f.ra.length, vao: null, buf: null };
    if (this.gl && !this.lost) this.uploadStars(this.faint);
  }

  /** (Re)create every GL object. Called at start and after a restored context. */
  initGL(): void {
    const gl = this.canvas.getContext('webgl2', { antialias: true, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    this.lost = false;
    this.pSky = this.program(FULLSCREEN_VS, SKY_FS, ['u_inv', 'u_viewToHor', 'u_viewToEq', 'u_sun', 'u_sunAlt', 'u_atmo', 'u_lp', 'u_mw', 'u_night', 'u_mwTex']);
    this.pGround = this.program(FULLSCREEN_VS, GROUND_FS, ['u_inv', 'u_viewToHor', 'u_ground', 'u_line', 'u_day', 'u_lineColor']);
    this.pStar = this.program(STAR_VS, STAR_FS, ['u_m', 'u_scale', 'u_dpr', 'u_lim', 'u_zoom', 'u_maxPt', 'u_bright']);
    this.pLine = this.program(LINE_VS, LINE_FS, ['u_m', 'u_scale', 'u_viewport', 'u_width', 'u_zclip', 'u_color', 'u_half']);
    this.pBody = this.program(BODY_VS, BODY_FS, ['u_center', 'u_halfSize', 'u_type', 'u_extent', 'u_px', 'u_color', 'u_alpha', 'u_light', 'u_day']);
    const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array;
    this.maxPoint = Math.min(256, range[1]);

    this.quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 1, -1, 0, 1, 1, 1]), gl.STATIC_DRAW);
    this.quadVao = gl.createVertexArray();
    gl.bindVertexArray(this.quadVao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.emptyVao = gl.createVertexArray();

    this.uploadStars(this.stars);
    if (this.faint) this.uploadStars(this.faint);
    for (const ls of [this.conLines, this.boundaries, this.grid, this.ecliptic]) this.uploadLines(ls);
    this.uploadMilkyWay();
    gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
  }

  private program(vsSrc: string, fsSrc: string, uniforms: string[]): Program {
    const gl = this.gl!;
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) {
        throw new Error(`Sky shader compile failed: ${gl.getShaderInfoLog(sh) ?? ''}`);
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost()) {
      throw new Error(`Sky shader link failed: ${gl.getProgramInfoLog(prog) ?? ''}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    const u: Program['u'] = {};
    for (const name of uniforms) u[name] = gl.getUniformLocation(prog, name);
    return { prog, u };
  }

  private uploadStars(s: StarSet): void {
    const gl = this.gl!;
    s.buf = gl.createBuffer();
    s.vao = gl.createVertexArray();
    gl.bindVertexArray(s.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, s.buf);
    gl.bufferData(gl.ARRAY_BUFFER, s.data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 28, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 28, 16);
    gl.bindVertexArray(null);
  }

  private uploadLines(ls: LineSet): void {
    const gl = this.gl!;
    ls.buf = gl.createBuffer();
    ls.vao = gl.createVertexArray();
    gl.bindVertexArray(ls.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, ls.buf);
    gl.bufferData(gl.ARRAY_BUFFER, ls.data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 24, 12);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
  }

  private uploadMilkyWay(): void {
    const gl = this.gl;
    if (!gl || this.lost) return;
    if (this.mwTex) gl.deleteTexture(this.mwTex);
    this.mwTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.mwTex);
    if (this.mwCanvas) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.mwCanvas);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  private mat(loc: WebGLUniformLocation | null, m: Mat3): void {
    const a = this.m32;
    for (let i = 0; i < 9; i++) a[i] = m[i];
    this.gl!.uniformMatrix3fv(loc, true, a); // row-major in, so let GL transpose
  }

  private drawLines(ls: LineSet, m: Mat3, color: RGBA, alphaMul: number, widthCss: number, f: FrameParams, sx: number, sy: number): void {
    if (!ls.count || !ls.vao) return;
    const gl = this.gl!;
    const p = this.pLine;
    this.mat(p.u.u_m, m);
    gl.uniform2f(p.u.u_scale, sx, sy);
    gl.uniform2f(p.u.u_viewport, this.canvas.width, this.canvas.height);
    const wpx = Math.max(1, widthCss * f.dpr);
    gl.uniform1f(p.u.u_width, wpx + 2);
    gl.uniform1f(p.u.u_half, wpx / 2);
    gl.uniform1f(p.u.u_zclip, f.zClip);
    gl.uniform4f(p.u.u_color, color[0], color[1], color[2], color[3] * alphaMul);
    gl.bindVertexArray(ls.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, ls.count);
    this.drawCalls++;
    this.vertices += ls.count * 4;
  }

  draw(f: FrameParams): void {
    const gl = this.gl;
    if (!gl || this.lost) return;
    this.drawCalls = 0;
    this.vertices = 0;
    const W = this.canvas.width, H = this.canvas.height;
    gl.viewport(0, 0, W, H);
    const aspect = f.width / f.height;
    const t = Math.tan((f.fov * DEG) / 4);
    const sx = 1 / (aspect * t), sy = 1 / t;
    const L = f.layers;
    const tk = this.tokens;

    // 1 — sky background
    gl.disable(gl.BLEND);
    gl.useProgram(this.pSky.prog);
    gl.bindVertexArray(this.emptyVao);
    gl.uniform2f(this.pSky.u.u_inv, aspect * t, t);
    this.mat(this.pSky.u.u_viewToHor, transpose33(f.hor, this.t64));
    this.mat(this.pSky.u.u_viewToEq, transpose33(f.eqj, this.t64));
    gl.uniform3fv(this.pSky.u.u_sun, f.sun);
    gl.uniform1f(this.pSky.u.u_sunAlt, f.sunAlt);
    gl.uniform1f(this.pSky.u.u_atmo, L.atmosphere ? 1 : 0);
    gl.uniform1f(this.pSky.u.u_lp, f.lightPollution);
    gl.uniform1f(this.pSky.u.u_mw, f.milkyWay);
    gl.uniform3f(this.pSky.u.u_night, tk.night[0], tk.night[1], tk.night[2]);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.mwTex);
    gl.uniform1i(this.pSky.u.u_mwTex, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.drawCalls++;
    this.vertices += 3;

    // 2 — lines (premultiplied alpha)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const lineFade = 1 - 0.85 * f.day; // lines stay readable but quieter against a daytime sky
    if (L.equatorialGrid || L.azimuthalGrid || L.ecliptic || L.constellationBoundaries || L.constellationLines) {
      gl.useProgram(this.pLine.prog);
      if (L.equatorialGrid) this.drawLines(this.grid, f.eqj, tk.grid, 1, 1, f, sx, sy);
      if (L.azimuthalGrid) this.drawLines(this.grid, f.hor, tk.grid, 1.15, 1, f, sx, sy);
      if (L.ecliptic) this.drawLines(this.ecliptic, f.eqj, tk.ecliptic, 1, 1.25, f, sx, sy);
      if (L.constellationBoundaries) this.drawLines(this.boundaries, f.eqj, tk.boundaries, lineFade, 1, f, sx, sy);
      if (L.constellationLines) this.drawLines(this.conLines, f.eqj, tk.lines, lineFade, 1.25, f, sx, sy);
    }

    // 3 — stars (additive)
    if (f.starLimit > -2) {
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(this.pStar.prog);
      const p = this.pStar;
      this.mat(p.u.u_m, f.eqj);
      gl.uniform2f(p.u.u_scale, sx, sy);
      gl.uniform1f(p.u.u_dpr, f.dpr);
      gl.uniform1f(p.u.u_lim, f.starLimit);
      gl.uniform1f(p.u.u_zoom, f.starZoom);
      gl.uniform1f(p.u.u_maxPt, this.maxPoint);
      gl.uniform1f(p.u.u_bright, 1);
      const n = countBelow(this.stars.mags, f.starLimit);
      if (n > 0 && this.stars.vao) {
        gl.bindVertexArray(this.stars.vao);
        gl.drawArrays(gl.POINTS, 0, n);
        this.drawCalls++;
        this.vertices += n;
      }
      if (this.faint && this.faint.vao && f.starLimit > 6.5) {
        const nf = countBelow(this.faint.mags, f.starLimit);
        if (nf > 0) {
          gl.bindVertexArray(this.faint.vao);
          gl.drawArrays(gl.POINTS, 0, nf);
          this.drawCalls++;
          this.vertices += nf;
        }
      }
    }

    // 4 — Sun, Moon, planets
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (L.planets) {
      gl.useProgram(this.pBody.prog);
      gl.bindVertexArray(this.quadVao);
      const p = this.pBody;
      gl.uniform1f(p.u.u_day, f.day);
      for (let i = 0; i < f.bodies.length; i++) {
        const b = f.bodies[i];
        if (!b.visible || b.alpha <= 0.003) continue;
        const extent = b.type === 1 ? 7 : b.type === 2 ? 1.9 : 3.2;
        const half = b.r * extent;
        if (b.x < -half || b.y < -half || b.x > f.width + half || b.y > f.height + half) continue;
        gl.uniform2f(p.u.u_center, (b.x / f.width) * 2 - 1, 1 - (b.y / f.height) * 2);
        gl.uniform2f(p.u.u_halfSize, (half / f.width) * 2, (half / f.height) * 2);
        gl.uniform1i(p.u.u_type, b.type);
        gl.uniform1f(p.u.u_extent, extent);
        gl.uniform1f(p.u.u_px, 0.75 / Math.max(0.5, b.r * f.dpr));
        gl.uniform3f(p.u.u_color, b.color[0], b.color[1], b.color[2]);
        gl.uniform1f(p.u.u_alpha, b.alpha);
        gl.uniform3f(p.u.u_light, b.lx, b.ly, b.lz);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        this.drawCalls++;
        this.vertices += 4;
      }
    }

    // 5 — ground and horizon line
    if (L.ground || L.horizon) {
      gl.useProgram(this.pGround.prog);
      gl.bindVertexArray(this.emptyVao);
      const p = this.pGround;
      gl.uniform2f(p.u.u_inv, aspect * t, t);
      this.mat(p.u.u_viewToHor, transpose33(f.hor, this.t64));
      gl.uniform1f(p.u.u_ground, L.ground ? 1 : 0);
      gl.uniform1f(p.u.u_line, L.horizon ? 0.55 : 0);
      gl.uniform1f(p.u.u_day, L.atmosphere ? f.day : 0);
      gl.uniform3f(p.u.u_lineColor, tk.label[0] * 0.8, tk.label[1] * 0.8, tk.label[2] * 0.8);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.drawCalls++;
      this.vertices += 3;
    }
    gl.bindVertexArray(null);

    if (this.checkErrors) {
      const e = gl.getError();
      if (e !== gl.NO_ERROR && e !== gl.CONTEXT_LOST_WEBGL) {
        this.glErrors++;
        console.error(`[sky] WebGL error 0x${e.toString(16)}`);
      }
    }
  }

  destroy(loseContext = true): void {
    const gl = this.gl;
    if (!gl) return;
    for (const s of [this.stars, this.faint]) {
      if (!s) continue;
      gl.deleteBuffer(s.buf);
      gl.deleteVertexArray(s.vao);
      s.buf = null;
      s.vao = null;
    }
    for (const ls of [this.conLines, this.boundaries, this.grid, this.ecliptic]) {
      gl.deleteBuffer(ls.buf);
      gl.deleteVertexArray(ls.vao);
      ls.buf = null;
      ls.vao = null;
    }
    gl.deleteBuffer(this.quadBuf);
    gl.deleteVertexArray(this.quadVao);
    gl.deleteVertexArray(this.emptyVao);
    gl.deleteTexture(this.mwTex);
    for (const p of [this.pSky, this.pGround, this.pStar, this.pLine, this.pBody]) if (p) gl.deleteProgram(p.prog);
    if (loseContext) gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.gl = null;
  }
}
