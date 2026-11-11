/**
 * Quality checks for the generated catalog files in public/data (built by `npm run data`).
 * Rules and known exceptions are documented in docs/DATA.md.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { buildCatalog, separation } from '@/data/catalog';
import type { Constellation, Dso, FaintStars, MilkyWay, Star } from '@/types';
import { CON_TABLE } from '../scripts/data/constellation-table';
import { parseBayer, parseBf } from '../scripts/data/build-stars';
import { equipmentFor, parseCaldwellTable, parseMessierTable } from '../scripts/data/build-dsos';
import { polygonAreaSqDeg, seasonOf } from '../scripts/data/build-constellations';
import { IAU88_SET, roundSig } from '../scripts/data/lib';

const DATA = join(__dirname, '..', 'public', 'data');
const raw = (file: string) => readFileSync(join(DATA, file));
const load = <T>(file: string) => JSON.parse(raw(file).toString('utf8')) as T;

const stars = load<Star[]>('stars.json');
const faint = load<FaintStars>('stars-faint.json');
const constellations = load<Constellation[]>('constellations.json');
const dsos = load<Dso[]>('dsos.json');
const milkyWay = load<MilkyWay>('milkyway.json');
const meta = load<{ builtAt: string; counts: Record<string, number>; sources: { name: string; url: string; licence: string }[] }>('meta.json');
const catalog = buildCatalog({ stars, constellations, dsos, milkyWay });

const when = { date: new Date('2026-01-15T02:00:00Z'), observer: { name: 'Brooklyn, NY', lat: 40.6782, lon: -73.9442, tz: 'America/New_York' } };
const near = (ref: string, ra: number, dec: number, tol: number) => {
  const t = catalog.resolve(ref, when);
  expect(t, `${ref} should resolve`).not.toBeNull();
  const sep = separation(t!, { ra, dec });
  expect(sep, `${ref} is ${sep.toFixed(3)}° from (${ra}, ${dec})`).toBeLessThanOrEqual(tol);
};

/** Constellations whose stick figure has only two stars, so they cannot have three main stars. */
const TWO_STAR_FIGURES = ['CMi', 'CVn'];

describe('stars.json', () => {
  it('has about 9,000 stars, brightest first', () => {
    expect(stars.length).toBeGreaterThanOrEqual(8800);
    expect(stars.length).toBeLessThanOrEqual(9200);
    for (let i = 1; i < stars.length; i++) expect(stars[i].mag).toBeGreaterThanOrEqual(stars[i - 1].mag);
    expect(stars[stars.length - 1].mag).toBeLessThanOrEqual(6.5);
    expect(stars[0].name).toBe('Sirius');
  });

  it('has unique ids, valid positions, a constellation and a designation for every star', () => {
    expect(new Set(stars.map((s) => s.id)).size).toBe(stars.length);
    for (const s of stars) {
      expect(s.id).toBeGreaterThan(0); // the Sun (HYG id 0) is excluded
      expect(s.ra).toBeGreaterThanOrEqual(0);
      expect(s.ra).toBeLessThan(360);
      expect(Math.abs(s.dec)).toBeLessThanOrEqual(90);
      expect(IAU88_SET.has(s.con), `star ${s.id} con "${s.con}"`).toBe(true);
      expect(s.desig.trim().length, `star ${s.id} desig`).toBeGreaterThan(0);
    }
    expect(stars.some((s) => s.name === 'Sol')).toBe(false);
  });

  it('omits unknown fields and rounds values', () => {
    for (const s of stars) {
      for (const [k, v] of Object.entries(s)) expect(v === null || v === undefined || v === '', `star ${s.id}.${k}`).toBe(false);
      expect(Math.abs(s.ra * 1e5 - Math.round(s.ra * 1e5))).toBeLessThan(1e-4);
      expect(Math.abs(s.mag * 100 - Math.round(s.mag * 100))).toBeLessThan(1e-6);
      if (s.distLy !== undefined) {
        expect(s.distLy).toBeGreaterThan(0);
        expect(s.distLy).toBeLessThan(326156); // HYG's "unknown" distance (100000 pc) is never emitted
        expect(Math.abs(s.distLy - roundSig(s.distLy, 3))).toBeLessThan(1e-6 * s.distLy);
      }
    }
  });

  it('writes Bayer letters as unicode Greek with an optional index', () => {
    const withBayer = stars.filter((s) => s.bayer);
    expect(withBayer.length).toBeGreaterThan(1400);
    for (const s of withBayer) {
      expect(s.bayer, `star ${s.id}`).toMatch(/^[α-ω]\d?$/);
      expect(s.desig).toBe(`${s.bayer} ${s.con}`);
    }
    for (const s of stars.filter((x) => !x.bayer && x.flam !== undefined)) expect(s.desig).toBe(`${s.flam} ${s.con}`);
    expect(parseBayer('Alp')).toBe('α');
    expect(parseBayer('Pi-3')).toBe('π3');
    expect(parseBayer('Pi3')).toBe('π3');
    expect(parseBayer('Pi 3')).toBe('π3');
    expect(parseBayer('Ome-2')).toBe('ω2');
    expect(parseBayer('Xyz')).toBeUndefined();
    expect(parseBf('21Alp And')).toEqual({ flam: 21, bayer: 'α', con: 'And' });
    expect(parseBf('Kap1Scl')).toEqual({ flam: undefined, bayer: 'κ1', con: 'Scl' });
    expect(parseBf('29    Psc')).toEqual({ flam: 29, bayer: undefined, con: 'Psc' });
    expect(parseBf('1Pi 3Ori')).toEqual({ flam: 1, bayer: 'π3', con: 'Ori' });
  });

  it('has the right numbers for well-known stars', () => {
    const sirius = catalog.resolve('star:Sirius')!.star!;
    expect(sirius.mag).toBeLessThanOrEqual(-1.44);
    expect(sirius.mag).toBeGreaterThanOrEqual(-1.46);
    expect(sirius.desig).toBe('α CMa');
    expect(sirius.distLy).toBeGreaterThan(8.4);
    expect(sirius.distLy).toBeLessThan(8.8);
    near('star:Sirius', 101.287, -16.716, 0.05);
    near('star:Vega', 279.235, 38.784, 0.05);
    near('star:Betelgeuse', 88.793, 7.407, 0.05);
    near('star:Polaris', 37.95, 89.26, 0.05);
    const bet = catalog.resolve('star:Betelgeuse')!.star!;
    expect(bet).toMatchObject({ hip: 27989, flam: 58, bayer: 'α', con: 'Ori' });
    expect(catalog.resolve('star:π3 Ori')!.star!.name).toBe('Tabit');
  });
});

