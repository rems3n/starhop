import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { tonight } from '@/astro';
import { constellationContentIds } from '@/content';
import { constellationMastery, useProgress } from '@/store/progress';
import { Chip, Loading, Meter, Segmented } from '@/ui';
import { ANCHORS, type Season } from '@/types';
import { ConFigure, Empty, LocationLine, Page } from '../components/common';
import { useLearnEnv } from '../hooks';
import { SEASON_ORDER } from '../logic/calendar';
import { CLASS_LABEL } from '../logic/tonight';

const SEASON_SHORT: Record<Season, string> = { winter: 'Winter', spring: 'Spring', summer: 'Summer', autumn: 'Autumn', 'north-circumpolar': 'Northern', 'far-south': 'Far south' };
type Filter = 'all' | 'anchors' | 'tonight' | 'N' | 'S' | Season;

export default function ConstellationIndex() {
  const env = useLearnEnv();
  const items = useProgress((s) => s.items);
  const seen = useProgress((s) => s.seen);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const up = useMemo(() => {
    if (!env) return new Map<string, string>();
    return new Map(tonight(env.nightDate, env.observer, env.catalog).constellations.map((c) => [c.ref.slice(4), c.visibility.cls]));
  }, [env]);
  if (!env) return <Loading />;
  const anchors = ANCHORS as readonly string[];
  const written = new Set(constellationContentIds);
  const needle = q.trim().toLowerCase();
  const list = [...env.catalog.constellations]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.english.toLowerCase().includes(needle) || c.id.toLowerCase() === needle)
    .filter((c) => {
      switch (filter) {
        case 'all': return true;
        case 'anchors': return anchors.includes(c.id);
        case 'tonight': return up.get(c.id) !== 'not-visible';
        case 'N':
        case 'S': return c.hemisphere === filter;
        default: return c.season === filter;
      }
    });
  return (
    <Page>
      <header className="ln-head">
        <h1>The 88 constellations</h1>
        <p className="ln-lede">Every constellation in the sky: how to find it, its stars and objects, and the stories told about it.</p>
        <div className="ln-filters">
          <input className="input ln-search" type="search" placeholder="Search by name or meaning, e.g. “hunter”" aria-label="Search constellations" value={q} onChange={(e) => setQ(e.target.value)} />
          <Segmented<Filter>
            label="Filter constellations"
            value={filter}
            onChange={setFilter}
            options={[{ value: 'all', label: 'All' }, { value: 'anchors', label: 'Anchors' }, { value: 'tonight', label: 'Up tonight' }, ...SEASON_ORDER.map((s) => ({ value: s as Filter, label: SEASON_SHORT[s] })), { value: 'N', label: 'Northern half' }, { value: 'S', label: 'Southern half' }]}
          />
        </div>
        <LocationLine prefix="“Up tonight” is for" />
      </header>
      {!list.length && <Empty>No constellation matches that.</Empty>}
      <ul className="ln-con-grid">
        {list.map((c) => {
          const m = constellationMastery(items, c.id);
          const vals = Object.values(m).filter((x): x is number => x != null);
          const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
          const cls = up.get(c.id) ?? 'not-visible';
          return (
            <li key={c.id}>
              <Link to={`/learn/constellation/${c.id}`} className="card ln-con-card">
                <ConFigure con={c} size={76} />
                <div className="grow">
                  <strong className="ln-con-name">{c.name}</strong>
                  <span className="dim ln-small">{c.english}</span>
                  <div className="ln-chips">
                    {cls !== 'not-visible' ? <Chip tone="good">Tonight: {CLASS_LABEL[cls as keyof typeof CLASS_LABEL].toLowerCase()}</Chip> : <Chip>Not up tonight</Chip>}
                    {anchors.includes(c.id) && <Chip tone="amber">Anchor</Chip>}
                  </div>
                  <div className="ln-con-meter">
                    <Meter value={avg ?? 0} label={`${c.name}: mastery`} />
                    <span className="faint">{avg != null ? `${Math.round(avg * 100)}%` : seen[c.id] ? 'visited' : written.has(c.id) ? 'new' : 'basics only'}</span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
