/** GLSL ES 3.00 sources. Star curve constants are injected from color.ts so CPU and GPU agree. */
import { STAR } from './color';

const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/** Full-screen triangle; v_p is the stereographic plane position of the pixel. */
export const FULLSCREEN_VS = `#version 300 es
precision highp float;
uniform vec2 u_inv; // (aspect, 1) * tan(fov/4)
out vec2 v_p;
void main() {
  vec2 c = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0;
  v_p = c * u_inv;
  gl_Position = vec4(c, 0.0, 1.0);
}`;

const COMMON_FS = `
vec3 viewDir(vec2 p) { float r2 = dot(p, p); return vec3(2.0 * p, 1.0 - r2) / (1.0 + r2); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}`;

/** Sky background: night colour, atmosphere (day / twilight / light pollution), Milky Way. */
export const SKY_FS = `#version 300 es
precision highp float;
in vec2 v_p;
out vec4 o;
uniform mat3 u_viewToHor;
uniform mat3 u_viewToEq;
uniform vec3 u_sun;      // unit vector to the Sun in (N, E, Up)
uniform float u_sunAlt;  // degrees
uniform float u_atmo;    // 0 / 1
uniform float u_lp;      // light pollution 0..1
uniform float u_mw;      // Milky Way strength
uniform vec3 u_night;    // base night colour
uniform sampler2D u_mwTex;
${COMMON_FS}
void main() {
  vec3 v = viewDir(v_p);
  vec3 col = u_night;
  float night = 1.0;
  if (u_atmo > 0.5) {
    vec3 h = u_viewToHor * v;
    float a = clamp(h.z, 0.0, 1.0);          // sin(altitude); below the horizon behaves like the horizon
    float hz = 1.0 - a;
    float hz3 = hz * hz * hz;
    float day = smoothstep(-9.0, 3.0, u_sunAlt);
    float tw = smoothstep(-17.0, -5.0, u_sunAlt) * (1.0 - smoothstep(-1.0, 9.0, u_sunAlt));
    night = 1.0 - smoothstep(-16.0, -4.0, u_sunAlt);
    vec3 nightC = u_night * (1.0 + 0.9 * hz3 * hz) + vec3(0.003, 0.005, 0.012) * hz3;
    float zen = smoothstep(-9.0, 8.0, u_sunAlt);
    vec3 dayZen = mix(vec3(0.05, 0.10, 0.30), vec3(0.16, 0.37, 0.78), zen);
    vec3 dayHor = mix(vec3(0.20, 0.30, 0.52), vec3(0.62, 0.78, 0.94), zen);
    vec3 dayC = mix(dayZen, dayHor, hz3);
    col = mix(nightC, dayC, day);
    // twilight glow hugging the horizon, strongest towards the Sun's azimuth
    vec2 hxy = h.xy / max(length(h.xy), 1e-4);
    vec2 sxy = u_sun.xy / max(length(u_sun.xy), 1e-4);
    float toward = 0.5 + 0.5 * dot(hxy, sxy);
    float band = pow(hz, 6.0) * (0.22 + 0.78 * toward * toward * toward);
    vec3 warm = mix(vec3(0.95, 0.42, 0.16), vec3(1.0, 0.72, 0.42), smoothstep(-6.0, 4.0, u_sunAlt));
    col = mix(col, warm, clamp(tw * band * 0.9, 0.0, 1.0));
    col += vec3(0.30, 0.16, 0.20) * tw * pow(hz, 3.0) * (1.0 - toward) * 0.12; // faint rose opposite the Sun
    // light pollution: grey-orange dome that is brightest near the horizon
    float lp = u_lp * (1.0 - day);
    col = mix(col, vec3(0.34, 0.25, 0.17), lp * (0.07 + 0.55 * hz3));
    // the Sun's glare in a daytime sky
    float cs = max(dot(normalize(h), u_sun), 0.0);
    col += vec3(1.0, 0.92, 0.75) * day * (pow(cs, 220.0) * 0.45 + pow(cs, 10.0) * 0.16);
  }
  if (u_mw > 0.002) {
    vec3 e = u_viewToEq * v;
    float ra = atan(e.y, e.x) / 6.28318530718;
    float dec = asin(clamp(e.z, -1.0, 1.0)) / 3.14159265359;
    float m = textureLod(u_mwTex, vec2(ra, 0.5 - dec), 0.0).r;
    col += vec3(0.60, 0.68, 0.95) * (m * m * 0.2 + m * 0.8) * u_mw * night;
  }
  col += (hash12(gl_FragCoord.xy) - 0.5) / 255.0; // dither: no banding in the gradients
  o = vec4(col, 1.0);
}`;

