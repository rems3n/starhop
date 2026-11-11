import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { loadConstellationContent, type ConstellationContent } from '@/content';
import { routes } from '@/lib/routes';
import { Chip, Loading, Prose, RichText } from '@/ui';
import type { SkyController } from '@/types';
import { Crumbs, Empty, Page } from '@/modes/learn/components/common';
import { showInSky, useLearnEnv } from '@/modes/learn/hooks';
import { CHART_LAYERS } from '@/modes/learn/logic/place';
import { makeScene } from '@/modes/learn/logic/scene';
import { LibSky } from '../components/LibSky';

export default function MythPage() {
  const { storyId = '' } = useParams();
  const conId = storyId.split('-')[0];
  const env = useLearnEnv();
  const [content, setContent] = useState<ConstellationContent | null | undefined>(undefined);
  const [ctl, setCtl] = useState<SkyController | null>(null);
  useEffect(() => {
    setContent(undefined);
    let live = true;
    loadConstellationContent(conId).then((c) => live && setContent(c), () => live && setContent(null));
    return () => {
      live = false;
    };
  }, [conId]);
  useEffect(() => window.scrollTo?.(0, 0), [storyId]);

  const story = content?.stories.find((s) => s.id === storyId);
  const con = env?.catalog.conById.get(conId);
  const scene = useMemo(() => {
    if (!env || !con) return null;
    const fov = Math.min(100, (env.catalog.resolve(`con:${con.id}`)?.fov ?? 60) * 1.1);
    return makeScene(
      { time: env.now, target: `con:${con.id}`, fov, mount: 'equatorial', layers: { ...CHART_LAYERS, constellationNames: false, milkyWay: true }, highlights: [{ type: 'constellation', id: con.id, lines: true, label: true }] },
      env,
    );
  }, [env, con]);

  if (!env || content === undefined) return <Loading label="Loading…" />;
  if (!story || !con || !scene)
    return (
      <Page>
        <Empty>There is no myth with the id “{storyId}”.</Empty>
        <Link to={routes.myths()}>All myths</Link>
      </Page>
    );
  const onTarget = (ref: string) => void showInSky(ctl, env.catalog, ref);
  const others = content!.stories.filter((s) => s.id !== story.id);
  return (
    <Page wide>
      <Crumbs items={[['Library', routes.library()], ['Myths', routes.myths()], [story.title]]} />
      <header className="lb-head">
        <h1>{story.title}</h1>
        <p className="lb-lede">
          A {story.culture} story told about <Link to={routes.constellation(con.id)}>{con.name}</Link> ({con.english}).
        </p>
      </header>
      <div className="lb-reading">
        <article className="lb-reading-main">
          <div className="prose lb-summary">
            <p>
              <RichText text={story.summary} onTarget={onTarget} />
            </p>
          </div>
          <h2 className="lb-h2">The story</h2>
          <Prose paragraphs={story.retelling} onTarget={onTarget} />
          {story.link && (
            <p className="lb-fulltext">
              Read a full version:{' '}
              <a href={story.link.url} target="_blank" rel="noopener noreferrer">
                {story.link.label}
              </a>{' '}
              <span className="dim">at {story.link.site} (opens in a new tab)</span>
            </p>
          )}
          <div className="lb-actions">
            <Link className="btn btn--primary" to={routes.quiz('story', { story: story.id })}>
              Quiz me on this myth
            </Link>
            <Link className="btn" to={routes.constellation(con.id)}>
              About {con.name}
            </Link>
          </div>
          {others.length > 0 && (
            <section className="lb-section">
              <h2 className="lb-h2">Other versions of this myth</h2>
              <p className="dim">Other stories told about {con.name}.</p>
              <ul className="lb-linklist">
                {others.map((s) => (
                  <li key={s.id}>
                    <Link to={routes.myth(s.id)}>{s.title}</Link> <span className="dim">· {s.culture}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="lb-back">
            <Link to={`${routes.myths()}?con=${con.id}`}>All myths of {con.name}</Link> · <Link to={routes.myths()}>All myths</Link>
          </p>
        </article>
        <aside className="lb-reading-aside">
          <LibSky scene={scene} onController={setCtl} size="small" openTarget={`con:${con.id}`} label={`${con.name} as a star chart`} />
          <dl className="lb-facts">
            <div>
              <dt>Constellation</dt>
              <dd>
                <Link to={routes.constellation(con.id)}>{con.name}</Link> <span className="dim">({con.english})</span>
              </dd>
            </div>
            <div>
              <dt>Culture</dt>
              <dd>{story.culture}</dd>
            </div>
            <div>
              <dt>Ancient {story.ancientSources.length > 1 ? 'sources' : 'source'}</dt>
              <dd>
                <ul className="lb-plainlist">
                  {story.ancientSources.map((a, i) => (
                    <li key={i}>
                      {a.author}, <em>{a.work}</em>
                      {a.date && <span className="dim"> ({a.date})</span>}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
            {story.characters.length > 0 && (
              <div>
                <dt>Characters</dt>
                <dd className="lb-chips">
                  {story.characters.map((c) => (
                    <Link key={c} className="chip" to={`${routes.myths()}?who=${encodeURIComponent(c)}`} title={`Other myths with ${c}`}>
                      {c}
                    </Link>
                  ))}
                </dd>
              </div>
            )}
            {story.link && (
              <div>
                <dt>Full version</dt>
                <dd>
                  <a href={story.link.url} target="_blank" rel="noopener noreferrer">
                    {story.link.site}
                  </a>
                </dd>
              </div>
            )}
          </dl>
          <div className="lb-chips">
            <Chip>{content!.kind === 'ancient' ? 'Ancient constellation' : 'Modern constellation'}</Chip>
          </div>
        </aside>
      </div>
    </Page>
  );
}
