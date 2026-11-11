import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BODY_RADIUS_KM, altAzOf, bestMonths, currentNightDate, eveningSeason, getBody, moonPhase, riseSet, visibilityOn, whereWords, type VisTarget } from '@/astro';
import { asterismById, getBlurb, loadConstellationContent, type ConstellationContent, type ObjectBlurb } from '@/content';
import { useCatalog, type Catalog } from '@/data/catalog';
import { compass, formatAngularSize, formatDec, formatDistanceLy, formatMag, formatRa } from '@/lib/format';
import { formatDate, formatTime } from '@/lib/time';
import { useSettings } from '@/store/settings';
import { BORTLE, type BodyState, type Equipment, type Observer, type ResolvedTarget, type TargetRef } from '@/types';
import { Chip, EquipChip, RichText } from '@/ui';
import {
  BODY_KIND, DSO_KIND, VISIBILITY_WORDS, bortleSentence, dsoNeedsDarkSky, equipmentForMagnitude, equipmentSentence, fallbackAbout, fallbackHowToFind,
  figureStarsVisible, litWords, luminosityWords, magnitudeGloss, monthRanges, moonWidths, ordinal, physicalSizeWords, spectralExplanation, starKind,
} from './describe';
import { ImageGallery } from './ImageGallery';
import { asterismIdOf, observerKey, visTargetOf } from './targets';
import { VisibilityStrip } from './VisibilityStrip';
import './object.css';
import { routes } from '@/lib/routes';

export interface ObjectInfoProps {
  targetRef: TargetRef;
  observer: Observer;
  /** The instant "now" in the sky view the panel belongs to */
  date: Date;
  /** 'panel' = compact side panel in Explore; 'page' = roomy full page in Learn */
  variant?: 'panel' | 'page';
  /** "Show in sky" for links inside the panel. Default: open the sky map at that target */
  onTarget?: (ref: TargetRef) => void;
}

const AU_KM = 149597870.7;
const EARTH_DIAMETER_KM = 12756;

interface Fact { label: string; value: ReactNode; note?: ReactNode }

