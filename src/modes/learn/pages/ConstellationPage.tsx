import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { bestMonths, constellationPoints } from '@/astro';
import { VisibilityStrip } from '@/components/object';
import { loadConstellationContent, type ConstellationContent, type Story } from '@/content';
import { routes } from '@/lib/routes';
import { formatMag } from '@/lib/format';
import { MONTH_NAMES, formatTime } from '@/lib/time';
import { constellationMastery, useProgress } from '@/store/progress';
import { Button, Chip, EquipChip, Loading, Meter, Prose, RichText } from '@/ui';
import { type Highlight, type ResolvedTarget, type SkyController } from '@/types';
import { Crumbs, Empty, LocationLine, Page, Section, Split } from '../components/common';
import { SkyStage } from '../components/SkyStage';
import { showInSky, useLearnEnv } from '../hooks';
import { useCourse } from '../logic/course';
import { placeTarget } from '../logic/place';
import { heightWords } from '../logic/tonight';

const SKILLS: { key: 'find' | 'name' | 'story' | 'visibility'; label: string; quiz: 'find' | 'name' | 'story' | 'visibility'; cta: string }[] = [
  { key: 'find', label: 'Find it', quiz: 'find', cta: 'Practise finding it' },
  { key: 'name', label: 'Name it', quiz: 'name', cta: 'Practise naming it' },
  { key: 'story', label: 'Its stories', quiz: 'story', cta: 'Story quiz' },
  { key: 'visibility', label: 'When it is visible', quiz: 'visibility', cta: 'Visibility quiz' },
];

