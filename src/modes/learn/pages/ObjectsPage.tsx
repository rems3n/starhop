import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PLANET_IDS, visibilityOn } from '@/astro';
import { blurbRefs, lessons } from '@/content';
import { formatMag } from '@/lib/format';
import { useProgress } from '@/store/progress';
import { Chip, EquipChip, Loading, Segmented, Switch } from '@/ui';
import type { Dso, DsoType, Equipment, VisibilityClass } from '@/types';
import { Check, Empty, LocationLine, Page } from '../components/common';
import { objectHref, useLearnEnv } from '../hooks';
import { CLASS_LABEL } from '../logic/tonight';

type Tab = 'showpieces' | 'messier' | 'stars' | 'planets';
type TypeGroup = 'all' | 'cluster' | 'nebula' | 'galaxy' | 'other';
const TYPE_GROUP: Record<DsoType, TypeGroup> = {
  galaxy: 'galaxy', 'open-cluster': 'cluster', 'globular-cluster': 'cluster', 'emission-nebula': 'nebula', 'reflection-nebula': 'nebula', 'planetary-nebula': 'nebula',
  'supernova-remnant': 'nebula', 'dark-nebula': 'nebula', nebula: 'nebula', 'cluster-with-nebula': 'nebula', 'star-cloud': 'cluster', 'double-star': 'other', asterism: 'other', other: 'other',
};
const TYPE_WORD: Record<DsoType, string> = {
  galaxy: 'Galaxy', 'open-cluster': 'Open cluster', 'globular-cluster': 'Globular cluster', 'emission-nebula': 'Emission nebula', 'reflection-nebula': 'Reflection nebula', 'planetary-nebula': 'Planetary nebula',
  'supernova-remnant': 'Supernova remnant', 'dark-nebula': 'Dark nebula', nebula: 'Nebula', 'cluster-with-nebula': 'Cluster with nebula', 'star-cloud': 'Star cloud', 'double-star': 'Double star', asterism: 'Star pattern', other: 'Other',
};
const EQUIP_RANK: Record<Equipment, number> = { 'naked-eye': 0, binoculars: 1, 'small-telescope': 2, telescope: 3 };

interface Item { ref: string; title: string; sub: string; equip?: Equipment; group: TypeGroup; img?: string; vis: () => VisibilityClass }