describe('stars-faint.json', () => {
  it('is columnar, sorted, and inside its magnitude range', () => {
    const n = faint.ra.length;
    expect(n).toBeGreaterThan(15000);
    expect(n).toBeLessThan(25000);
    expect(faint.dec.length).toBe(n);
    expect(faint.mag.length).toBe(n);
    expect(faint.bv.length).toBe(n);
    for (let i = 0; i < n; i++) {
      expect(faint.mag[i]).toBeGreaterThan(6.5);
      expect(faint.mag[i]).toBeLessThanOrEqual(7.6);
      if (i) expect(faint.mag[i]).toBeGreaterThanOrEqual(faint.mag[i - 1]);
      expect(Number.isFinite(faint.bv[i])).toBe(true);
      expect(faint.ra[i]).toBeGreaterThanOrEqual(0);
      expect(faint.ra[i]).toBeLessThanOrEqual(360);
    }
  });
});

describe('constellations.json', () => {
  it('has the 88 IAU constellations with unique ids', () => {
    expect(constellations.length).toBe(88);
    expect(new Set(constellations.map((c) => c.id)).size).toBe(88);
    for (const c of constellations) expect(IAU88_SET.has(c.id), c.id).toBe(true);
    expect(CON_TABLE.length).toBe(88);
  });

  it('gives every constellation names, lines, a boundary and valid star ids', () => {
    for (const c of constellations) {
      expect(c.name.length, c.id).toBeGreaterThan(2);
      expect(c.genitive.length, c.id).toBeGreaterThan(2);
      expect(c.english.length, c.id).toBeGreaterThan(2);
      expect(c.english).not.toMatch(/ /);
      expect(c.lines.length, `${c.id} lines`).toBeGreaterThanOrEqual(1);
      for (const line of c.lines) {
        expect(line.length).toBeGreaterThanOrEqual(2);
        for (const [ra, dec] of line) {
          expect(ra).toBeGreaterThanOrEqual(0);
          expect(ra).toBeLessThan(360);
          expect(Math.abs(dec)).toBeLessThanOrEqual(90);
        }
      }
      expect(c.boundary.length, `${c.id} boundary`).toBe(c.id === 'Ser' ? 2 : 1);
      expect(c.figureStars.length, `${c.id} figureStars`).toBeGreaterThanOrEqual(2);
      expect(new Set(c.figureStars).size).toBe(c.figureStars.length);
      for (const id of [...c.figureStars, ...c.mainStars, c.brightest]) expect(catalog.starById.has(id), `${c.id} star ${id}`).toBe(true);
      for (const id of c.mainStars) expect(c.figureStars.includes(id), `${c.id} main star ${id} is a figure star`).toBe(true);
      // brightest first
      const mags = c.figureStars.map((id) => catalog.starById.get(id)!.mag);
      for (let i = 1; i < mags.length; i++) expect(mags[i]).toBeGreaterThanOrEqual(mags[i - 1]);
      expect(catalog.starById.get(c.brightest)!.con).toBe(c.id);
    }
  });

  it('has at least 3 main stars (at most 14), except the two-star figures', () => {
    const few = constellations.filter((c) => c.mainStars.length < 3).map((c) => c.id).sort();
    expect(few).toEqual(TWO_STAR_FIGURES);
    for (const c of constellations) {
      expect(c.mainStars.length, c.id).toBeGreaterThanOrEqual(2);
      expect(c.mainStars.length, c.id).toBeLessThanOrEqual(14);
    }
  });

  it('draws every line vertex on a catalog star', () => {
    const misses: string[] = [];
    for (const c of constellations) {
      const figure = c.figureStars.map((id) => catalog.starById.get(id)!);
      for (const line of c.lines) for (const [ra, dec] of line) {
        if (!figure.some((s) => separation(s, { ra, dec }) < 0.7)) misses.push(`${c.id} ${ra},${dec}`);
      }
    }
    expect(misses).toEqual([]);
  });

  it('keeps figure stars inside their own constellation (shared stars excepted)', () => {
    let total = 0;
    const foreign: string[] = [];
    for (const c of constellations) {
      let own = 0;
      for (const id of c.figureStars) {
        const s = catalog.starById.get(id)!;
        total++;
        if (s.con === c.id) own++;
        else foreign.push(`${c.id}:${s.name ?? s.desig}`);
      }
      // per constellation: a clear majority (figures that borrow stars: Ser from Oph, Car/Pup/Pyx from the old Argo Navis)
      expect(own / c.figureStars.length, `${c.id} own figure stars`).toBeGreaterThanOrEqual(0.7);
      // main stars are the constellation's own, apart from the two traditional shared stars
      for (const id of c.mainStars) {
        const s = catalog.starById.get(id)!;
        if (s.con !== c.id) expect(`${c.id}:${s.name}`).toMatch(/^(Peg:Alpheratz|Aur:Elnath)$/);
      }
    }
    // overall: at least 95 %
    expect(1 - foreign.length / total).toBeGreaterThanOrEqual(0.95);
    expect(foreign.sort()).toEqual(
      ['Aur:Elnath', 'Car:Alsephina', 'Car:γ2 Vel', 'Car:ν Pup', 'Eri:π Cet', 'Peg:Alpheratz', 'Pup:γ2 Vel', 'Pyx:Naos', 'Ser:Sabik', 'Ser:Yed Prior', 'Ser:ν Oph', 'Ser:τ Oph'].sort(),
    );
  });

  it('has closed, densified boundaries whose area matches the IAU area', () => {
    let sky = 0;
    for (const c of constellations) {
      let area = 0;
      for (const ring of c.boundary) {
        expect(ring.length).toBeGreaterThan(8);
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i];
          const b = ring[(i + 1) % ring.length];
          const step = separation({ ra: a[0], dec: a[1] }, { ra: b[0], dec: b[1] });
          expect(step, `${c.id} boundary step`).toBeLessThanOrEqual(1.05);
          expect(step, `${c.id} boundary has no repeated point`).toBeGreaterThan(0);
        }
        area += polygonAreaSqDeg(ring);
      }
      expect(Math.abs(area - c.areaSqDeg) / c.areaSqDeg, `${c.id} area ${area.toFixed(1)} vs ${c.areaSqDeg}`).toBeLessThan(0.01);
      sky += c.areaSqDeg;
    }
    expect(sky).toBeGreaterThan(41252.5);
    expect(sky).toBeLessThan(41253.5);
  });

  it('puts well-known stars inside the right boundary', () => {
    // point-in-polygon on the sphere by counting meridian crossings towards the north pole
    const inside = (ring: [number, number][], ra: number, dec: number) => {
      let crossings = 0;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        let d = ((b[0] - a[0] + 540) % 360) - 180;
        let t = ((ra - a[0] + 540) % 360) - 180;
        if (d < 0) { t = -t; d = -d; }
        if (d === 0 || t < 0 || t >= d) continue;
        if (a[1] + ((b[1] - a[1]) * t) / d > dec) crossings++;
      }
      // a ring that winds once around the north pole (Ursa Minor) contains the pole itself, which flips the parity
      const winding = ring.reduce((a, p, i) => a + (((ring[(i + 1) % ring.length][0] - p[0] + 540) % 360) - 180), 0);
      const aroundNorthPole = Math.abs(winding) > 180 && ring[0][1] > 0;
      return (crossings % 2 === 1) !== aroundNorthPole;
    };
    for (const [name, con] of [['Betelgeuse', 'Ori'], ['Vega', 'Lyr'], ['Antares', 'Sco'], ['Unukalhai', 'Ser'], ['Alya', 'Ser'], ['Acrux', 'Cru'], ['Dubhe', 'UMa'], ['Fomalhaut', 'PsA'], ['Polaris', 'UMi'], ['Kochab', 'UMi'], ['Errai', 'Cep']] as const) {
      const s = catalog.resolve(`star:${name}`)!.star!;
      const hits = constellations.filter((c) => c.boundary.some((r) => inside(r, s.ra, s.dec))).map((c) => c.id);
      expect(hits, name).toEqual([con]);
    }
  });

  it('classifies season, hemisphere and zodiac by the documented rules', () => {
    const by = Object.fromEntries(constellations.map((c) => [c.id, c]));
    for (const c of constellations) {
      expect(c.season).toBe(seasonOf(c.ra, c.dec));
      expect(c.hemisphere).toBe(c.dec >= 0 ? 'N' : 'S');
    }
    expect(by.Ori.season).toBe('winter');
    expect(by.Leo.season).toBe('spring');
    expect(by.Cyg.season).toBe('summer');
    expect(by.Peg.season).toBe('autumn');
    expect(by.UMi.season).toBe('north-circumpolar');
    expect(by.Cru.season).toBe('far-south');
    expect(by.Ser.season).toBe('summer');
    expect(constellations.filter((c) => c.zodiac).map((c) => c.id).sort()).toEqual(['Aqr', 'Ari', 'Cap', 'Cnc', 'Gem', 'Leo', 'Lib', 'Psc', 'Sco', 'Sgr', 'Tau', 'Vir']);
    expect(by.Ori).toMatchObject({ name: 'Orion', genitive: 'Orionis', english: 'the Hunter', areaSqDeg: 594.12 });
    expect(by.Ser).toMatchObject({ name: 'Serpens', genitive: 'Serpentis' });
    expect(catalog.starById.get(by.Ori.brightest)!.name).toBe('Rigel');
    expect(catalog.starById.get(by.UMi.brightest)!.name).toBe('Polaris');
  });
});

