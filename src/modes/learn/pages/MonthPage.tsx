import * as Astronomy from 'astronomy-engine';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BRIGHT_STAR_MAG, NAKED_EYE_PLANETS, angularSeparation, PLANET_IDS, constellationPoints, makeAltAz, meanDirection, nightWindow, visibilityOn } from '@/astro';
import { asterismById, monthlyGuides } from '@/content';
import { MONTH_NAMES, formatDate, formatTime, zonedParts, zonedToUtc } from '@/lib/time';
import { Chip, EquipChip, Loading, Prose, RichText } from '@/ui';
import type { Highlight, SkyController } from '@/types';
import { Crumbs, Empty, LocationLine, Page, Section, Split } from '../components/common';
import { SkyStage } from '../components/SkyStage';
import { showInSky, useLearnEnv, type LearnEnv } from '../hooks';
import { midMonthEvening } from '../logic/place';
import { makeScene } from '../logic/scene';
import { CLASS_LABEL, aroundTime, heightWords } from '../logic/tonight';
import { routes } from '@/lib/routes';

export default function MonthPage() {
  const { m } = useParams();
  const env = useLearnEnv();
  const month = Number(m);
  if (!env) return <Loading />;
  const nowParts = zonedParts(env.now, env.observer.tz);
  if (!m)
    return (
      <Page>
        <header className="ln-head">
          <h1>Monthly sky guides</h1>
          <p className="ln-lede">A guided tour of each month's evening sky, with what is well placed from where you are.</p>
          <LocationLine />
        </header>
        <ul className="ln-month-grid">
          {MONTH_NAMES.map((name, i) => {
            const g = monthlyGuides.find((x) => x.month === i + 1);
            return (
              <li key={name}>
                <Link to={routes.month(i + 1)} className={`card ln-month-card${i + 1 === nowParts.month ? ' is-now' : ''}`}>
                  <div className="ln-unit-top">
                    <strong className="ln-unit-title">{name}</strong>
                    {i + 1 === nowParts.month && <Chip tone="amber">This month</Chip>}
                  </div>
                  <span className="dim ln-small">{g ? g.title : 'Live sky for this month'}</span>
                  {g && <span className="faint ln-small">{g.featured.map((c) => env.catalog.conById.get(c)?.name ?? c).join(' · ')}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </Page>
    );
  if (!(month >= 1 && month <= 12))
    return (
      <Page>
        <Empty>Months run from 1 to 12.</Empty>
        <Link to={routes.month()}>All months</Link>
      </Page>
    );
  return <MonthGuide key={month} month={month} year={nowParts.year} env={env} />;
}

function MonthGuide({ month, year, env }: { month: number; year: number; env: LearnEnv }) {
  const [ctl, setCtl] = useState<SkyController | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const tz = env.observer.tz;
  const guide = monthlyGuides.find((g) => g.month === month);

  const live = useMemo(() => {
    const noon = zonedToUtc(year, month, 15, 12, 0, tz);
    const night = nightWindow(noon, env.observer);
    const nine = midMonthEvening(year, month, tz);
    // 9 pm, or the end of twilight when the sky is not yet dark then (midsummer)
    const time = night.nauticalDusk && night.nauticalDusk > nine ? night.nauticalDusk : nine;
    const altAz = makeAltAz(time, env.observer);
    const cons = env.catalog.constellations
      .map((c) => {
        const pts = constellationPoints(c, env.catalog);
        const mid = meanDirection(pts);
        const up = pts.filter((p) => altAz(p.ra, p.dec).alt >= 15).length / pts.length;
        return { c, ...altAz(mid.ra, mid.dec), up };
      })
      .filter((x) => x.up >= 0.8 && x.alt >= 25)
      .sort((a, b) => b.alt - a.alt);
    const stars = env.catalog.stars
      .filter((s) => s.mag <= BRIGHT_STAR_MAG)
      .map((s) => ({ s, ...altAz(s.ra, s.dec) }))
      .filter((x) => x.alt >= 10)
      .sort((a, b) => a.s.mag - b.s.mag)
      // a close companion listed separately in the catalog (Capella's) is the same point of light to the eye
      .filter((x, i, all) => !all.slice(0, i).some((y) => angularSeparation(x.s, y.s) < 0.1));
    const planets = PLANET_IDS.map((id) => ({ id, v: visibilityOn(id, noon, env.observer) }));
    const start = zonedToUtc(year, month, 1, 0, 0, tz);
    const end = zonedToUtc(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1, 0, 0, tz);
    const phases: { name: string; date: Date }[] = [];
    for (const [lon, name] of [[0, 'New Moon'], [180, 'Full Moon']] as const) {
      let t = Astronomy.SearchMoonPhase(lon, start, 35);
      while (t && t.date < end) {
        phases.push({ name, date: t.date });
        t = Astronomy.SearchMoonPhase(lon, new Date(t.date.getTime() + 5 * 86400e3), 35);
      }
    }
    phases.sort((a, b) => a.date.getTime() - b.date.getTime());
    return { night, time, cons, stars, planets, phases };
  }, [env, month, year, tz]);

  // The written guides are for mid-northern skies; elsewhere the live sections lead and we face the equator.
  const north = env.observer.lat >= 15;
  const faceAz = env.observer.lat >= 0 ? 180 : 0;
  const scene = useMemo(() => {
    const hl: Highlight[] = (north && guide?.featured ? guide.featured : live.cons.slice(0, 5).map((x) => x.c.id)).map((id) => ({ type: 'constellation', id, lines: true, label: true }));
    return makeScene({ time: live.time, az: faceAz, alt: 42, fov: 125, highlights: hl, layers: { constellationNames: false } }, env);
  }, [env, guide, live, north, faceAz]);

  const onTarget = (ref: string) => setNote(showInSky(ctl, env.catalog, ref));
  const fmt = (d: Date | null) => formatTime(d, tz);
  const when = aroundTime(live.time, tz);
  const signpost = guide?.signpost ? asterismById.get(guide.signpost) : undefined;
  const prev = month === 1 ? 12 : month - 1;
  const next = month === 12 ? 1 : month + 1;
  return (
    <Page wide>
      <Crumbs items={[['Monthly guides', routes.month()], [MONTH_NAMES[month - 1]]]} />
      <header className="ln-head">
        <h1>{guide?.title ?? `The sky in ${MONTH_NAMES[month - 1]}`}</h1>
        <LocationLine prefix={`${MONTH_NAMES[month - 1]} ${year}, for`} />
      </header>
      <Split
        sky={
          <SkyStage scene={scene} onController={setCtl} note={note} onReset={() => setNote(null)}>
            <p className="dim ln-small">Looking {faceAz === 180 ? 'south' : 'north'} on the 15th, {when}. {north && guide ? 'The featured constellations are outlined.' : 'The highest constellations are outlined.'}</p>
          </SkyStage>
        }
      >
        {!north && guide?.southernNote && <p className="ln-lede">{guide.southernNote}</p>}
        {north && guide ? <Prose paragraphs={guide.intro} onTarget={onTarget} /> : !guide ? <Empty>The written tour for {MONTH_NAMES[month - 1]} is not available yet. Everything below is worked out live for your location.</Empty> : <p className="dim">Everything below is worked out for {env.observer.name}. The written tour further down describes the view from mid-northern latitudes.</p>}
        {north && signpost && (
          <p>
            Start from the{' '}
            <Link to={routes.asterism(signpost.id)}>
              {signpost.name}
            </Link>
            , this month's signpost.
          </p>
        )}

        <Section title="Best viewing times">
          <ul className="ln-plain ln-facts">
            <li>
              Mid-month the Sun sets at {fmt(live.night.sunset)} and the sky is dark from {fmt(live.night.nauticalDusk)} to {fmt(live.night.nauticalDawn)}.
            </li>
            {live.phases.map((p) => (
              <li key={p.name + p.date.getTime()}>
                <strong>{p.name}</strong> on {formatDate(p.date, tz, { weekday: 'short', month: 'short', day: 'numeric' })}
                <span className="dim">{p.name === 'New Moon' ? ' · the darkest nights are the week around this date' : ' · moonlight hides faint stars for a few nights either side'}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Planets this month">
          <ul className="ln-tn-list">
            {live.planets.map(({ id, v }) => (
              <li key={id}>
                <button type="button" className="ln-tn-row" onClick={() => onTarget(`body:${id}`)}>
                  <strong>{id}</strong>
                  <span className="dim">
                    {v.cls === 'not-visible' || !v.bestTime ? 'lost in the Sun’s glare or below the horizon at night' : `${heightWords(v.bestAlt, v.bestAz)} ${aroundTime(v.bestTime, tz)}`}
                    {!NAKED_EYE_PLANETS.includes(id) && v.cls !== 'not-visible' ? ' · needs binoculars or a telescope' : ''}
                  </span>
                  <Chip tone={v.cls === 'not-visible' ? undefined : 'good'}>{CLASS_LABEL[v.cls]}</Chip>
                </button>
              </li>
            ))}
          </ul>
          <p className="dim ln-small">Planet positions are for {year}; they change from year to year.</p>
        </Section>

        <Section title={`Constellations well placed ${when}`}>
          {!live.cons.length && <p className="dim">Nothing is high in a dark sky at this hour.</p>}
          <ul className="ln-tn-list">
            {live.cons.map((x) => (
              <li key={x.c.id}>
                <div className="ln-tn-row">
                  <Link to={routes.constellation(x.c.id)}>
                    <strong>{x.c.name}</strong>
                  </Link>
                  <span className="dim">{heightWords(x.alt, x.az)}</span>
                  <button type="button" className="sky-link ln-small" onClick={() => onTarget(`con:${x.c.id}`)}>
                    Show
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Bright stars">
          {guide && guide.stars.length > 0 && (
            <p>
              Stars to learn this month:{' '}
              {guide.stars.map((r, i) => (
                <span key={r}>
                  {i > 0 && ', '}
                  <button type="button" className="sky-link" onClick={() => onTarget(r)}>
                    {env.catalog.resolve(r)?.name ?? r}
                  </button>
                </span>
              ))}
              .
            </p>
          )}
          <p className="dim ln-small">The brightest stars above the horizon {when}:</p>
          <ul className="ln-tn-list">
            {live.stars.map((x) => (
              <li key={x.s.id}>
                <button type="button" className="ln-tn-row" onClick={() => onTarget(`star:${x.s.id}`)}>
                  <strong>{x.s.name ?? x.s.desig}</strong>
                  <span className="dim">{heightWords(x.alt, x.az)}</span>
                  <span className="faint ln-small">in {env.catalog.conById.get(x.s.con)?.name ?? x.s.con}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>

        {guide && guide.objects.length > 0 && (
          <Section title="Deep-sky picks">
            <ul className="ln-plain ln-facts">
              {guide.objects.map((o) => (
                <li key={o.ref}>
                  <Link to={routes.object(o.ref)}>
                    <strong>{env.catalog.resolve(o.ref)?.name ?? o.ref}</strong>
                  </Link>{' '}
                  <EquipChip equip={o.equip} />{' '}
                  <button type="button" className="sky-link ln-small" onClick={() => onTarget(o.ref)}>
                    Show
                  </button>
                  <br />
                  <span className="dim">
                    <RichText text={o.note} onTarget={onTarget} />
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
        {north && guide?.southernNote && (
          <Section title="South of the equator">
            <Prose paragraphs={[guide.southernNote]} onTarget={onTarget} />
          </Section>
        )}
        {!north && guide && (
          <Section title="The view from mid-northern latitudes">
            <Prose paragraphs={guide.intro} onTarget={onTarget} />
          </Section>
        )}
        <nav className="ln-prevnext">
          <Link to={routes.month(prev)}>← {MONTH_NAMES[prev - 1]}</Link>
          <Link to={routes.month(next)}>{MONTH_NAMES[next - 1]} →</Link>
        </nav>
      </Split>
    </Page>
  );
}