export default function ObjectsPage() {
  const env = useLearnEnv();
  const done = useProgress((s) => s.lessonsDone);
  const [tab, setTab] = useState<Tab>('showpieces');
  const [group, setGroup] = useState<TypeGroup>('all');
  const [equip, setEquip] = useState<'any' | Equipment>('any');
  const [tonightOnly, setTonightOnly] = useState(false);

  const lists = useMemo(() => {
    if (!env) return null;
    const { catalog, observer, nightDate } = env;
    const memo = new Map<string, VisibilityClass>();
    const visOf = (ref: string, target: Parameters<typeof visibilityOn>[0]) => () => {
      let v = memo.get(ref);
      if (!v) memo.set(ref, (v = visibilityOn(target, nightDate, observer).cls));
      return v;
    };
    const conName = (id: string) => catalog.conById.get(id)?.name ?? id;
    const dsoItem = (d: Dso): Item => {
      const label = d.messier ? `M${d.messier}` : d.aka[0] ?? d.id;
      return { ref: `dso:${d.id}`, title: d.name ? `${d.name}` : label, sub: `${d.name ? `${label} · ` : ''}${TYPE_WORD[d.type]} in ${conName(d.con)}${d.mag != null ? ` · mag ${formatMag(d.mag)}` : ''}`, equip: d.equip, group: TYPE_GROUP[d.type], img: catalog.imagesFor(`dso:${d.id}`)[0]?.file, vis: visOf(`dso:${d.id}`, { ra: d.ra, dec: d.dec }) };
    };
    const written = new Set(blurbRefs.map((r) => catalog.resolve(r)?.ref).filter(Boolean));
    const showpieces = catalog.dsos
      .filter((d) => written.has(`dso:${d.id}`) || catalog.imagesFor(`dso:${d.id}`).length > 0 || (!!d.name && EQUIP_RANK[d.equip] <= 1))
      .sort((a, b) => EQUIP_RANK[a.equip] - EQUIP_RANK[b.equip] || (a.mag ?? 99) - (b.mag ?? 99))
      .map(dsoItem);
    const messier = catalog.dsos.filter((d) => d.messier).sort((a, b) => a.messier! - b.messier!).map((d) => ({ ...dsoItem(d), title: `M${d.messier}${d.name ? ` · ${d.name}` : ''}`, sub: `${TYPE_WORD[d.type]} in ${conName(d.con)}${d.mag != null ? ` · mag ${formatMag(d.mag)}` : ''}` }));
    const stars = catalog.stars.filter((s) => s.mag <= 2.0 && s.name).map((s): Item => ({ ref: `star:${s.id}`, title: s.name!, sub: `${s.desig} · ${conName(s.con)} · mag ${formatMag(s.mag)}`, equip: 'naked-eye', group: 'other', vis: visOf(`star:${s.id}`, { ra: s.ra, dec: s.dec }) }));
    const planets = (['Moon', ...PLANET_IDS] as const).map((b): Item => ({ ref: `body:${b}`, title: b, sub: b === 'Moon' ? 'Earth’s satellite' : 'Planet', equip: b === 'Uranus' || b === 'Neptune' ? 'binoculars' : 'naked-eye', group: 'other', img: catalog.imagesFor(`body:${b}`)[0]?.file, vis: visOf(`body:${b}`, b) }));
    return { showpieces, messier, stars, planets };
  }, [env]);

  if (!env || !lists) return <Loading />;
  const dsoTab = tab === 'showpieces' || tab === 'messier';
  const items = lists[tab].filter((i) => (!dsoTab || group === 'all' || i.group === group) && (equip === 'any' || !i.equip || EQUIP_RANK[i.equip] <= EQUIP_RANK[equip]) && (!tonightOnly || i.vis() !== 'not-visible'));
  const objectLessons = lessons.filter((l) => l.unit === 'objects');
  return (
    <Page>
      <header className="ln-head">
        <h1>Objects</h1>
        <p className="ln-lede">What the things in the sky are, and a catalogue of the best ones to look for.</p>
      </header>
      <section className="ln-section">
        <h3>Object lessons</h3>
        <ol className="ln-checklist">
          {objectLessons.map((l) => (
            <li key={l.id}>
              <Link to={`/learn/lesson/${l.id}`} className="ln-step">
                <Check done={!!done[l.id]} />
                <span className="grow">
                  <strong>{l.title}</strong>
                  <span className="dim ln-step-sub">{l.subtitle}</span>
                </span>
                <span className="dim ln-nowrap">{l.minutes} min</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
      <section className="ln-section">
        <h3>Catalogue</h3>
        <div className="ln-filters">
          <Segmented<Tab> label="List" value={tab} onChange={setTab} options={[{ value: 'showpieces', label: `Showpieces (${lists.showpieces.length})` }, { value: 'messier', label: `Messier list (${lists.messier.length})` }, { value: 'stars', label: 'Bright stars' }, { value: 'planets', label: 'Moon and planets' }]} />
          {dsoTab && <Segmented<TypeGroup> label="Type" value={group} onChange={setGroup} options={[{ value: 'all', label: 'All types' }, { value: 'cluster', label: 'Clusters' }, { value: 'nebula', label: 'Nebulae' }, { value: 'galaxy', label: 'Galaxies' }, { value: 'other', label: 'Other' }]} />}
          {dsoTab && <Segmented<'any' | Equipment> label="Equipment" value={equip} onChange={setEquip} options={[{ value: 'any', label: 'Any equipment' }, { value: 'naked-eye', label: 'Naked eye' }, { value: 'binoculars', label: 'Up to binoculars' }, { value: 'small-telescope', label: 'Up to a small telescope' }]} />}
          <div className="ln-events-switch">
            <Switch checked={tonightOnly} onChange={setTonightOnly} label="Visible tonight" />
          </div>
          <LocationLine />
        </div>
        {!items.length && <Empty>Nothing matches these filters.</Empty>}
        <ul className="ln-obj-grid">
          {items.map((i) => (
            <li key={i.ref}>
              <Link to={objectHref(i.ref)} className="card ln-obj-card">
                {i.img ? <img src={`${import.meta.env.BASE_URL}${i.img}`} alt="" loading="lazy" /> : <div className="ln-thumb-empty" aria-hidden />}
                <div className="grow">
                  <strong>{i.title}</strong>
                  <span className="dim ln-small">{i.sub}</span>
                  <div className="ln-chips">
                    {i.equip && <EquipChip equip={i.equip} />}
                    {tonightOnly && <Chip tone="good">{CLASS_LABEL[i.vis()]}</Chip>}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Page>
  );
}
