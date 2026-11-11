import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Catalog } from '@/data/catalog';
import type { ResolvedTarget } from '@/types';
import { DSO_KIND } from '@/components/object/describe';
import { Icon } from './icons';

export interface SearchBoxHandle { focus(): void }

/** Kind + constellation shown under each result. */
export function resultMeta(t: ResolvedTarget, catalog: Pick<Catalog, 'conById'>): string {
  const con = (id: string | undefined) => (id ? catalog.conById.get(id)?.name ?? id : '');
  if (t.kind === 'star' && t.star) return [t.star.name ? `Star · ${t.star.desig}` : 'Star', con(t.star.con)].filter(Boolean).join(' · ');
  if (t.kind === 'dso' && t.dso) {
    const id = t.dso.messier ? `M${t.dso.messier}` : t.dso.id.replace(/^(NGC|IC)(\d)/, '$1 $2');
    return [DSO_KIND[t.dso.type]?.label ?? 'Deep-sky object', t.name === id ? '' : id, con(t.dso.con)].filter(Boolean).join(' · ');
  }
  if (t.kind === 'constellation' && t.constellation) return `Constellation · ${t.constellation.english}`;
  if (t.kind === 'body') return t.body === 'Sun' ? 'The Sun' : t.body === 'Moon' ? 'The Moon' : 'Planet';
  if (t.kind === 'asterism') return 'Star pattern (asterism)';
  return '';
}

export const SearchBox = forwardRef<SearchBoxHandle, { catalog: Catalog | null; onChoose: (t: ResolvedTarget) => void }>(function SearchBox({ catalog, onChoose }, ref) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  useImperativeHandle(ref, () => ({ focus: () => { input.current?.focus(); input.current?.select(); } }), []);

  const results = useMemo(() => (catalog && q.trim() ? catalog.search(q, 10) : []), [catalog, q]);
  useEffect(() => setActive(0), [q]);

  const choose = (t: ResolvedTarget | undefined) => {
    if (!t) return;
    onChoose(t);
    setQ('');
    setOpen(false);
    input.current?.blur();
  };
  const show = open && q.trim().length > 0;

  return (
    <div className="ex-search" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
      <div className="ex-search-field panel">
        <Icon name="search" />
        <input
          ref={input}
          className="ex-search-input"
          type="search"
          role="combobox"
          aria-label="Search stars, constellations, planets and deep-sky objects"
          aria-expanded={show}
          aria-controls={listId}
          aria-activedescendant={show && results[active] ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          placeholder="Search the sky"
          autoComplete="off"
          spellCheck={false}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(results.length - 1, a + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
            else if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
            else if (e.key === 'Escape') { e.stopPropagation(); if (q) setQ(''); else input.current?.blur(); setOpen(false); }
          }}
        />
        {!q && <kbd className="ex-kbd" aria-hidden>/</kbd>}
      </div>
      {show && (
        <ul id={listId} className="ex-search-results panel" role="listbox" aria-label="Search results">
          {results.length === 0 && <li className="ex-search-empty" role="presentation">Nothing in the catalog matches “{q.trim()}”. Try a star or constellation name, or a number like M31.</li>}
          {results.map((t, i) => (
            <li
              key={t.ref}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`ex-search-row${i === active ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(t)}
            >
              <span className="ex-search-name">{t.name}</span>
              <span className="ex-search-meta">{catalog ? resultMeta(t, catalog) : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