describe('dsos.json', () => {
  it('has a sensible number of objects with unique ids, sorted by magnitude (unknown last)', () => {
    expect(dsos.length).toBeGreaterThanOrEqual(500);
    expect(dsos.length).toBeLessThanOrEqual(800);
    expect(new Set(dsos.map((d) => d.id)).size).toBe(dsos.length);
    let seenUnknown = false;
    let last = -99;
    for (const d of dsos) {
      if (d.mag === undefined) { seenUnknown = true; continue; }
      expect(seenUnknown, `${d.id} comes after an object without magnitude`).toBe(false);
      expect(d.mag).toBeGreaterThanOrEqual(last);
      last = d.mag;
    }
  });

  it('has valid fields on every object', () => {
    const types = new Set(['galaxy', 'open-cluster', 'globular-cluster', 'emission-nebula', 'reflection-nebula', 'planetary-nebula', 'supernova-remnant', 'dark-nebula', 'nebula', 'cluster-with-nebula', 'star-cloud', 'double-star', 'asterism', 'other']);
    for (const d of dsos) {
      expect(d.id).toMatch(/^[A-Za-z0-9-]+$/);
      expect(types.has(d.type), `${d.id} type ${d.type}`).toBe(true);
      expect(IAU88_SET.has(d.con), `${d.id} con ${d.con}`).toBe(true);
      expect(d.ra).toBeGreaterThanOrEqual(0);
      expect(d.ra).toBeLessThan(360);
      expect(Math.abs(d.dec)).toBeLessThanOrEqual(90);
      expect(Array.isArray(d.aka)).toBe(true);
      expect(d.equip).toBe(equipmentFor(d));
      if (d.sizeArcmin) expect(d.sizeArcmin[0]).toBeGreaterThanOrEqual(d.sizeArcmin[1]);
      if (d.distLy !== undefined) expect(d.distLy).toBeGreaterThan(50);
      if (d.typeDetail) expect(d.type).toBe('galaxy');
      for (const [k, v] of Object.entries(d)) expect(v === null || v === '', `${d.id}.${k}`).toBe(false);
      // non-Messier, non-Caldwell objects are in because they are bright or famous
      if (!d.messier && !d.caldwell && d.mag !== undefined && d.mag > 10) expect(['IC434', 'NGC1365', 'NGC281']).toContain(d.id);
    }
  });

  it('contains every Messier and Caldwell object exactly once, each with a distance', () => {
    for (let n = 1; n <= 110; n++) {
      const hits = dsos.filter((d) => d.messier === n);
      expect(hits.length, `M${n}`).toBe(1);
      expect(hits[0].id).toBe(`M${n}`);
      expect(hits[0].distLy, `M${n} distance`).toBeGreaterThan(0);
      expect(catalog.resolve(`dso:M${n}`)?.dso?.messier, `dso:M${n}`).toBe(n);
    }
    for (let n = 1; n <= 109; n++) {
      const hits = dsos.filter((d) => d.caldwell === n);
      expect(hits.length, `C${n}`).toBe(1);
      expect(hits[0].distLy, `C${n} distance`).toBeGreaterThan(0);
      expect(catalog.resolve(`dso:C${n}`)?.dso?.caldwell, `dso:C${n}`).toBe(n);
    }
  });

  it('handles the awkward Messier objects', () => {
    const m = (n: number) => catalog.resolve(`dso:M${n}`)!.dso!;
    expect(m(40)).toMatchObject({ type: 'double-star', con: 'UMa' });
    expect(m(45)).toMatchObject({ type: 'open-cluster', name: 'Pleiades', equip: 'naked-eye' });
    expect(m(24)).toMatchObject({ type: 'star-cloud', aka: ['IC 4715'] });
    expect(m(73)).toMatchObject({ type: 'asterism', aka: ['NGC 6994'] });
    expect(m(102).aka).toContain('NGC 5866');
    expect(m(110).aka).toContain('NGC 205');
    expect(m(101).aka).toContain('NGC 5457');
    expect(m(1)).toMatchObject({ type: 'supernova-remnant', name: 'Crab Nebula' });
    expect(m(57)).toMatchObject({ type: 'planetary-nebula', name: 'Ring Nebula' });
    expect(m(13)).toMatchObject({ type: 'globular-cluster', con: 'Her' });
    expect(m(16)).toMatchObject({ con: 'Ser', name: 'Eagle Nebula' });
    expect(m(31)).toMatchObject({ type: 'galaxy', name: 'Andromeda Galaxy', equip: 'naked-eye', typeDetail: 'Sb' });
  });

  it('has the right positions (J2000)', () => {
    near('dso:M31', 10.685, 41.269, 0.2);
    near('dso:M42', 83.82, -5.39, 0.2);
    near('dso:M13', 250.42, 36.46, 0.2);
    near('dso:M45', 56.75, 24.12, 0.2);
    near('dso:M1', 83.633, 22.014, 0.05);
    near('dso:LMC', 80.9, -69.75, 0.3);
    near('dso:NGC5139', 201.697, -47.48, 0.05);
  });

  it('converts list distances from thousands of light-years correctly', () => {
    const dist = (ref: string) => catalog.resolve(ref)!.dso!.distLy!;
    expect(dist('dso:M31')).toBeGreaterThan(2.4e6);
    expect(dist('dso:M31')).toBeLessThan(2.7e6);
    expect(dist('dso:M42')).toBeGreaterThan(1300);
    expect(dist('dso:M42')).toBeLessThan(1400);
    expect(dist('dso:M13')).toBeGreaterThanOrEqual(22000);
    expect(dist('dso:M13')).toBeLessThanOrEqual(25000);
    expect(dist('dso:M45')).toBeGreaterThan(400);
    expect(dist('dso:M45')).toBeLessThan(460);
    expect(dist('dso:M87')).toBeGreaterThan(5e7);
    expect(dist('dso:C41')).toBeGreaterThan(140); // Hyades
    expect(dist('dso:C41')).toBeLessThan(160);
    expect(dist('dso:C80')).toBeGreaterThan(15000); // Omega Centauri
    expect(dist('dso:C80')).toBeLessThan(18500);
  });

  it('parses the Wikipedia list tables as expected', () => {
    const messier = parseMessierTable(
      '{|\n|-\n! scope="row" | [[Andromeda Galaxy|M31]]{{wbr}}<ref>x</ref>\n| NGC 224\n| \'\'Andromeda Galaxy\'\'\n| [[File:x.jpg|frameless]]\n| {{dsv|GS}} | [[Spiral galaxy]]\n| {{dsv|2540}} |2,430–2,650\n| [[Andromeda (constellation)|Andromeda]]\n| 3.4\n| 3.17° × 1°\n| {{RA|00|42|44.3}}\n| {{DEC|+41|16|09}}\n|-\n! scope="row" | [[Messier 13|M13]]{{wbr}}\n| NGC 6205\n| {{sdash|sort=z}}\n| [[File:y.jpg|frameless]]\n| {{dsv|CG}} | [[Globular cluster]]\n| 22.2\n| [[Hercules (constellation)|Hercules]]\n| 5.8\n| 20′\n| {{RA|16|41|41.2}}\n| {{DEC|+36|27|35.5}}\n|}',
    );
    expect(messier.get(31)).toMatchObject({ name: 'Andromeda Galaxy', distKly: 2540, mag: 3.4, desigs: ['NGC 224'], type: 'Spiral galaxy' });
    expect(messier.get(13)).toMatchObject({ distKly: 22.2, mag: 5.8, desigs: ['NGC 6205'] });
    expect(messier.get(13)!.name).toBeUndefined();
    const caldwell = parseCaldwellTable(
      '|- style="background:#ffffcc;"\n| {{hs|003}}C3\n| [[NGC 4236]]\n| &nbsp;\n| style="text-align:center;"| [[Image:x.jpg|60px]]\n| [[Barred Spiral Galaxy]]\n| 7,000\n| [[Draco (constellation)|Draco]]\n| 9.7\n|- style="background:#eeeeff;"\n| {{hs|089}}C89\n| [[NGC 6087]]{{efn|C89 was mistakenly written as [[NGC 6067]] in the original.}}\n| \'\'[[NGC 6087|S Normae Cluster]]\'\'\n| style="text-align:center;"| [[File:y.jpg|60px]]\n| [[Open cluster|Open Cluster]]\n| 3.3\n| [[Norma (constellation)|Norma]]\n| 5.4\n|}',
    );
    expect(caldwell.get(3)).toMatchObject({ desigs: ['NGC 4236'], distKly: 7000, mag: 9.7 });
    expect(caldwell.get(3)!.name).toBeUndefined();
    expect(caldwell.get(89)).toMatchObject({ desigs: ['NGC 6087'], name: 'S Normae Cluster', distKly: 3.3, mag: 5.4 });
  });

  it('includes the famous objects that are neither Messier nor bright in the catalogue', () => {
    const expected: [string, string][] = [
      ['LMC', 'Large Magellanic Cloud'], ['SMC', 'Small Magellanic Cloud'], ['Mel25', 'Hyades'], ['C99', 'Coalsack Nebula'], ['B33', 'Horsehead Nebula'],
      ['IC434', ''], ['NGC869', 'h Persei'], ['NGC884', 'Chi Persei'], ['C14', 'Double Cluster'], ['NGC7000', 'North America Nebula'],
      ['NGC6960', 'Western Veil Nebula'], ['NGC6992', 'Eastern Veil Nebula'], ['NGC2237', 'Rosette Nebula'], ['NGC2244', ''], ['NGC7293', 'Helix Nebula'],
      ['NGC1499', 'California Nebula'], ['IC1805', ''], ['IC1848', ''], ['NGC2024', 'Flame Nebula'], ['Cr399', 'Coathanger'], ['NGC3372', 'Carina Nebula'],
      ['NGC2070', 'Tarantula Nebula'], ['NGC5139', 'Omega Centauri'], ['NGC104', '47 Tucanae'], ['NGC4755', 'Jewel Box'],
    ];
    for (const [id, name] of expected) {
      const d = catalog.dsoById.get(id);
      expect(d, id).toBeDefined();
      if (name) {
        expect(d!.name, id).toBe(name);
        expect(catalog.resolve(`dso:${name}`)?.dso?.id, `dso:${name}`).toBe(id);
      }
    }
    for (const id of ['LMC', 'SMC', 'Mel25', 'C99']) expect(catalog.dsoById.get(id)!.equip, id).toBe('naked-eye');
    expect(catalog.dsoById.get('B33')!.equip).toBe('telescope');
    expect(catalog.resolve('dso:Cr 399')?.dso?.id).toBe('Cr399');
    expect(catalog.resolve('dso:Mel 25')?.dso?.id).toBe('Mel25');
    expect(catalog.resolve('dso:NGC 292')?.dso?.id).toBe('SMC');
  });

  it('applies the equipment rule', () => {
    expect(equipmentFor({ id: 'X', mag: 4.6, type: 'open-cluster' })).toBe('naked-eye');
    expect(equipmentFor({ id: 'X', mag: 4.61, type: 'open-cluster' })).toBe('binoculars');
    expect(equipmentFor({ id: 'X', mag: 7.6, type: 'galaxy' })).toBe('binoculars');
    expect(equipmentFor({ id: 'X', mag: 10, type: 'galaxy' })).toBe('small-telescope');
    expect(equipmentFor({ id: 'X', mag: 10.1, type: 'galaxy' })).toBe('telescope');
    expect(equipmentFor({ id: 'X', type: 'dark-nebula' })).toBe('telescope');
    expect(equipmentFor({ id: 'C99', type: 'dark-nebula' })).toBe('naked-eye');
  });
});

