import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { constellationPoints, yearVisibility } from '@/astro';
import { MONTH_NAMES, zonedParts } from '@/lib/time';
import { Loading, Segmented } from '@/ui';
import type { Observer } from '@/types';
import { LocationLine, Page } from '../components/common';
import { useLearnEnv } from '../hooks';
import { useCourse } from '../logic/course';
import { CLASS_SHORT, buildCalendarRows, groupOrder, filterRows, groupRows, runChunked, sortRows, type CalFilter, type CalGroupBy, type CalSort, type YearClasses } from '../logic/calendar';

// One cache per place and year: the grid is computed once, a few rows at a time.
const cache = new Map<string, Map<string, YearClasses>>();
const cacheKey = (o: Observer, year: number) => `${o.lat.toFixed(3)},${o.lon.toFixed(3)},${o.tz},${year}`;

export default function CalendarPage() {
  const env = useLearnEnv();
  const [filter, setFilter] = useState<CalFilter>('all');
  const [groupBy, setGroupBy] = useState<CalGroupBy>('season');
  const [sort, setSort] = useState<CalSort>('when');
  const [, setTick] = useState(0);
  const course = useCourse(env?.catalog ?? null);
  const rows = useMemo(() => (env && course ? buildCalendarRows(env.catalog.constellations, course, (c) => constellationPoints(c, env.catalog)) : []), [env, course]);
  const now = env ? zonedParts(env.now, env.observer.tz) : null;
  const key = env && now ? cacheKey(env.observer, now.year) : '';

  useEffect(() => {
    if (!env || !now) return;
    let store = cache.get(key);
    if (!store) cache.set(key, (store = new Map()));
    const todo = rows.filter((r) => !store!.has(r.key));
    if (!todo.length) return;
    const s = store;
    return runChunked(todo, 8, (r) => s.set(r.key, yearVisibility(r.target, now.year, env.observer).map((v) => v.cls)), () => setTick((t) => t + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, rows]);

  if (!env || !now || !course) return <Loading />;
  const classes = cache.get(key) ?? new Map<string, YearClasses>();
  const done = rows.filter((r) => classes.has(r.key)).length;
  const shown = sortRows(filterRows(rows, filter), sort, classes, 1);
  const groups = groupRows(shown, groupBy, course);
  return (
    <Page>
      <header className="ln-head">
        <h1>Visibility calendar</h1>
        <p className="ln-lede">When each constellation and planet can be seen during the night, month by month. Each box is the night of the 15th.</p>
        <LocationLine />
        <div className="ln-filters">
          <label className="field">
            Show
            <select className="select" value={filter} onChange={(e) => setFilter(e.target.value as CalFilter)}>
              <option value="all">Everything</option>
              <option value="anchors">Anchor constellations for your location</option>
              <option value="planets">Planets only</option>
              <optgroup label="Best in the evening">
                {groupOrder(course).map((g) => (
                  <option key={g.id} value={`group:${g.id}`}>
                    {g.title}
                  </option>
                ))}
              </optgroup>
              <optgroup label="By course module">
                {course.modules.filter((m) => m.groups.length).map((m) => (
                  <option key={m.id} value={`module:${m.id}`}>
                    Module {m.number}: {m.title}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <div className="field">
            Group by
            <Segmented<CalGroupBy> label="Group rows by" value={groupBy} onChange={setGroupBy} options={[{ value: 'season', label: 'Evening months' }, { value: 'module', label: 'Course module' }, { value: 'none', label: 'No groups' }]} />
          </div>
          <div className="field">
            Sort by
            <Segmented<CalSort> label="Sort rows by" value={sort} onChange={setSort} options={[{ value: 'when', label: 'When visible' }, { value: 'name', label: 'Name' }]} />
          </div>
        </div>
        <div className="ln-legend" aria-label="Legend">
          {(['evening', 'all-night', 'morning', 'not-visible'] as const).map((c) => (
            <span key={c}>
              <i className={`ln-cal-cell is-${c}`} /> {CLASS_SHORT[c]}
            </span>
          ))}
          <span>
            <i className="ln-cal-now" /> This month
          </span>
          {done < rows.length && (
            <span className="dim" role="status">
              Working out {rows.length - done} more rows…
            </span>
          )}
        </div>
      </header>
      <div className="ln-cal-wrap">
        <table className="ln-cal">
          <thead>
            <tr>
              <th scope="col" className="ln-cal-name">
                <span className="sr-only">Name</span>
              </th>
              {MONTH_NAMES.map((m, i) => (
                <th key={m} scope="col" className={i + 1 === now.month ? 'is-now' : ''}>
                  <abbr title={m}>{m.slice(0, 3)}</abbr>
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.id}>
              <tr className="ln-cal-group">
                <th colSpan={13} scope="colgroup">
                  {g.title}
                  {g.id === 'planets' && <span className="dim"> · positions for {now.year} only; planets move from year to year</span>}
                </th>
              </tr>
              {g.rows.map((r) => {
                const cls = classes.get(r.key);
                return (
                  <tr key={r.key}>
                    <th scope="row" className="ln-cal-name">
                      <Link to={r.href}>{r.name}</Link>
                      <span className="faint"> {r.sub}</span>
                    </th>
                    {MONTH_NAMES.map((m, i) => (
                      <td key={m} className={i + 1 === now.month ? 'is-now' : ''}>
                        {cls ? <i className={`ln-cal-cell is-${cls[i]}`} title={`${r.name}, ${m}: ${CLASS_SHORT[cls[i]].toLowerCase()}`} role="img" aria-label={CLASS_SHORT[cls[i]]} /> : <i className="ln-cal-cell is-pending" />}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
      <p className="dim ln-small ln-cal-foot">
        “Evening” means best before the middle of the night, “morning” after it, “all night” up for at least four fifths of the dark hours. A constellation counts as up when most of its main stars are at least 10° above the horizon in a dark sky.
      </p>
    </Page>
  );
}
