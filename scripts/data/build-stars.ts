/**
 * Stars: HYG database v4.1 → public/data/stars.json (mag ≤ 6.5) and stars-faint.json (6.5 < mag ≤ 7.6).
 */
import * as Astronomy from 'astronomy-engine';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'node:fs';
import type { FaintStars, Star } from '../../src/types';
import { IAU88_SET, Report, download, num, round, roundSig } from './lib';

export const HYG_URL = 'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv';
export const BRIGHT_LIMIT = 6.5;
export const FAINT_LIMIT = 7.6;
const PC_TO_LY = 3.26156;

/** HYG three-letter Greek abbreviations → unicode. */
const GREEK: Record<string, string> = {
  Alp: 'α', Bet: 'β', Gam: 'γ', Del: 'δ', Eps: 'ε', Zet: 'ζ', Eta: 'η', The: 'θ', Iot: 'ι', Kap: 'κ', Lam: 'λ', Mu: 'μ',
  Nu: 'ν', Xi: 'ξ', Omi: 'ο', Pi: 'π', Rho: 'ρ', Sig: 'σ', Tau: 'τ', Ups: 'υ', Phi: 'φ', Chi: 'χ', Psi: 'ψ', Ome: 'ω',
};

/**
 * HYG encodes Bayer letters as "Alp", "Pi", "Pi-3" in the `bayer` column and e.g. "21Alp And", "Kap1Scl",
 * "Pi 3Ori" inside `bf`. Returns unicode Greek + optional index ("π3"), or undefined for anything else.
 */
export function parseBayer(raw: string): string | undefined {
  const m = /^([A-Za-z]{2,3})\s*-?\s*(\d{1,2})?$/.exec(raw.trim());
  if (!m) return undefined;
  const key = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
  const g = GREEK[key];
  if (!g) return undefined;
  return g + (m[2] ? String(Number(m[2])) : '');
}

/** Split a `bf` value ("21Alp And", "Kap1Scl", "29    Psc") into Flamsteed number, Bayer part and constellation. */
export function parseBf(bf: string): { flam?: number; bayer?: string; con?: string } {
  const t = bf.trim();
  if (!t) return {};
  const con = t.slice(-3);
  const head = t.slice(0, -3).trim();
  const m = /^(\d+)?\s*([A-Za-z]{2,3}\s*\d{0,2})?$/.exec(head);
  if (!m) return { con };
  return { flam: m[1] ? Number(m[1]) : undefined, bayer: m[2] ? parseBayer(m[2]) : undefined, con };
}

type Row = Record<string, string>;

export interface StarsResult { stars: Star[]; faint: FaintStars; version: string }