function Facts({ facts }: { facts: Fact[] }) {
  if (!facts.length) return null;
  return (
    <dl className="obj-facts">
      {facts.map((f) => (
        <div key={f.label} className="obj-fact">
          <dt>{f.label}</dt>
          <dd>
            <span className="obj-fact-value">{f.value}</span>
            {f.note && <span className="obj-fact-note">{f.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="obj-section">
      <h4 className="obj-h">{title}</h4>
      {children}
    </section>
  );
}

function km(n: number): string {
  const digits = n >= 1e6 ? 3 : 2;
  const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) + 1 - digits));
  return `${(Math.round(n / p) * p).toLocaleString('en-US')} km`;
}

// ───────────────────────────── When it is visible ─────────────────────────────

function WhenVisible({ t, catalog, observer, date, body }: { t: ResolvedTarget; catalog: Catalog; observer: Observer; date: Date; body: BodyState | null }) {
  const tz = observer.tz;
  const target: VisTarget = useMemo(() => visTargetOf(t, catalog), [t.ref, catalog]); // eslint-disable-line react-hooks/exhaustive-deps
  const night = currentNightDate(date, observer);
  const nightKey = `${formatDate(night, tz, { year: 'numeric', month: 'numeric', day: 'numeric' })}|${observerKey(observer)}|${t.ref}`;
  const tonight = useMemo(() => {
    const single = typeof target === 'string' ? target : 'points' in target ? { ra: t.ra, dec: t.dec } : target;
    return { vis: visibilityOn(target, night, observer), rs: riseSet(single, night, observer), months: t.body === 'Sun' ? [] : bestMonths(target, observer), season: t.body ? null : eveningSeason(target, observer) };
  }, [nightKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const now = body ?? altAzOf(t.ra, t.dec, date, observer);
  const { vis, rs, months, season } = tonight;
  const nightLabel = formatDate(night, tz, { weekday: 'short', month: 'short', day: 'numeric' });

  const nowText = now.alt >= 0
    ? `${Math.round(now.alt)}° above the horizon, ${whereWords(now.alt, now.az)} (${compass(now.az)})`
    : `below the horizon (${Math.round(-now.alt)}° down, towards the ${compass(now.az)})`;

  const isGroupTarget = typeof target !== 'string' && 'points' in target;
  const groupLabel = isGroupTarget ? <span className="dim">Its middle:</span> : null;
  let riseLine: ReactNode;
  if (rs.circumpolar) riseLine = <>Never sets from {observer.name}: it circles the pole and is above the horizon all day and night. Highest at {formatTime(rs.transit, tz)}, {Math.round(rs.transitAlt)}° up.</>;
  else if (rs.neverRises) riseLine = <>Never rises above the horizon from {observer.name}.</>;
  else riseLine = (
    <span className="obj-rise">
      {groupLabel}
      <span><em>Rises</em> {formatTime(rs.rise, tz)}</span>
      <span><em>Highest</em> {formatTime(rs.transit, tz)}{rs.transit ? `, ${Math.round(rs.transitAlt)}° up` : ''}</span>
      <span><em>Sets</em> {formatTime(rs.set, tz)}</span>
    </span>
  );

  if (t.body === 'Sun') {
    return (
      <Section title="When it is up">
        <p className="obj-p"><strong>At this moment:</strong> {nowText}.</p>
        <p className="obj-p">{riseLine}</p>
        <p className="obj-p obj-warn">Never look at the Sun directly or through binoculars or a telescope without a certified solar filter. It can blind you in an instant.</p>
      </Section>
    );
  }

  const cls = vis.cls;
  const best = vis.bestTime ? <> Best around <strong>{formatTime(vis.bestTime, tz)}</strong>, {whereWords(vis.bestAlt, vis.bestAz)}.</> : null;
  // eveningSeason names the observer's own season; say it both ways so it reads right in either hemisphere.
  const otherSeason = { winter: 'summer', spring: 'autumn', summer: 'winter', autumn: 'spring' } as const;
  const seasonWords =
    season && season !== 'never'
      ? season === 'all-year'
        ? 'in the evening sky all year'
        : observer.lat >= 0
          ? `an evening sight of the northern ${season} (southern ${otherSeason[season]})`
          : `an evening sight of the southern ${season} (northern ${otherSeason[season]})`
      : null;
  return (
    <Section title="When it is visible">
      <p className="obj-p"><strong>At this moment:</strong> {nowText}.</p>
      <p className="obj-p">
        <strong>Night of {nightLabel}:</strong> {VISIBILITY_WORDS[cls].toLowerCase()}.{best}
        {cls === 'not-visible' && !rs.neverRises && ' It is too low, or only up in daylight or twilight.'}
      </p>
      <p className="obj-p">{riseLine}</p>
      <VisibilityStrip target={target} observer={observer} year={t.body ? undefined : undefined} showLegend />
      {!rs.neverRises && months.length > 0 && (
        <p className="obj-p obj-months">
          <strong>Best evening months{t.body && t.body !== 'Moon' ? ' this year' : ''}:</strong> {t.body === 'Moon' ? 'every month — its phase decides when it is up' : monthRanges(months)}
          {seasonWords && t.body == null ? ` — ${seasonWords}` : ''}.
        </p>
      )}
    </Section>
  );
}

// ───────────────────────────── What you need ─────────────────────────────

function Equipment_({ t, body, blurb, bortle, catalog }: { t: ResolvedTarget; body: BodyState | null; blurb?: ObjectBlurb; bortle: number; catalog: Catalog }) {
  let equip: Equipment = 'naked-eye';
  let darkSky = false;
  const lines: ReactNode[] = [];
  const b = BORTLE[bortle - 1];
  if (t.star) {
    equip = equipmentForMagnitude(t.star.mag);
    lines.push(bortleSentence(t.star.mag, bortle));
  } else if (t.dso) {
    equip = t.dso.equip;
    darkSky = dsoNeedsDarkSky(t.dso);
    lines.push(equipmentSentence(equip));
    if (darkSky) lines.push('Its light is spread over a large patch of sky, so the surface is very dim: any light pollution or moonlight hides it, and it is much harder than its magnitude suggests.');
    else if (bortle >= 7 && t.dso.type !== 'open-cluster' && t.dso.type !== 'double-star' && t.dso.type !== 'asterism') lines.push(`Under your current sky setting (Bortle ${b.n}) faint fuzzy objects fade first: expect to need more than the minimum, or a trip somewhere darker.`);
  } else if (t.body && body) {
    if (t.body === 'Sun') return null;
    equip = t.body === 'Moon' ? 'naked-eye' : equipmentForMagnitude(body.mag);
    if (t.body === 'Moon') lines.push('Easy from anywhere, city or country. Binoculars show the larger craters and the dark plains.');
    else {
      lines.push(equip === 'naked-eye' ? bortleSentence(body.mag, bortle) : 'Too faint for the naked eye right now.');
      lines.push('To the eye a planet is a steady point of light; it takes a telescope to show its disc.');
    }
  } else if (t.constellation) {
    const n = figureStarsVisible(t.constellation, catalog, b.limitingMag);
    lines.push(`A naked-eye pattern. At your current sky setting (Bortle ${b.n}, ${b.label.toLowerCase()}) ${n.visible === n.total ? `all ${n.total}` : `${n.visible} of the ${n.total}`} stars of its figure are bright enough to see${n.visible < Math.min(4, n.total) ? ', so the shape is hard to make out' : ''}.`);
  } else if (t.kind === 'asterism') {
    lines.push('A naked-eye pattern made of bright stars.');
  }
  return (
    <Section title="What you need">
      <p className="obj-chips">
        <EquipChip equip={equip} />
        {darkSky && <Chip tone="amber">Needs a dark sky</Chip>}
      </p>
      {blurb?.whatYouSee && <p className="obj-p obj-see"><RichText text={blurb.whatYouSee} /></p>}
      {lines.map((l, i) => <p key={i} className="obj-p dim">{l}</p>)}
    </Section>
  );
}

// ───────────────────────────── The panel ─────────────────────────────

/** Everything about one object: what it is, type, distance, size, magnitude, how to find it, when it is visible, equipment, image gallery. */
export function ObjectInfo({ targetRef, observer, date, variant = 'panel', onTarget }: ObjectInfoProps) {
  const catalog = useCatalog();
  const bortle = useSettings((s) => s.bortle);
  const isBody = targetRef.startsWith('body:');
  // Fixed objects resolve once; bodies move, so they follow the clock.
  const t = useMemo(() => (catalog ? catalog.resolve(targetRef, { date, observer }) : null), [catalog, targetRef, isBody ? date : null, isBody ? observer : null]); // eslint-disable-line react-hooks/exhaustive-deps
  const conId = t?.constellation?.id;
  const [conContent, setConContent] = useState<ConstellationContent | null>(null);
  useEffect(() => {
    setConContent(null);
    if (!conId) return;
    let live = true;
    loadConstellationContent(conId).then((c) => live && setConContent(c), () => undefined);
    return () => { live = false; };
  }, [conId]);

  if (!catalog) return <div className="obj obj--loading dim" role="status">Loading…</div>;
  if (!t) return <div className="obj dim">Nothing in the catalog is called “{targetRef}”.</div>;

  const body = t.body ? getBody(t.body, date, observer) : null;
  const aliases = catalog.aliases(t.ref);
  const blurb = getBlurb(...aliases);
  const asterism = t.kind === 'asterism' ? asterismById.get(asterismIdOf(t.ref) ?? '') : undefined;
  const inCon = t.star?.con ?? t.dso?.con ?? body?.con;
  const con = inCon ? catalog.conById.get(inCon) : undefined;
  const images = catalog.imagesFor(t.ref);

  // Header
  let kind = '';
  const desig: string[] = [];
  if (t.star) {
    const s = t.star;
    kind = starKind(s);
    const gen = catalog.conById.get(s.con)?.genitive;
    if (s.bayer) desig.push(`${s.bayer} ${gen ?? s.con}`);
    if (s.flam) desig.push(`${s.flam} ${gen ?? s.con}`);
    if (!s.bayer && !s.flam && s.desig !== t.name) desig.push(s.desig);
    if (s.hr) desig.push(`HR ${s.hr}`);
    if (s.hd) desig.push(`HD ${s.hd}`);
    if (s.hip) desig.push(`HIP ${s.hip}`);
  } else if (t.dso) {
    const d = t.dso;
    kind = `${(DSO_KIND[d.type] ?? DSO_KIND.other).label} — ${(DSO_KIND[d.type] ?? DSO_KIND.other).gloss}`;
    if (d.messier) desig.push(`Messier ${d.messier} (M${d.messier})`);
    for (const a of d.aka) desig.push(a);
    if (!d.messier && !d.aka.length) desig.push(d.id.replace(/^(NGC|IC)(\d)/, '$1 $2'));
    if (d.caldwell) desig.push(`Caldwell ${d.caldwell}`);
  } else if (t.body) kind = BODY_KIND[t.body];
  else if (t.constellation) kind = `Constellation — ${t.constellation.english}`;
  else if (asterism) kind = 'Asterism — a star pattern that is not one of the 88 official constellations';

  // Facts
  const facts: Fact[] = [];
  if (t.star) {
    const s = t.star;
    facts.push({ label: 'Brightness', value: `Magnitude ${formatMag(s.mag)}`, note: `${magnitudeGloss(s.mag)}. Lower numbers are brighter.` });
    if (s.distLy) facts.push({ label: 'Distance', value: formatDistanceLy(s.distLy), note: s.distLy > 1500 ? 'Distances this large are uncertain.' : undefined });
    if (s.sp || s.bv != null) facts.push({ label: 'Type', value: s.sp ? `Spectral type ${s.sp}` : 'Spectral type not listed', note: spectralExplanation(s) });
    if (s.absMag != null) facts.push({ label: 'True brightness', value: `${luminosityWords(s.absMag)}`, note: `In visible light. Absolute magnitude ${formatMag(s.absMag)}: how bright it would look from a standard distance of 32.6 light-years.` });
  } else if (t.dso) {
    const d = t.dso;
    if (d.mag != null) facts.push({ label: 'Brightness', value: `Magnitude ${formatMag(d.mag)}`, note: d.type === 'double-star' ? magnitudeGloss(d.mag) : 'This is its total light. Spread over its area, it looks much fainter than a star of the same magnitude.' });
    if (d.sizeArcmin) {
      const [a, bb] = d.sizeArcmin;
      const size = Math.abs(a - bb) / Math.max(a, 0.001) < 0.08 ? formatAngularSize(a) : `${formatAngularSize(a)} × ${formatAngularSize(bb)}`;
      facts.push({ label: 'Size in the sky', value: size, note: moonWidths(Math.max(a, bb)) ?? (a < 6 ? 'Small: it needs magnification to look like more than a star.' : undefined) });
    }
    if (d.distLy) facts.push({ label: 'Distance', value: formatDistanceLy(d.distLy) });
    const phys = blurb?.physicalSize ?? physicalSizeWords(d);
    if (phys) facts.push({ label: 'True size', value: phys, note: blurb?.physicalSize ? undefined : 'Worked out from its apparent size and distance.' });
    if (d.typeDetail && d.type === 'galaxy') facts.push({ label: 'Galaxy class', value: d.typeDetail, note: /^SB/.test(d.typeDetail) ? 'A barred spiral: a disc with spiral arms and a bar of stars across the centre.' : /^S0/.test(d.typeDetail) ? 'A lenticular galaxy: a disc without spiral arms.' : /^S/.test(d.typeDetail) ? 'A spiral galaxy: a flat disc with spiral arms.' : /^E/.test(d.typeDetail) ? 'An elliptical galaxy: a smooth ball of stars.' : /^I/.test(d.typeDetail) ? 'An irregular galaxy: no tidy shape.' : undefined });
  } else if (t.body && body) {
    if (t.body !== 'Sun') facts.push({ label: 'Brightness now', value: `Magnitude ${formatMag(body.mag)}`, note: t.body === 'Moon' ? undefined : `${magnitudeGloss(body.mag)}.` });
    if (t.body === 'Moon') {
      const ph = moonPhase(date);
      facts.push({ label: 'Phase', value: ph.name, note: litWords(ph.illumination) });
      facts.push({ label: 'Distance', value: km(body.distAu * AU_KM) });
    } else {
      if (t.body !== 'Sun') facts.push({ label: 'Phase', value: litWords(body.phase), note: t.body === 'Mercury' || t.body === 'Venus' ? 'It shows phases like the Moon, visible in a telescope.' : undefined });
      facts.push({ label: 'Distance now', value: `${body.distAu.toFixed(body.distAu < 10 ? 2 : 1)} AU`, note: `${km(body.distAu * AU_KM)}. 1 AU is the distance from the Earth to the Sun.` });
    }
    const arcmin = body.angularDiameterArcsec / 60;
    facts.push({ label: 'Size in the sky', value: formatAngularSize(arcmin), note: arcmin >= 20 ? 'About half a degree: a little finger at arm’s length covers it.' : 'Far too small to see as a disc without a telescope. (1″ is 1/3600 of a degree.)' });
    const dia = BODY_RADIUS_KM[t.body] * 2;
    const ratio = dia / EARTH_DIAMETER_KM;
    facts.push({ label: 'True size', value: blurb?.physicalSize ?? `${km(dia)} across`, note: blurb?.physicalSize ? undefined : ratio >= 1.5 ? `About ${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)} times the width of Earth.` : ratio > 0.9 ? 'Almost the same width as Earth.' : `About ${Math.round(ratio * 100)}% of the width of Earth.` });
    if (t.body !== 'Sun') facts.push({ label: 'Angle from the Sun', value: `${Math.round(body.elongation)}°`, note: body.elongation < 15 ? 'Too close to the Sun to see.' : undefined });
  } else if (t.constellation) {
    const c = t.constellation;
    const rank = [...catalog.constellations].sort((x, y) => y.areaSqDeg - x.areaSqDeg).findIndex((x) => x.id === c.id) + 1;
    const br = catalog.starById.get(c.brightest);
    facts.push({ label: 'Name means', value: c.english, note: `Abbreviation ${c.id}; stars in it are “of ${c.genitive}”.` });
    facts.push({ label: 'Size', value: `${Math.round(c.areaSqDeg).toLocaleString('en-US')} square degrees`, note: `${ordinal(rank)} largest of the 88 constellations.` });
    if (br) facts.push({ label: 'Brightest star', value: <button type="button" className="sky-link" onClick={() => onTargetOr(`star:${br.id}`)}>{br.name ?? br.desig}</button>, note: `Magnitude ${formatMag(br.mag)}: ${magnitudeGloss(br.mag)}.` });
    if (c.zodiac) facts.push({ label: 'Zodiac', value: 'Yes', note: 'The Sun, Moon and planets pass through it.' });
  } else if (asterism) {
    const cons = asterism.constellations.map((id) => catalog.conById.get(id)?.name ?? id);
    if (cons.length) facts.push({ label: cons.length > 1 ? 'Constellations' : 'Constellation', value: cons.join(', ') });
  }
  if (variant === 'page' && (t.star || t.dso)) facts.push({ label: 'Position (J2000)', value: `RA ${formatRa(t.ra)}, Dec ${formatDec(t.dec)}`, note: 'Its fixed address on the star map.' });

  function onTargetOr(ref: string) {
    if (onTarget) onTarget(ref);
    else window.location.hash = `#${routes.sky(ref)}`;
  }

  // Text
  const about: string[] = t.constellation ? [conContent?.overview ?? fallbackAbout(t, catalog)] : asterism ? [asterism.summary] : [blurb?.about ?? fallbackAbout(t, catalog)];
  const howTo: string[] = t.constellation && conContent ? conContent.howToFind.slice(0, 1) : asterism ? asterism.howToFind.slice(0, 1) : [blurb?.howToFind ?? fallbackHowToFind(t, catalog, { con: inCon })];
  const computedHow = !(t.constellation && conContent) && !asterism && !blurb?.howToFind;

  return (
    <article className={`obj obj--${variant}`}>
      <header className="obj-head">
        <h3 className="obj-title">{t.name}</h3>
        {desig.length > 0 && <p className="obj-desig">{desig.join(' · ')}</p>}
        {kind && <p className="obj-kindline">{kind}</p>}
        {con && (
          <p className="obj-con">
            {t.body ? 'Now in ' : 'In '}
            <Link to={routes.constellation(con.id)}>{con.name}</Link>
            <span className="dim">, {con.english}</span>
          </p>
        )}
      </header>

      <div className="obj-main">
        <div className="obj-col">
          <Section title="What it is">
            {about.filter(Boolean).map((p, i) => <p key={i} className="obj-read"><RichText text={p} onTarget={onTarget} /></p>)}
            {t.constellation && (
              <p className="obj-p">
                <Link to={routes.constellation(t.constellation.id)}>{conContent ? `Stories, stars and objects of ${t.constellation.name}` : `${t.constellation.name} page`}</Link>
              </p>
            )}
          </Section>
          <Facts facts={facts} />
          <Section title="How to find it">
            {howTo.filter(Boolean).map((p, i) => <p key={i} className="obj-read"><RichText text={p} onTarget={onTarget} /></p>)}
            {computedHow && <p className="obj-p faint">Directions worked out from the star catalog.</p>}
          </Section>
        </div>
        <div className="obj-col">
          <WhenVisible t={t} catalog={catalog} observer={observer} date={date} body={body} />
          <Equipment_ t={t} body={body} blurb={blurb} bortle={bortle} catalog={catalog} />
        </div>
      </div>

      {images.length > 0 && (
        <Section title="Pictures">
          <ImageGallery images={images} compact={variant === 'panel'} />
        </Section>
      )}

      <footer className="obj-links">
        {variant === 'panel' && !t.constellation && !asterism && <Link className="btn btn--sm" to={routes.object(t.ref)}>Open full page</Link>}
        {variant === 'panel' && t.constellation && <Link className="btn btn--sm" to={routes.constellation(t.constellation.id)}>Open full page</Link>}
        {asterism?.signpost && <Link className="btn btn--sm" to={routes.asterism(asterism.id)}>Signpost guide</Link>}
        {t.constellation && <Link className="btn btn--sm btn--primary" to={routes.quiz('find', { con: t.constellation.id })}>Quiz me</Link>}
        {variant === 'page' && <button type="button" className="btn btn--sm" onClick={() => onTargetOr(t.ref)}>Show in the sky</button>}
      </footer>
    </article>
  );
}