describe('milkyway.json', () => {
  it('has five levels, outermost first', () => {
    expect(milkyWay.levels.map((l) => l.level)).toEqual([1, 2, 3, 4, 5]);
    const extent = (l: MilkyWay['levels'][number]) => l.polygons.reduce((a, p) => a + p.length, 0);
    expect(extent(milkyWay.levels[0])).toBeGreaterThan(extent(milkyWay.levels[4]));
    for (const l of milkyWay.levels) {
      expect(l.polygons.length).toBeGreaterThan(0);
      for (const poly of l.polygons) {
        expect(poly.length).toBeGreaterThanOrEqual(4);
        for (const [ra, dec] of poly) {
          expect(ra).toBeGreaterThanOrEqual(0);
          expect(ra).toBeLessThanOrEqual(360);
          expect(Math.abs(dec)).toBeLessThanOrEqual(90);
        }
      }
    }
  });

  it('covers the galactic centre at every level and never the galactic poles', () => {
    // The brightest level sits in Sagittarius/Scutum; no outline should come within 15° of a galactic pole.
    const ngp = { ra: 192.86, dec: 27.13 };
    const sgp = { ra: 12.86, dec: -27.13 };
    for (const l of milkyWay.levels) for (const poly of l.polygons) for (const [ra, dec] of poly) {
      expect(separation({ ra, dec }, ngp)).toBeGreaterThan(15);
      expect(separation({ ra, dec }, sgp)).toBeGreaterThan(15);
    }
    const centre = { ra: 266.4, dec: -29.0 };
    const closest = Math.min(...milkyWay.levels[4].polygons.flat().map(([ra, dec]) => separation({ ra, dec }, centre)));
    expect(closest).toBeLessThan(25);
  });
});