export default function ConstellationPage() {
  const { id = '' } = useParams();
  const env = useLearnEnv();
  const course = useCourse(env?.catalog ?? null);
  const markSeen = useProgress((s) => s.markSeen);
  const items = useProgress((s) => s.items);
  const [content, setContent] = useState<ConstellationContent | null | undefined>(undefined);
  const [ctl, setCtl] = useState<SkyController | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [starIdx, setStarIdx] = useState<number | null>(null);
  const con = env?.catalog.conById.get(id);

  useEffect(() => {
    setContent(undefined);
    setStarIdx(null);
    setNote(null);
    let live = true;
    loadConstellationContent(id).then((c) => live && setContent(c), () => live && setContent(null));
    return () => {
      live = false;
    };
  }, [id]);
  useEffect(() => {
    if (con) markSeen(con.id);
  }, [con, markSeen]);

  const points = useMemo(() => (con && env ? constellationPoints(con, env.catalog) : []), [con, env]);
  const placed = useMemo(() => {
    if (!con || !env) return null;
    const fov = env.catalog.resolve(`con:${con.id}`)?.fov ?? 70;
    return placeTarget(`con:${con.id}`, { points }, env.nightDate, env, { fov, layers: { constellationNames: false } });
  }, [con, env, points]);
  const months = useMemo(() => (con && env ? bestMonths({ points }, env.observer) : []), [con, env, points]);

  /** Main stars: the authored list when there is one, else the brightest figure stars from the catalog. */
  const stars = useMemo(() => {
    if (!con || !env) return [];
    if (content) return content.mainStars.map((m) => ({ ref: m.ref, note: m.note, t: env.catalog.resolve(m.ref) })).filter((m) => m.t);
    return con.figureStars.slice(0, 5).map((sid) => ({ ref: `star:${sid}`, note: '', t: env.catalog.resolve(`star:${sid}`) })).filter((m) => m.t);
  }, [con, env, content]);

  useEffect(() => {
    if (!ctl || !con) return;
    // star names and boundaries are the learner's choice in the embed's Layers panel (the scene starts with names on)
    const hl: Highlight[] = [{ type: 'constellation', id: con.id, lines: true, label: true }];
    const s = starIdx != null ? stars[starIdx] : null;
    if (s) hl.push({ type: 'object', ref: s.ref, label: true });
    ctl.setHighlights(hl);
  }, [ctl, con, starIdx, stars, placed]);

  if (!env) return <Loading />;
  if (!con || !placed)
    return (
      <Page>
        <Empty>There is no constellation with the abbreviation “{id}”.</Empty>
        <Link to={routes.constellations()}>All 88 constellations</Link>
      </Page>
    );
  const tz = env.observer.tz;
  const rank = [...env.catalog.constellations].sort((a, b) => b.areaSqDeg - a.areaSqDeg).findIndex((c) => c.id === con.id) + 1;
  const home = course?.modules.flatMap((m) => m.groups.map((g) => ({ m, g }))).find((x) => x.g.constellations.includes(con.id));
  const gi = home ? home.g.constellations.indexOf(con.id) : -1;
  const nb = { prev: home && gi > 0 ? home.g.constellations[gi - 1] : null, next: home && gi < home.g.constellations.length - 1 ? home.g.constellations[gi + 1] : null };
  const mastery = constellationMastery(items, con.id);
  const onTarget = (ref: string) => setNote(showInSky(ctl, env.catalog, ref));
  const v = placed.visibility;
  const tonightLine =
    v.cls === 'not-visible' || !v.bestTime
      ? months.length
        ? `Not well placed tonight from ${env.observer.name}.`
        : `Never rises high enough to see from ${env.observer.name}.`
      : `${v.cls === 'all-night' ? 'Up all night' : v.cls === 'evening' ? 'In the evening sky' : 'In the morning sky, before dawn'} tonight. Best around ${formatTime(v.bestTime, tz)}, ${heightWords(v.bestAlt, v.bestAz)}.`;
  const pickStar = (i: number | null) => {
    setStarIdx(i);
    setNote(null);
  };
  const star = starIdx != null ? stars[starIdx] : null;

  const sky = (
    <SkyStage
      scene={placed.scene}
      exploreTarget={`con:${con.id}`}
      onController={setCtl}
      onReset={() => setNote(null)}
      note={note ?? (placed.mode === 'chart' ? `Not in tonight's sky from ${env.observer.name}. Shown as a star chart, north up.` : null)}
    >
      <div className="ln-controls">
        <div className="ln-control ln-control--row">
          <span>Main stars</span>
          <Button size="sm" disabled={!stars.length} onClick={() => pickStar(starIdx == null ? 0 : (starIdx + stars.length - 1) % stars.length)} aria-label="Previous main star">
            ‹
          </Button>
          <Button size="sm" variant="primary" disabled={!stars.length} onClick={() => pickStar(starIdx == null ? 0 : (starIdx + 1) % stars.length)}>
            {starIdx == null ? 'Show one by one' : 'Next star'}
          </Button>
          {starIdx != null && (
            <Button size="sm" variant="quiet" onClick={() => pickStar(null)}>
              Clear
            </Button>
          )}
        </div>
        {star && (
          <p className="ln-star-caption" aria-live="polite">
            <strong>
              {starIdx! + 1}. {star.t!.name}
            </strong>{' '}
            <span className="dim">magnitude {formatMag(star.t!.star?.mag)}</span>
            {star.note && (
              <>
                {' — '}
                <RichText text={star.note} onTarget={onTarget} />
              </>
            )}
          </p>
        )}
      </div>
    </SkyStage>
  );

  return (
    <Page wide>
      <Crumbs items={[['Constellations', routes.constellations()], ...(home ? [[`Module ${home.m.number}: ${home.m.title}`, routes.module(home.m.id)] as [string, string]] : []), [con.name]]} />
      <header className="ln-head">
        <h1>
          {con.name} <span className="ln-h1-sub">{con.english}</span>
        </h1>
        <div className="ln-chips">
          <Chip>Abbreviation {con.id}</Chip>
          <Chip>Genitive: {con.genitive}</Chip>
          <Chip>
            {rank === 1 ? 'Largest' : rank === 88 ? 'Smallest' : `${ordinal(rank)} largest`} of 88 · {Math.round(con.areaSqDeg)} square degrees
          </Chip>
          {home?.m.kind === 'anchors' && <Chip tone="amber">Anchor constellation for your location</Chip>}
          {con.zodiac && <Chip>Zodiac</Chip>}
          {content && <Chip>{content.kind === 'ancient' ? 'Ancient' : 'Modern'} constellation</Chip>}
        </div>
      </header>
      <Split sky={sky}>
        {content === undefined && <p className="dim">Loading the write-up…</p>}
        {content === null && (
          <Empty>
            The full write-up for {con.name} (how to find it, its stars and its stories) is not available yet. Here is what the star catalog knows about it.
          </Empty>
        )}
        {content && (
          <div className="prose">
            <p>
              <RichText text={content.overview} onTarget={onTarget} />
            </p>
          </div>
        )}

        <Section title="When to see it" aside={<LocationLine />}>
          <p>
            <strong>{tonightLine}</strong>
          </p>
          <p className="dim">
            {months.length ? `Best on evenings in ${listMonths(months)}.` : 'It does not get high enough in the evening sky at any time of year from this latitude.'}
          </p>
          <VisibilityStrip target={{ points }} observer={env.observer} showLegend />
        </Section>

        {content && (
          <>
            <Section title="How to find it">
              <Prose paragraphs={content.howToFind} onTarget={onTarget} />
            </Section>
            <Section title="What it looks like">
              <Prose paragraphs={[content.shape]} onTarget={onTarget} />
            </Section>
          </>
        )}

        <Section title="Main stars">
          {!content && <p className="dim">The brightest stars of the figure, from the catalog.</p>}
          <ul className="ln-stars">
            {stars.map((s, i) => (
              <li key={s.ref}>
                <button type="button" className={`ln-star${i === starIdx ? ' is-on' : ''}`} aria-pressed={i === starIdx} onClick={() => pickStar(i === starIdx ? null : i)}>
                  <span className="ln-star-name">
                    <strong>{s.t!.name}</strong>
                    <span className="dim">
                      {s.t!.star && s.t!.star.name ? `${s.t!.star.desig} · ` : ''}mag {formatMag(s.t!.star?.mag)}
                    </span>
                  </span>
                  {s.note && <span className="ln-star-note">{plain(s.note)}</span>}
                </button>
              </li>
            ))}
          </ul>
          <p className="dim ln-small">Select a star to ring it in the sky view.</p>
        </Section>

        {content && content.notableObjects.length > 0 && (
          <Section title="Notable objects">
            <ul className="ln-objects">
              {content.notableObjects.map((o) => {
                const t = env.catalog.resolve(o.ref);
                const img = env.catalog.imagesFor(o.ref)[0];
                return (
                  <li key={o.ref} className="card">
                    {img ? <img src={`${import.meta.env.BASE_URL}${img.file}`} alt="" loading="lazy" /> : <div className="ln-thumb-empty" aria-hidden />}
                    <div className="grow">
                      <div className="row row--wrap">
                        <Link to={routes.object(o.ref)} className="ln-object-name">
                          {objectTitle(t, o.ref)}
                        </Link>
                        <EquipChip equip={o.equip} />
                      </div>
                      <p className="ln-small">
                        <RichText text={o.note} onTarget={onTarget} />
                      </p>
                      <button type="button" className="sky-link ln-small" onClick={() => onTarget(o.ref)}>
                        Show in the sky
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {content && content.stories.length > 0 && (
          <Section title={content.stories.length > 1 ? 'Stories' : 'Story'} aside={<Link to={`${routes.myths()}?con=${con.id}`}>{content.stories.length > 1 ? `All ${content.stories.length} in the myth library` : 'In the myth library'}</Link>}>
            {content.stories.map((s) => (
              <StoryBlock key={s.id} story={s} onTarget={onTarget} />
            ))}
          </Section>
        )}

        {content && (
          <Section title={content.stories.length ? 'Where the constellation comes from' : 'How it got its name'}>
            <p className="dim">
              Named by {content.origin.namedBy}, {content.origin.when}.{!content.stories.length && ' This is a modern constellation: it has a history, not a myth.'}
            </p>
            <Prose paragraphs={content.origin.history} onTarget={onTarget} />
          </Section>
        )}

        {content && content.facts.length > 0 && (
          <Section title="Good to know">
            <ul className="prose ln-keypoints">
              {content.facts.map((f, i) => (
                <li key={i}>
                  <RichText text={f} onTarget={onTarget} />
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Your progress">
          <div className="ln-mastery">
            {SKILLS.map((s) => {
              const m = mastery[s.key];
              if (s.key === 'story' && content && !content.stories.length) return null;
              return (
                <div key={s.key} className="ln-mastery-row">
                  <span>{s.label}</span>
                  <Meter value={m ?? 0} label={`${s.label}: mastery`} />
                  <span className="dim ln-nowrap">{m == null ? 'not tried' : `${Math.round(m * 100)}%`}</span>
                  <Link className="btn btn--sm" to={routes.quiz(s.quiz, { con: con.id })}>
                    {s.cta}
                  </Link>
                </div>
              );
            })}
          </div>
        </Section>

        <nav className="ln-prevnext">
          {nb.prev ? <Link to={routes.constellation(nb.prev)}>← {env.catalog.conById.get(nb.prev)?.name ?? nb.prev}</Link> : home ? <Link to={routes.module(home.m.id)}>← Module {home.m.number}: {home.m.title}</Link> : <span />}
          {nb.next ? <Link to={routes.constellation(nb.next)}>{env.catalog.conById.get(nb.next)?.name ?? nb.next} →</Link> : home ? <Link to={routes.module(home.m.id)}>Back to module {home.m.number} →</Link> : <span />}
        </nav>
      </Split>
    </Page>
  );
}

function StoryBlock({ story, onTarget }: { story: Story; onTarget: (ref: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="ln-story">
      <div className="ln-story-head">
        <h4>
          <Link to={routes.myth(story.id)}>{story.title}</Link>
        </h4>
        <Chip>{story.culture}</Chip>
      </div>
      <div className="prose">
        <p>
          <RichText text={story.summary} onTarget={onTarget} />
        </p>
      </div>
      {open && (
        <div className="ln-story-full">
          <Prose paragraphs={story.retelling} onTarget={onTarget} />
        </div>
      )}
      <Button size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Close the story' : 'Read the story'}
      </Button>
      <p className="ln-story-src dim">
        From:{' '}
        {story.ancientSources.map((a, i) => (
          <span key={i}>
            {i > 0 && '; '}
            {a.author}, <em>{a.work}</em>
            {a.date && ` (${a.date})`}
          </span>
        ))}
      </p>
      {story.link && (
        <p className="ln-story-src">
          Full version:{' '}
          <a href={story.link.url} target="_blank" rel="noopener noreferrer">
            {story.link.label}
          </a>{' '}
          <span className="dim">at {story.link.site} (opens in a new tab)</span>
        </p>
      )}
    </article>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
function listMonths(m: number[]): string {
  const names = m.map((x) => MONTH_NAMES[x - 1]);
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
function plain(text: string): string {
  return text.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1').replace(/\*([^*\n]+)\*/g, '$1');
}
function objectTitle(t: ResolvedTarget | null, ref: string): string {
  if (!t) return ref;
  if (t.dso) {
    const id = t.dso.messier ? `M${t.dso.messier}` : t.dso.aka[0] ?? t.dso.id;
    return t.dso.name ? `${t.dso.name} (${id})` : id;
  }
  return t.name;
}
