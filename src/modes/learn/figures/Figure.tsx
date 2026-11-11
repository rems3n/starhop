/** Renders lesson figures (diagram | image | gallery) and the Bennett-style boxes: Think about it, Common misconception, Quick check. */
import { Component, Suspense, useState, type ReactNode } from 'react';
import type { Figure as FigureT, FigureImage, Mcq } from '@/content/schema';
import { McqQuestion, RichText } from '@/ui';
import { getDiagram } from './registry';
import './figures.css';

const base = import.meta.env.BASE_URL ?? './';
const KIND_LABEL: Record<FigureImage['kind'], string> = {
  photograph: 'Photograph',
  'false-color': 'False colour',
  micrograph: 'Micrograph',
  illustration: 'Illustration',
  'artist-impression': "Artist's impression",
  simulation: 'Simulation',
  chart: 'Chart',
};

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <div className="fig-missing">This diagram could not be drawn.</div> : this.props.children;
  }
}

function Credit({ img }: { img: FigureImage }) {
  return (
    <span className="fig-credit">
      <span className="fig-kind">{KIND_LABEL[img.kind]}</span>
      {img.kindNote && <> {img.kindNote}.</>} {img.credit} ·{' '}
      {img.licenseUrl ? (
        <a href={img.licenseUrl} target="_blank" rel="noreferrer">
          {img.license}
        </a>
      ) : (
        img.license
      )}{' '}
      ·{' '}
      <a href={img.sourceUrl} target="_blank" rel="noreferrer">
        source
      </a>
    </span>
  );
}

function Img({ img }: { img: FigureImage }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="fig-img-btn" onClick={() => setOpen(true)} aria-label={`Enlarge: ${img.alt}`}>
        <img src={`${base}${img.file}`} alt={img.alt} loading="lazy" />
      </button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)} role="dialog" aria-modal aria-label={img.alt}>
          <figure className="fig-lightbox" onClick={(e) => e.stopPropagation()}>
            <img src={`${base}${img.file}`} alt={img.alt} />
            <figcaption>
              <Credit img={img} />
            </figcaption>
            <button type="button" className="btn btn--sm fig-lightbox-close" onClick={() => setOpen(false)}>
              Close
            </button>
          </figure>
        </div>
      )}
    </>
  );
}

export function LessonFigure({ figure, onTarget }: { figure: FigureT; onTarget?: (ref: string) => void }) {
  let body: ReactNode;
  if (figure.type === 'diagram') {
    const D = getDiagram(figure.id);
    body = D ? (
      <Boundary>
        <Suspense fallback={<div className="fig-loading" />}>
          <D params={figure.params} />
        </Suspense>
      </Boundary>
    ) : (
      <div className="fig-missing">Diagram “{figure.id}” is not available.</div>
    );
  } else if (figure.type === 'image') {
    body = (
      <>
        <Img img={figure.image} />
        <Credit img={figure.image} />
      </>
    );
  } else {
    body = (
      <div className="fig-gallery" style={{ gridTemplateColumns: `repeat(${figure.images.length}, minmax(0, 1fr))` }}>
        {figure.images.map((img) => (
          <div key={img.file} className="fig-gallery-item">
            <Img img={img} />
            {img.label && <span className="fig-gallery-label">{img.label}</span>}
            <Credit img={img} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <figure className={`fig fig--${figure.type}`}>
      {body}
      <figcaption className="fig-caption">
        <RichText text={figure.caption} onTarget={onTarget} />
      </figcaption>
    </figure>
  );
}

export function ThinkAbout({ question, answer, onTarget }: { question: string; answer: string; onTarget?: (ref: string) => void }) {
  const [shown, setShown] = useState(false);
  return (
    <aside className="fig-box fig-box--think">
      <strong className="fig-box-title">Think about it</strong>
      <p>
        <RichText text={question} onTarget={onTarget} />
      </p>
      {shown ? (
        <p className="fig-box-answer">
          <RichText text={answer} onTarget={onTarget} />
        </p>
      ) : (
        <button type="button" className="btn btn--sm" onClick={() => setShown(true)}>
          Show an answer
        </button>
      )}
    </aside>
  );
}

export function Misconception({ myth, fact, onTarget }: { myth: string; fact: string; onTarget?: (ref: string) => void }) {
  return (
    <aside className="fig-box fig-box--myth">
      <strong className="fig-box-title">Common misconception</strong>
      <p className="fig-myth">
        <RichText text={myth} onTarget={onTarget} />
      </p>
      <p>
        <RichText text={fact} onTarget={onTarget} />
      </p>
    </aside>
  );
}

export function QuickCheck({ question }: { question: Mcq }) {
  return (
    <aside className="fig-box fig-box--check">
      <strong className="fig-box-title">Quick check</strong>
      <McqQuestion question={question} />
    </aside>
  );
}