/** Ground below the mathematical horizon + the horizon line. Premultiplied alpha. */
export const GROUND_FS = `#version 300 es
precision highp float;
in vec2 v_p;
out vec4 o;
uniform mat3 u_viewToHor;
uniform float u_ground;   // 0 / 1
uniform float u_line;     // horizon line alpha (0 = off)
uniform float u_day;      // 0 night .. 1 day
uniform vec3 u_lineColor;
${COMMON_FS}
void main() {
  vec3 h = u_viewToHor * viewDir(v_p);
  float z = h.z;
  float w = max(fwidth(z), 1e-6);
  float below = smoothstep(0.7 * w, -0.7 * w, z);
  float g = u_ground * below;
  float depth = clamp(-z, 0.0, 1.0);
  vec3 top = mix(vec3(0.050, 0.058, 0.082), vec3(0.22, 0.25, 0.20), u_day);
  vec3 deep = mix(vec3(0.020, 0.024, 0.038), vec3(0.10, 0.12, 0.10), u_day);
  vec3 gc = mix(top, deep, pow(depth, 0.55));
  // a little texture, as if the ground were a flat plain: noise in ground-plane coordinates, faded to nothing at the horizon
  vec2 q = h.xy / max(-z, 0.04);
  float n = vnoise(q * 3.0) * 0.6 + vnoise(q * 9.0) * 0.4;
  gc *= 1.0 + (n - 0.5) * 0.5 * smoothstep(0.03, 0.5, depth);
  gc += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
  float line = u_line * (1.0 - smoothstep(0.5, 1.3, abs(z) / w));
  vec3 rgb = gc * g;
  float alpha = g;
  rgb = rgb * (1.0 - line) + u_lineColor * line;
  alpha = alpha * (1.0 - line) + line;
  o = vec4(rgb, alpha);
}`;

/** Stars: one GL point per star, J2000 unit vector rotated by one matrix. */
export const STAR_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_pos;
layout(location = 1) in float a_mag;
layout(location = 2) in vec3 a_col;
uniform mat3 u_m;
uniform vec2 u_scale;   // (1/aspect, 1) / tan(fov/4)
uniform float u_dpr;
uniform float u_lim;    // effective limiting magnitude
uniform float u_zoom;
uniform float u_maxPt;
uniform float u_bright;
out vec3 v_col;
out float v_core;
out float v_half;
out float v_glow;
out float v_alpha;
void main() {
  vec3 v = u_m * a_pos;
  float w = 1.0 + v.z;
  float fade = clamp((u_lim - a_mag) / ${f(STAR.FADE)}, 0.0, 1.0);
  if (w < 0.01 || fade <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 1.0; return; }
  float r = (${f(STAR.R0)} + ${f(STAR.R1)} * pow(max(0.0, ${f(STAR.M0)} - a_mag), ${f(STAR.P)})) * u_zoom;
  float glow = smoothstep(${f(STAR.GLOW_FAINT)}, ${f(STAR.GLOW_BRIGHT)}, a_mag);
  float half_ = r * (1.15 + ${f(STAR.GLOW_SIZE)} * glow) + 1.0;
  float ps = min(2.0 * half_ * u_dpr, u_maxPt);
  gl_Position = vec4(v.xy * u_scale, 0.0, w);
  gl_PointSize = ps;
  v_half = ps * 0.5 / u_dpr;
  v_core = r;
  v_glow = glow;
  v_col = a_col;
  v_alpha = fade * clamp(${f(STAR.A0)} - ${f(STAR.A1)} * max(0.0, a_mag - ${f(STAR.AM)}), ${f(STAR.AMIN)}, 1.0) * u_bright;
}`;

export const STAR_FS = `#version 300 es
precision mediump float;
in vec3 v_col;
in float v_core;
in float v_half;
in float v_glow;
in float v_alpha;
out vec4 o;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0 * v_half;   // CSS px from the star's centre
  float core = 1.0 - smoothstep(v_core * 0.45, v_core * 1.12 + 0.55, d);
  float t = max(0.0, 1.0 - d / v_half);
  float halo = v_glow * t * t * t * 0.42;
  vec3 c = mix(v_col, vec3(1.0), core * 0.3) * core + v_col * halo;
  o = vec4(c * v_alpha, 0.0);   // additive
}`;

/** Lines: one instanced quad per short great-circle segment. */
export const LINE_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_corner;  // x: 0 = start, 1 = end; y: -1 / +1 side
layout(location = 1) in vec3 a_a;
layout(location = 2) in vec3 a_b;
uniform mat3 u_m;
uniform vec2 u_scale;
uniform vec2 u_viewport;  // device px
uniform float u_width;    // device px, including the feather
uniform float u_zclip;
out float v_side;
void main() {
  vec3 va = u_m * a_a;
  vec3 vb = u_m * a_b;
  if (min(va.z, vb.z) < u_zclip) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); v_side = 0.0; return; }
  vec2 sa = va.xy * u_scale / (1.0 + va.z) * u_viewport * 0.5;
  vec2 sb = vb.xy * u_scale / (1.0 + vb.z) * u_viewport * 0.5;
  vec2 d = sb - sa;
  float len = length(d);
  vec2 n = len > 1e-5 ? vec2(-d.y, d.x) / len : vec2(0.0, 1.0);
  vec2 p = mix(sa, sb, a_corner.x) + n * a_corner.y * u_width * 0.5;
  gl_Position = vec4(p / (u_viewport * 0.5), 0.0, 1.0);
  v_side = a_corner.y * u_width * 0.5;
}`;

