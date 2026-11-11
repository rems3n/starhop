import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ImageKind, SkyImage } from '@/types';

/** The kind of picture is shown on every image so nobody mistakes an illustration for a photograph. */
export const IMAGE_KIND: Record<ImageKind, { label: string; cls: string }> = {
  photograph: { label: 'Photograph', cls: 'photo' },
  'false-color': { label: 'False colour', cls: 'false' },
  'artist-impression': { label: "Artist's impression", cls: 'art' },
  simulation: { label: 'Simulation', cls: 'sim' },
};

const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || './';
export function imageUrl(file: string): string {
  return /^(https?:)?\/\//.test(file) ? file : `${base}${file.replace(/^\.?\//, '')}`;
}

function KindBadge({ kind }: { kind: ImageKind }) {
  const k = IMAGE_KIND[kind] ?? IMAGE_KIND.photograph;
  return <span className={`obj-kind obj-kind--${k.cls}`}>{k.label}</span>;
}

function Lightbox({ images, index, onIndex, onClose }: { images: SkyImage[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const img = images[index];
  const many = images.length > 1;
  const step = useCallback((d: number) => onIndex((index + d + images.length) % images.length), [index, images.length, onIndex]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowRight' && many) step(1);
      else if (e.key === 'ArrowLeft' && many) step(-1);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [many, onClose, step]);
  if (!img) return null;
  return createPortal(
    <div className="obj-lightbox" role="dialog" aria-modal aria-label={img.title} onClick={onClose}>
      <figure className="obj-lightbox-fig" onClick={(e) => e.stopPropagation()}>
        <div className="obj-lightbox-stage">
          <img src={imageUrl(img.file)} alt={img.title} width={img.width} height={img.height} />
          {many && (
            <>
              <button type="button" className="obj-lightbox-nav obj-lightbox-nav--prev" aria-label="Previous image" onClick={() => step(-1)}>‹</button>
              <button type="button" className="obj-lightbox-nav obj-lightbox-nav--next" aria-label="Next image" onClick={() => step(1)}>›</button>
            </>
          )}
        </div>
        <figcaption className="obj-lightbox-cap">
          <div className="obj-lightbox-title">
            <strong>{img.title}</strong>
            {many && <span className="faint">{index + 1} of {images.length}</span>}
          </div>
          <p className="obj-lightbox-kind">
            <KindBadge kind={img.kind} />
            {img.kindNote && <span>{img.kindNote}</span>}
          </p>
          <dl className="obj-credit">
            <div><dt>Taken with</dt><dd>{img.telescope}</dd></div>
            <div><dt>Credit</dt><dd>{img.credit}</dd></div>
            <div>
              <dt>Licence</dt>
              <dd>
                {img.licenseUrl ? <a href={img.licenseUrl} target="_blank" rel="noreferrer noopener">{img.license}</a> : img.license}
                {' · '}
                <a href={img.sourceUrl} target="_blank" rel="noreferrer noopener">Source page</a>
              </dd>
            </div>
          </dl>
        </figcaption>
        <button type="button" className="btn btn--sm obj-lightbox-close" onClick={onClose} autoFocus>Close</button>
      </figure>
    </div>,
    document.body,
  );
}

/** Image gallery with kind label (photograph / false colour / artist's impression), telescope, credit and licence for each image. */
export function ImageGallery({ images, compact }: { images: SkyImage[]; compact?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  if (!images.length) return null;
  return (
    <div className={`obj-gallery${compact ? ' obj-gallery--compact' : ''}`}>
      <ul className="obj-gallery-grid">
        {images.map((img, i) => (
          <li key={img.file} className="obj-thumb">
            <button type="button" className="obj-thumb-btn" onClick={() => setOpen(i)} aria-label={`${img.title} — ${IMAGE_KIND[img.kind]?.label ?? 'Image'}. Open larger.`}>
              <img src={imageUrl(img.file)} alt="" loading="lazy" width={img.width} height={img.height} />
              <KindBadge kind={img.kind} />
            </button>
            <div className="obj-thumb-cap">
              {!compact && <span className="obj-thumb-title">{img.title}</span>}
              {!compact && img.kindNote && <span className="dim">{img.kindNote}</span>}
              <span className="faint">
                {img.telescope} · {img.credit} ·{' '}
                {img.licenseUrl ? <a href={img.licenseUrl} target="_blank" rel="noreferrer noopener">{img.license}</a> : img.license}
                {' · '}
                <a href={img.sourceUrl} target="_blank" rel="noreferrer noopener">source</a>
              </span>
            </div>
          </li>
        ))}
      </ul>
      {open != null && <Lightbox images={images} index={open} onIndex={setOpen} onClose={close} />}
    </div>
  );
}
