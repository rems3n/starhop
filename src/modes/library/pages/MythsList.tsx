import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { Loading } from '@/ui';
import { Page } from '@/modes/learn/components/common';
import { useLearnEnv } from '@/modes/learn/hooks';
import { Badge, CollectionView, type Column } from '../components/CollectionView';
import { ListHead, plain } from '../components/common';
import { useAllContent } from '../logic/hooks';
import { buildMythRows, hasCharacter, tally, type MythRow } from '../logic/rows';
import type { FilterSpec, SortSpec } from '../logic/table';

const DEFAULT_SORT = { sort: 'con', dir: 'asc' as const };

export default function MythsList() {
  const env = useLearnEnv();
  const content = useAllContent();
  const rows = useMemo(() => (env && content ? buildMythRows(content, (id) => env.catalog.conById.get(id)?.name ?? id) : null), [env, content]);

  const filters = useMemo<FilterSpec<MythRow>[]>(() => {
    const r = rows ?? [];
    const cons = [...new Map(r.map((m) => [m.con, m.conName]))].sort((a, b) => a[1].localeCompare(b[1]));
    return [
      { id: 'con', label: 'Constellation', kind: 'select', anyLabel: 'Any constellation', options: cons.map(([value, label]) => ({ value, label })), test: (m, v) => m.con === v },
      { id: 'culture', label: 'Culture', kind: 'select', anyLabel: 'Any culture', options: tally(r.map((m) => [m.cultureFamily])).map((t) => ({ value: t.value, label: `${t.value} (${t.count})` })), test: (m, v) => m.cultureFamily === v },
      { id: 'author', label: 'Ancient author', kind: 'select', anyLabel: 'Any author', options: tally(r.map((m) => m.authors)).sort((a, b) => a.value.localeCompare(b.value)).map((t) => ({ value: t.value, label: `${t.value} (${t.count})` })), test: (m, v) => m.authors.includes(v) },
      { id: 'who', label: 'Character', kind: 'text', placeholder: 'e.g. Zeus', options: tally(r.map((m) => m.characters)).map((t) => ({ value: t.value, label: t.value })), test: (m, v) => hasCharacter(m.characters, v) },
      { id: 'link', label: 'Has a full-text link', kind: 'toggle', test: (m) => m.hasLink },
    ];
  }, [rows]);

  const sorts = useMemo<SortSpec<MythRow>[]>(
    () => [
      { id: 'con', label: 'Constellation', value: (m) => `${m.conName} ${m.title}` },
      { id: 'title', label: 'Title', value: (m) => m.title.replace(/^(the|a|an) /i, '') },
      { id: 'culture', label: 'Culture', value: (m) => `${m.culture} ${m.title}` },
    ],
    [],
  );

  const columns: Column<MythRow>[] = [
    { id: 'title', label: 'Myth', sort: 'title', cell: (m) => <Link to={routes.myth(m.id)}>{m.title}</Link> },
    { id: 'con', label: 'Constellation', sort: 'con', cell: (m) => <Link to={routes.constellation(m.con)}>{m.conName}</Link> },
    { id: 'culture', label: 'Culture', sort: 'culture', cell: (m) => m.culture },
    { id: 'sources', label: 'Ancient sources', cell: (m) => <span className="lb-clamp">{m.sources}</span> },
    { id: 'who', label: 'Characters', cell: (m) => <span className="lb-clamp">{m.characters.join(', ') || '—'}</span> },
    { id: 'summary', label: 'Summary', cell: (m) => <span className="lb-clamp lb-clamp--wide">{plain(m.summary)}</span> },
  ];

  if (!env) return <Loading />;
  return (
    <Page wide>
      <ListHead title="Myths" lede="Every story told about the constellations in one place: who tells it, where it comes from, and who is in it." />
      <CollectionView
        rows={rows}
        rowKey={(m) => m.id}
        href={(m) => routes.myth(m.id)}
        columns={columns}
        filters={filters}
        sorts={sorts}
        defaultSort={DEFAULT_SORT}
        searchText={(m) => `${m.title} ${m.conName} ${m.culture} ${m.sources} ${m.characters.join(' ')} ${plain(m.summary)}`}
        searchLabel="Search myths, characters, sources"
        noun={['myth', 'myths']}
        card={(m) => (
          <>
            <div className="lb-card-head">
              <strong>{m.title}</strong>
              <span className="dim">
                {m.conName} · {m.culture}
              </span>
            </div>
            <p className="lb-card-text">{plain(m.summary)}</p>
            <div className="lb-card-meta">
              <span>{m.authors.join(', ')}</span>
              {m.hasLink && <Badge>Full text linked</Badge>}
            </div>
          </>
        )}
      />
    </Page>
  );
}