describe('meta.json', () => {
  it('records counts and sources', () => {
    expect(meta.counts.stars).toBe(stars.length);
    expect(meta.counts.starsFaint).toBe(faint.ra.length);
    expect(meta.counts.constellations).toBe(88);
    expect(meta.counts.dsos).toBe(dsos.length);
    expect(Number.isNaN(Date.parse(meta.builtAt))).toBe(false);
    expect(meta.sources.length).toBeGreaterThanOrEqual(4);
    for (const s of meta.sources) {
      expect(s.name.length).toBeGreaterThan(3);
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.licence).toMatch(/CC BY-SA 4\.0|BSD-3-Clause|MIT/);
    }
  });
});

describe('catalog.resolve with the generated data', () => {
  it('resolves the reference forms used across the app', () => {
    const refs = ['star:Betelgeuse', 'star:α Ori', 'star:alpha Ori', 'star:58 Ori', 'star:HIP27989', 'dso:M42', 'dso:NGC869', 'dso:C14', 'dso:NGC 7000', 'con:Ori', 'con:Ser', 'body:Mars', 'point:ncp'];
    for (const ref of refs) expect(catalog.resolve(ref, when), ref).not.toBeNull();
    const bet = catalog.resolve('star:Betelgeuse')!;
    for (const ref of ['star:α Ori', 'star:alpha Ori', 'star:58 Ori', 'star:HIP27989', `star:${bet.star!.id}`]) expect(catalog.resolve(ref)!.ref, ref).toBe(bet.ref);
    expect(catalog.resolve('dso:M42')!.dso!.aka).toContain('NGC 1976');
    expect(catalog.resolve('dso:NGC1976')!.ref).toBe('dso:M42');
    expect(catalog.resolve('dso:NGC869')!.ref).toBe('dso:NGC869');
    expect(catalog.resolve('dso:C14')!.name).toBe('Double Cluster');
    expect(catalog.resolve('dso:NGC 7000')!.ref).toBe('dso:NGC7000');
    expect(catalog.resolve('dso:C20')!.ref).toBe('dso:NGC7000');
    expect(catalog.resolve('con:Ser')!.name).toBe('Serpens');
    expect(catalog.resolve('point:ncp')!.dec).toBe(90);
  });

  it('resolves all well-known proper names', () => {
    const firstMagnitude = ['Sirius', 'Canopus', 'Rigil Kentaurus', 'Arcturus', 'Vega', 'Capella', 'Rigel', 'Procyon', 'Achernar', 'Betelgeuse', 'Hadar', 'Altair', 'Acrux', 'Aldebaran', 'Antares', 'Spica', 'Pollux', 'Fomalhaut', 'Deneb', 'Mimosa', 'Regulus'];
    const others = ['Polaris', 'Mizar', 'Alcor', 'Albireo', 'Algol', 'Mira', 'Castor', 'Pollux', 'Dubhe', 'Merak', 'Alkaid', 'Alnitak', 'Alnilam', 'Mintaka', 'Bellatrix', 'Saiph', 'Denebola', 'Alphecca', 'Rasalhague', 'Sadr', 'Thuban', 'Kochab', 'Mirfak', 'Alpheratz', 'Scheat', 'Markab', 'Algenib', 'Hamal', 'Diphda', 'Shaula', 'Nunki', 'Kaus Australis', 'Alphard', 'Regulus', 'Spica', 'Arcturus', 'Antares', 'Fomalhaut', 'Achernar', 'Canopus', 'Acrux', 'Mimosa', 'Gacrux', 'Hadar', 'Rigil Kentaurus'];
    expect(firstMagnitude.length).toBe(21);
    const missing = [...firstMagnitude, ...others].filter((n) => catalog.resolve(`star:${n}`)?.star?.name !== n);
    expect(missing).toEqual([]);
    for (const n of firstMagnitude) expect(catalog.resolve(`star:${n}`)!.star!.mag, n).toBeLessThan(1.5);
    // a few classic Bayer / Flamsteed designations
    const pairs: [string, string][] = [['α Lyr', 'Vega'], ['beta Ori', 'Rigel'], ['alpha UMi', 'Polaris'], ['ζ UMa', 'Mizar'], ['80 UMa', 'Alcor'], ['omicron Cet', 'Mira'], ['alpha1 Cen', 'Rigil Kentaurus'], ['β Per', 'Algol'], ['ε Ori', 'Alnilam']];
    for (const [desig, name] of pairs) expect(catalog.resolve(`star:${desig}`)?.star?.name, desig).toBe(name);
  });

  it('finds things through search', () => {
    expect(catalog.search('orion nebula')[0].ref).toBe('dso:M42');
    expect(catalog.search('M31')[0].ref).toBe('dso:M31');
    expect(catalog.search('Vega')[0].name).toBe('Vega');
    expect(catalog.search('the hunter')[0].ref).toBe('con:Ori');
  });
});

describe('file sizes', () => {
  it('stay within budget', () => {
    const report: Record<string, string> = {};
    for (const f of ['stars.json', 'stars-faint.json', 'constellations.json', 'dsos.json', 'milkyway.json', 'meta.json']) {
      const buf = raw(f);
      report[f] = `${(buf.length / 1024).toFixed(0)} kB raw, ${(gzipSync(buf).length / 1024).toFixed(0)} kB gzip`;
    }
    console.log('public/data sizes:', report);
    expect(raw('stars.json').length).toBeLessThan(2_000_000);
    expect(raw('stars-faint.json').length).toBeLessThan(1_000_000);
    expect(raw('constellations.json').length).toBeLessThan(500_000);
    expect(raw('dsos.json').length).toBeLessThan(300_000);
    expect(raw('milkyway.json').length).toBeLessThan(300_000);
  });
});
