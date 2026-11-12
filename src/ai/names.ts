/**
 * Forgiving name lookup for the assistant's instant path: "cats eye nebula", "the orion constellation",
 * "betelguese" and "north star" all find their object without a model. Pure, built from the catalogue.
 */
import asterismsJson from '@/content/asterisms.json';
import type { Catalog } from '@/data/catalog';

/** Everyday names the catalogue does not carry. */
const NICKNAMES: Record<string, string> = {
  'north star': 'star:Polaris', 'pole star': 'star:Polaris', 'dog star': 'star:Sirius', 'seven sisters': 'dso:M45',
  'evening star': 'body:Venus', 'morning star': 'body:Venus', 'red planet': 'body:Mars', 'ringed planet': 'body:Saturn',
  'southern cross': 'con:Cru', 'great bear': 'con:UMa', 'little bear': 'con:UMi', 'plough': 'asterism:big-dipper', 'plow': 'asterism:big-dipper',
  'andromeda galaxy': 'dso:M31', 'orion nebula': 'dso:M42', 'great orion nebula': 'dso:M42', 'beehive': 'dso:M44', 'pleiades': 'dso:M45',
};
const SUFFIX = /\s+(?:constellation|star|planet|asterism|object)$/;

/** Lower-case, no apostrophes or punctuation, single spaces, no leading "the". */
export function nameKey(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’`]/g, '').replace(/[^a-z0-9α-ω]+/g, ' ').trim().replace(/^the\s+/, '');
}

function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] ? prev[j - 1] : Infinity);
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

export interface NameIndex {
  /** Exact (after normalising) or, failing that, a unique near-miss spelling. Returns a target ref. */
  lookup(phrase: string): string | null;
  /** The longest run of words anywhere in the text that names an object. */
  scan(text: string): string | null;
}

export function buildNameIndex(catalog: Catalog): NameIndex {
  const map = new Map<string, string>();
  const add = (name: string | undefined, ref: string) => {
    if (!name) return;
    const k = nameKey(name);
    if (k.length >= 2 && !map.has(k)) map.set(k, ref);
  };
  for (const b of ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']) add(b, `body:${b}`);
  for (const [n, ref] of Object.entries(NICKNAMES)) if (catalog.resolve(ref)) add(n, ref);
  for (const c of catalog.constellations) {
    add(c.name, `con:${c.id}`);
    add(c.english, `con:${c.id}`);
  }
  for (const c of catalog.constellations) add(c.id, `con:${c.id}`);
  for (const a of asterismsJson as { id: string; name: string }[]) add(a.name, `asterism:${a.id}`);
  for (const s of catalog.stars) if (s.name) add(s.name, `star:${s.id}`);
  const dso = (d: Catalog['dsos'][number]) => {
    const ref = `dso:${d.id}`;
    add(d.name, ref);
    if (d.messier) { add(`m${d.messier}`, ref); add(`m ${d.messier}`, ref); add(`messier ${d.messier}`, ref); }
    if (d.caldwell) { add(`caldwell ${d.caldwell}`, ref); add(`c${d.caldwell}`, ref); }
    add(d.id, ref);
    add(d.id.replace(/^([A-Za-z]+)(\d)/, '$1 $2'), ref);
    for (const a of d.aka) add(a, ref);
  };
  for (const d of catalog.dsos) dso(d);
  for (const d of catalog.deepDsos) dso(d);
  const keys = [...map.keys()];

  const exact = (k: string): string | null => map.get(k) ?? (SUFFIX.test(k) ? map.get(k.replace(SUFFIX, '')) ?? null : null);

  function lookup(phrase: string): string | null {
    const k = nameKey(phrase);
    if (k.length < 2) return null;
    const hit = exact(k);
    if (hit) return hit;
    // near-miss spellings: only for real words, and only when one object is clearly the closest
    if (k.length < 5 || /\d/.test(k)) return null;
    const max = k.length >= 9 ? 2 : 1;
    const words = k.split(' ').length;
    let best: string | null = null;
    let bestD = max + 1;
    let tie = false;
    for (const key of keys) {
      // same number of words and same first letter: a typo, not a different phrase
      if (/\d/.test(key) || key.length < 4 || key[0] !== k[0] || key.split(' ').length !== words) continue;
      const d = editDistance(k, key, max);
      if (d < bestD) { bestD = d; best = map.get(key)!; tie = false; }
      else if (d === bestD && best && map.get(key) !== best) tie = true;
    }
    return best && !tie ? best : null;
  }

  function scan(text: string): string | null {
    const words = nameKey(text).split(' ').filter(Boolean);
    for (let len = Math.min(5, words.length); len >= 1; len--) {
      for (let i = 0; i + len <= words.length; i++) {
        const phrase = words.slice(i, i + len).join(' ');
        if (len === 1 && phrase.length < 4) continue;
        const hit = exact(phrase);
        if (hit) return hit;
      }
    }
    return null;
  }
  return { lookup, scan };
}