export const LINE_FS = `#version 300 es
precision mediump float;
in float v_side;
uniform vec4 u_color;   // straight alpha
uniform float u_half;   // half line width, device px
out vec4 o;
void main() {
  float a = clamp(u_half + 0.5 - abs(v_side), 0.0, 1.0) * u_color.a;
  o = vec4(u_color.rgb * a, a);
}`;

/** Sun, Moon, planets: one quad each, positioned by the CPU. */
export const BODY_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_corner;  // (0|1, -1|+1) shared with the line quad
uniform vec2 u_center;   // NDC
uniform vec2 u_halfSize; // NDC
out vec2 v_uv;
void main() {
  vec2 c = vec2(a_corner.x * 2.0 - 1.0, a_corner.y);
  v_uv = c;
  gl_Position = vec4(u_center + c * u_halfSize, 0.0, 1.0);
}`;

export const BODY_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform int u_type;       // 0 planet, 1 Sun, 2 Moon
uniform float u_extent;   // quad half-size in disc radii
uniform float u_px;       // one CSS pixel in disc radii
uniform vec3 u_color;
uniform float u_alpha;
uniform vec3 u_light;     // Moon: direction to the Sun in the disc's frame (x right, y up, z towards viewer)
uniform float u_day;
void main() {
  vec2 p = v_uv * u_extent;
  float d = length(p);
  float disc = 1.0 - smoothstep(1.0 - u_px, 1.0 + u_px, d);
  float edge = max(0.0, 1.0 - d / u_extent);
  vec3 rgb;
  float a;
  if (u_type == 0) {
    float glow = edge * edge * edge * 0.55 * (1.0 - disc);
    rgb = u_color * (disc * (0.88 + 0.12 * sqrt(max(0.0, 1.0 - d * d))) + glow);
    a = disc;
  } else if (u_type == 1) {
    float g = max(0.0, d - 1.0);
    float glare = (exp(-g * 1.6) * 0.55 + exp(-g * 0.45) * 0.22) * edge * (1.0 - disc);
    rgb = mix(u_color, vec3(1.0), 0.55) * disc + u_color * glare;
    a = disc;
  } else {
    float nz = sqrt(max(0.0, 1.0 - d * d));
    vec3 n = vec3(p, nz);
    float lit = smoothstep(-0.04, 0.04, dot(n, u_light)) * disc;
    vec3 earthshine = vec3(0.060, 0.068, 0.090);
    vec3 surf = u_color * (0.80 + 0.20 * nz);
    float darkA = disc * (1.0 - u_day);     // by day the unlit part is as blue as the sky
    rgb = surf * lit + earthshine * darkA * (1.0 - lit);
    a = max(lit, darkA);
    float glow = edge * edge * edge * 0.10 * (1.0 - disc) * clamp(u_light.z * 0.5 + 0.6, 0.0, 1.0);
    rgb += u_color * glow;
  }
  o = vec4(rgb * u_alpha, a * u_alpha);
}`;
