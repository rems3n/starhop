import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { asterisms, blurbRefs } from '@/content';
import { routes } from '@/lib/routes';
import { Loading } from '@/ui';
import { Page } from '@/modes/learn/components/common';
import { useLearnEnv } from '@/modes/learn/hooks';
import type { ResolvedTarget } from '@/types';
import { ListHead, plain, refHref } from '../components/common';
import { useAllContent } from '../logic/hooks';
import { TOP_N, buildMythRows, isLibraryStar } from '../logic/rows';
import { allStarhops } from '../logic/starhopData';
import { matchesText } from '../logic/table';

const KIND_WORD: Record<ResolvedTarget['kind'], string> = { star: 'Star', dso: 'Deep-sky object', body: 'Solar system', constellation: 'Constellation', asterism: 'Asterism', point: 'Point' };

export default function LibraryHome() {
  const env = useLearnEnv();
  const content = useAllContent();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const myths = useMemo(() => (env && content ? buildMythRows(content, (id) => env.catalog.conById.get(id)?.name ?? id) : null), [env, content]);
  const hops = allStarhops();

  const results = useMemo(() => {
    if (!env || q.trim().length < 2) return null;
    const sky = env.catalog.search(q, 12);
    const m = (myths ?? []).filter((r) => matchesText(`${r.title} ${r.conName} ${r.culture} ${r.characters.join(' ')}`, q)).slice(0, 10);
    const h = hops.filter((x) => matchesText(`${x.name} ${x.summary}`, q)).slice(0, 8);
    return { sky, myths: m, hops: h };
  }, [env, q, myths, hops]);

  if (!env) return <Loading />;
  const stars = env.catalog.stars.filter(isLibraryStar).length;
  const cards: { to: string; title: string; count: string; text: string }[] = [
    { to: routes.constellations(), title: 'Constellations', count: '88', text: 'Every constellation, with when and whether you can see it from where you are.' },
    { to: routes.myths(), title: 'Myths', count: myths ? String(myths.length) : '…', text: 'All the stories in one place, by constellation, culture, ancient author and character.' },
    { to: routes.starhops(), title: 'Star-hops', count: hops.length ? String(hops.length) : 'Coming soon', text: `How to get from stars you know to new ones. Start with the top ${TOP_N}, then test yourself.` },
    { to: routes.asterisms(), title: 'Asterisms and signposts', count: String(asterisms.length), text: 'Easy star patterns like the Big Dipper, and the seasonal signposts to start from.' },
    { to: routes.stars(), title: 'Stars', count: String(stars), text: 'Named stars and the bright lettered ones: brightness, colour and distance.' },
    { to: routes.objects(), title: 'Deep-sky objects', count: String(env.catalog.dsos.length), text: 'Clusters, nebulae and galaxies, including the Messier and Caldwell lists.' },
    { to: routes.planets(), title: 'Sun, Moon and planets', count: '9', text: 'Where each one is today and whether you can see it tonight.' },
  ];
  const writeups = blurbRefs.length;

  return (
    <Page wide>
      <ListHead title="Library" lede={`Reference lists you can search, filter and sort, with a page for everything in them. ${writeups} objects have their own write-up.`} />
      <label className="lb-bigsearch">
        <span className="sr-only">Search the whole library</span>
        <input className="input" type="search" placeholder="Search everything: a star, a myth, a character, a star-hop…" value={q} onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })} autoComplete="off" />
      </label>
      {results ? (
        <div className="lb-results" role="region" aria-label="Search results">
          {!results.sky.length && !results.myths.length && !results.hops.length && <p className="lb-empty dim">Nothing found for “{q}”.</p>}
          {results.sky.length > 0 && (
            <section>
              <h2 className="lb-h2">In the sky</h2>
              <ul className="lb-hits">
                {results.sky.map((t) => (
                  <li key={t.ref}>
                    <Link to={refHref(t.kind === 'constellation' && t.constellation ? `con:${t.constellation.id}` : t.ref)}>{t.name}</Link> <span className="dim">· {hitSub(t, env.catalog.conById)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {results.myths.length > 0 && (
            <section>
              <h2 className="lb-h2">Myths</h2>
              <ul className="lb-hits">
                {results.myths.map((m) => (
                  <li key={m.id}>
                    <Link to={routes.myth(m.id)}>{m.title}</Link> <span className="dim">· {m.conName} · {m.culture}</span>
                    <p className="lb-hit-text dim">{plain(m.summary)}</p>
                  </li>
                ))}
              </ul>
              <Link to={`${routes.myths()}?q=${encodeURIComponent(q)}`}>All matching myths</Link>
            </section>
          )}
          {results.hops.length > 0 && (
            <section>
              <h2 className="lb-h2">Star-hops</h2>
              <ul className="lb-hits">
                {results.hops.map((h) => (
                  <li key={h.id}>
                    <Link to={routes.starhop(h.id)}>{h.name}</Link> <span className="dim">· {h.summary}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        <ul className="lb-collections">
          {cards.map((c) => (
            <li key={c.to}>
              <Link to={c.to} className="card lb-collection-card">
                <span className="lb-collection-count">{c.count}</span>
                <strong>{c.title}</strong>
                <span className="dim">{c.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

function hitSub(t: ResolvedTarget, conById: Map<string, { name: string }>): string {
  const con = t.star?.con ?? t.dso?.con;
  const where = con ? ` in ${conById.get(con)?.name ?? con}` : '';
  if (t.constellation) return `Constellation · ${t.constellation.english}`;
  if (t.star) return `${t.star.name ? `${t.star.desig} · ` : ''}Star${where}`;
  if (t.dso) return `${t.dso.messier ? `M${t.dso.messier} · ` : ''}Deep-sky object${where}`;
  return KIND_WORD[t.kind];
}
