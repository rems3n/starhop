import { useEffect, useMemo, useState } from 'react';
import { getBody } from '@/astro';
import { loadFaintStars, type Catalog } from '@/data/catalog';
import { BORTLE, type FaintStars, type LayerState, type Observer } from '@/types';
import { Button, Slider, Switch } from '@/ui';
import { aboutCount, countStarsUp, skyBrightness } from './skyCount';

export const LAYER_GROUPS: { title: string; items: { key: keyof LayerState; label: string }[] }[] = [
  { title: 'Constellations', items: [{ key: 'constellationLines', label: 'Lines' }, { key: 'constellationBoundaries', label: 'Boundaries' }, { key: 'constellationNames', label: 'Names' }, { key: 'constellationArt', label: 'Figures (illustrations)' }] },
  { title: 'Stars and objects', items: [{ key: 'starNames', label: 'Star names' }, { key: 'dsoMarkers', label: 'Deep-sky markers' }, { key: 'deepSky', label: 'Fainter stars and objects when zoomed in' }, { key: 'planets', label: 'Sun, Moon and planets' }, { key: 'milkyWay', label: 'Milky Way' }] },
  { title: 'Guides', items: [{ key: 'ecliptic', label: 'Ecliptic (path of the Sun)' }, { key: 'equatorialGrid', label: 'Equatorial grid' }, { key: 'azimuthalGrid', label: 'Azimuthal grid' }] },
  { title: 'Ground and air', items: [{ key: 'horizon', label: 'Horizon and compass points' }, { key: 'ground', label: 'Ground' }, { key: 'atmosphere', label: 'Atmosphere (daylight)' }] },
];

export function LayersPanel({ layers, onChange }: { layers: LayerState; onChange: (patch: Partial<LayerState>) => void }) {
  return (
    <div className="ex-layers">
      {LAYER_GROUPS.map((g) => (
        <fieldset key={g.title} className="ex-layer-group">
          <legend>{g.title}</legend>
          {g.items.map((it) => <Switch key={it.key} label={it.label} checked={layers[it.key]} onChange={(v) => onChange({ [it.key]: v })} />)}
        </fieldset>
      ))}
    </div>
  );
}

interface LightProps {
  bortle: number;
  onBortle: (n: number) => void;
  catalog: Catalog | null;
  observer: Observer;
  /** Simulated time, coarse (the count only needs refreshing every minute or so) */
  date: Date;
}

/** The value the compare button flips to: a truly dark site, or an inner city if the user is already somewhere dark. */
export function compareTarget(bortle: number): number {
  return bortle <= 3 ? 9 : 2;
}

export function LightPollutionPanel({ bortle, onBortle, catalog, observer, date }: LightProps) {
  const b = BORTLE[bortle - 1];
  const [faint, setFaint] = useState<FaintStars | null>(null);
  const [compareFrom, setCompareFrom] = useState<number | null>(null);
  useEffect(() => {
    if (b.limitingMag <= 6.5 || faint) return;
    let live = true;
    loadFaintStars().then((f) => live && f && setFaint(f), () => undefined);
    return () => { live = false; };
  }, [b.limitingMag, faint]);

  const count = useMemo(() => (catalog ? countStarsUp(catalog.stars, faint, b.limitingMag, date, observer) : null), [catalog, faint, b.limitingMag, date, observer]);
  const light = useMemo(() => skyBrightness(getBody('Sun', date, observer).alt), [date, observer]);

  const setManually = (n: number) => {
    setCompareFrom(null);
    onBortle(n);
  };
  const other = compareFrom ?? compareTarget(bortle);
  const otherIsDark = other <= 3;
  const flip = () => {
    if (compareFrom != null) {
      onBortle(compareFrom);
      setCompareFrom(null);
    } else {
      setCompareFrom(bortle);
      onBortle(other);
    }
  };

  return (
    <div className="ex-light">
      <div className="ex-light-head">
        <span className="ex-light-class">Bortle {b.n}</span>
        <span className="ex-light-label">{b.label}</span>
      </div>
      <Slider label="Light pollution, Bortle class 1 (darkest) to 9 (inner city)" min={1} max={9} value={bortle} onChange={setManually} />
      <div className="ex-light-ends" aria-hidden><span>1 · darkest</span><span>9 · inner city</span></div>
      <p className="ex-light-desc">{b.description}</p>
      <p className="ex-light-count" aria-live="polite">
        {count == null ? 'Counting stars…' : light === 'day' ? (
          <>The Sun is up, so no stars show right now. After dark, <strong>{aboutCount(count)} stars</strong> of those above the horizon would be bright enough.</>
        ) : (
          <><strong>{aboutCount(count)} stars</strong> visible right now{light === 'twilight' ? ' once twilight ends' : ''}.</>
        )}
        <span className="faint"> Faintest star: magnitude {b.limitingMag.toFixed(1)}.</span>
      </p>
      <Button size="sm" pressed={compareFrom != null} onClick={flip} title="Flip between your sky and the opposite extreme">
        {compareFrom != null ? `Back to Bortle ${compareFrom}` : `Compare: ${otherIsDark ? 'dark site' : 'city'} (Bortle ${other})`}
      </Button>
      <p className="ex-light-hint faint">The scale runs from 1, a sky with no artificial light, to 9, the middle of a big city. As a guide: a big city centre is 8–9, a suburb 5–7, a village or the countryside 3–4, and a remote dark site 1–2.</p>
    </div>
  );
}
