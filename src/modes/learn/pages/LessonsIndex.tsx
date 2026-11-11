import { Link } from 'react-router-dom';
import { lessons } from '@/content';
import { useProgress } from '@/store/progress';
import { Check, Page } from '../components/common';

export const LESSON_UNITS: { id: 'skills' | 'motion' | 'ecliptic' | 'objects'; title: string; blurb: string }[] = [
  { id: 'skills', title: 'Practical skills', blurb: 'What to do with your eyes, hands and feet once you are outside.' },
  { id: 'motion', title: 'How the sky moves', blurb: 'Why the stars wheel overnight, shift with the seasons and change with latitude.' },
  { id: 'ecliptic', title: 'The Sun’s road: planets, Moon, eclipses, meteors', blurb: 'Everything that wanders happens along one line.' },
  { id: 'objects', title: 'What you are looking at', blurb: 'Stars, clusters, nebulae, galaxies and planets, with real examples to visit.' },
];

export default function LessonsIndex() {
  const done = useProgress((s) => s.lessonsDone);
  return (
    <Page>
      <header className="ln-head">
        <h1>Lessons</h1>
        <p className="ln-lede">Short lessons of three to eight minutes, each with a live sky to play with and a few questions at the end.</p>
      </header>
      {LESSON_UNITS.map((u) => {
        const list = lessons.filter((l) => l.unit === u.id);
        return (
          <section key={u.id} className="ln-section">
            <h3>{u.title}</h3>
            <p className="dim">{u.blurb}</p>
            {!list.length && <p className="dim">No lessons here yet.</p>}
            <ol className="ln-checklist">
              {list.map((l) => (
                <li key={l.id}>
                  <Link to={`/learn/lesson/${l.id}`} className="ln-step">
                    <Check done={!!done[l.id]} />
                    <span className="grow">
                      <strong>{l.title}</strong>
                      <span className="dim ln-step-sub">{l.subtitle}</span>
                    </span>
                    <span className="dim ln-nowrap">{l.minutes} min</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </Page>
  );
}