export async function buildStars(report: Report): Promise<StarsResult> {
  const path = await download('hyg-v41.csv', HYG_URL);
  const rows = parse(readFileSync(path), { columns: true, skip_empty_lines: true }) as Row[];
  report.section('Stars (HYG v4.1)');
  report.note(`HYG rows: ${rows.length}`);

  const stars: Star[] = [];
  const faintRows: { ra: number; dec: number; mag: number; bv: number; id: number }[] = [];
  let conComputed = 0;
  let conMismatch = 0;
  const bayerUnparsed: string[] = [];
  const conFromBf: string[] = [];

  for (const r of rows) {
    const id = Number(r.id);
    if (id === 0 || r.proper === 'Sol') continue; // the Sun
    const mag = num(r.mag);
    if (mag === undefined || mag > FAINT_LIMIT) continue;
    const raDeg = Number(r.ra) * 15; // HYG RA is in hours
    const dec = Number(r.dec);
    if (!isFinite(raDeg) || !isFinite(dec)) continue;

    if (mag > BRIGHT_LIMIT) {
      const bv = num(r.ci);
      faintRows.push({ id, ra: round(raDeg, 4), dec: round(dec, 4), mag: round(mag, 2), bv: bv === undefined ? 0.6 : round(bv, 2) });
      continue;
    }

    const bf = parseBf(r.bf ?? '');
    let bayer = r.bayer ? parseBayer(r.bayer) : undefined;
    if (r.bayer && !bayer) bayerUnparsed.push(`${id}:${r.bayer}`);
    if (!bayer && bf.bayer) bayer = bf.bayer;
    const flam = num(r.flam) ?? bf.flam;

    // Constellation: HYG `con`; else the one in the Bayer/Flamsteed designation; else from the IAU boundaries.
    const engineCon = Astronomy.Constellation(raDeg / 15, dec).symbol;
    let con = (r.con ?? '').trim();
    if (!IAU88_SET.has(con)) {
      con = bf.con && IAU88_SET.has(bf.con) ? bf.con : engineCon;
      conComputed++;
    }
    if (bf.con && IAU88_SET.has(bf.con) && bf.con !== con) {
      // Keep designation and constellation consistent so "58 Ori" style lookups work.
      conFromBf.push(`${id} ${r.bf.trim()} (HYG con ${con})`);
      con = bf.con;
    }
    if (con !== engineCon) conMismatch++;

    const hip = num(r.hip);
    const hd = num(r.hd);
    const hr = num(r.hr);
    let desig: string;
    if (bayer) desig = `${bayer} ${con}`;
    else if (flam !== undefined) desig = `${flam} ${con}`;
    else if (hr !== undefined) desig = `HR ${hr}`;
    else if (hd !== undefined) desig = `HD ${hd}`;
    else if (hip !== undefined) desig = `HIP ${hip}`;
    else if (r.gl?.trim()) desig = r.gl.trim();
    else desig = `HYG ${id}`;

    const distPc = num(r.dist);
    const distKnown = distPc !== undefined && distPc > 0 && distPc < 100000;
    const bv = num(r.ci);
    const absMag = num(r.absmag);
    const sp = (r.spect ?? '').trim();
    const name = (r.proper ?? '').trim();

    // Key order is fixed here so the output is byte-stable.
    const s: Star = { id, ra: round(raDeg, 5), dec: round(dec, 5), mag: round(mag, 2), con, desig };
    if (hip !== undefined) s.hip = hip;
    if (hd !== undefined) s.hd = hd;
    if (hr !== undefined) s.hr = hr;
    if (bv !== undefined) s.bv = round(bv, 3);
    if (sp) s.sp = sp;
    if (distKnown) s.distLy = roundSig(distPc * PC_TO_LY, 3);
    if (distKnown && absMag !== undefined) s.absMag = round(absMag, 2);
    if (name) s.name = name;
    if (bayer) s.bayer = bayer;
    if (flam !== undefined) s.flam = flam;
    stars.push(s);
  }

  stars.sort((a, b) => a.mag - b.mag || a.id - b.id);
  faintRows.sort((a, b) => a.mag - b.mag || a.id - b.id);
  const faint: FaintStars = { ra: faintRows.map((f) => f.ra), dec: faintRows.map((f) => f.dec), mag: faintRows.map((f) => f.mag), bv: faintRows.map((f) => f.bv) };

  report.note(`stars.json: ${stars.length} stars (mag ≤ ${BRIGHT_LIMIT}, Sun excluded)`);
  report.note(`stars-faint.json: ${faintRows.length} stars (${BRIGHT_LIMIT} < mag ≤ ${FAINT_LIMIT})`);
  report.note(`with proper name: ${stars.filter((s) => s.name).length}; Bayer: ${stars.filter((s) => s.bayer).length}; Flamsteed: ${stars.filter((s) => s.flam !== undefined).length}`);
  report.note(`without distance: ${stars.filter((s) => s.distLy === undefined).length}; without B−V: ${stars.filter((s) => s.bv === undefined).length}; without spectral type: ${stars.filter((s) => !s.sp).length}`);
  report.note(`constellation blank/invalid in HYG and filled in: ${conComputed}`);
  report.note(`constellation taken from the designation instead of HYG con: ${conFromBf.length}${conFromBf.length ? ' — ' + conFromBf.join('; ') : ''}`);
  report.note(`stars whose con differs from the IAU boundary lookup (astronomy-engine): ${conMismatch}`);
  if (bayerUnparsed.length) report.note(`UNPARSED bayer values: ${bayerUnparsed.join(', ')}`);
  const fallback = stars.filter((s) => /^(HYG|Gl|GJ|NN|Wo)/.test(s.desig));
  if (fallback.length) report.note(`stars with no HR/HD/HIP designation: ${fallback.map((s) => `${s.id}=${s.desig}`).join(', ')}`);

  return { stars, faint, version: 'v4.1' };
}
