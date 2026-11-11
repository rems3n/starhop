import { Link } from 'react-router-dom';
import { asterisms } from '@/content';
import { MONTH_NAMES } from '@/lib/time';
import { Chip } from '@/ui';
import { Check, Page } from '../components/common';
import { useLearnLocal } from '../hooks';

const SEASON_WORD = { winter: 'Winter', spring: 'Spring', summer: 'Summer', autumn: 'Autumn', 'all-year': 'All year' } as const;

export default function SignpostsPage() {
  const seen = useLearnLocal((s) => s.asterismsSeen);
  const signposts = asterisms.filter((a) => a.signpost);
  const others = asterisms.filter((a) => !a.signpost);
  return (
    <Page>
      <header className="ln-head">
        <h1>Seasonal signposts</h1>
        <p className="ln-lede">Five big, bright patterns, one for every season and one for all year. Learn each one and the lines that lead from it, and you can find your way to everything else.</p>
      </header>
      <ul className="ln-sign-grid">
        {signposts.map((a) => (
          <li key={a.id}>
            <Link to={`/learn/signpost/${a.id}`} className="card ln-sign-card">
              <div className="ln-unit-top">
                <strong className="ln-unit-title">{a.name}</strong>
                <Chip tone="amber">{SEASON_WORD[a.season]}</Chip>
              </div>
              <p className="dim ln-small">{a.summary}</p>
              <span className="ln-small">
                {a.hops.length} hops · best in {a.bestMonths.map((m) => MONTH_NAMES[m - 1].slice(0, 3)).join(', ')}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <section className="ln-section">
        <h3>Other star patterns</h3>
        <p className="dim">Asterisms: well-known shapes that are not official constellations.</p>
        <ol className="ln-checklist">
          {others.map((a) => (
            <li key={a.id}>
              <Link to={`/learn/signpost/${a.id}`} className="ln-step">
                <Check done={!!seen[a.id]} />
                <span className="grow">
                  <strong>{a.name}</strong>
                  <span className="dim ln-step-sub">{a.summary}</span>
                </span>
                <span className="dim ln-nowrap">{SEASON_WORD[a.season]}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </Page>
  );
}
