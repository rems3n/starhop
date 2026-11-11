/**
 * What the eye sees vs what a camera records, for the Orion Nebula. Left: a simulated eyepiece view (grey, only
 * the bright core, because in dim light only the colour-blind rods respond). Right: the same photo as a camera
 * would record it, brightening with exposure time. Both are simulations made by filtering one real photograph;
 * the figure says so.
 */
import { useId, useState } from 'react';
import { C, ChoiceControl, Controls, Label, RangeControl, Readout, Svg, type DiagramMeta, type DiagramProps } from '../kit';
import { imgUrl } from './objects-lib';

export const meta: DiagramMeta = {
  title: 'Your eye vs a camera',
  summary: 'The Orion Nebula as the eye sees it in a telescope (grey core) beside a camera exposure you can lengthen until the red and blue appear.',
  params: { exposure: 'starting exposure index 0–5 (1/30 s, 1 s, 10 s, 1 min, 10 min, 1 h; default 2)' },
};

const EXPOSURES = [
  { label: '1/30 s', gain: 0.18 },
  { label: '1 second', gain: 0.45 },
  { label: '10 seconds', gain: 0.8 },
  { label: '1 minute', gain: 1.15 },
  { label: '10 minutes', gain: 1.6 },
  { label: '1 hour', gain: 2.1 },
];
const IMG = { file: 'img/M42-2.jpg', w: 960, h: 643, credit: 'Carsten Frenzl', license: 'CC BY 2.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Messier_42_-_The_Great_Orion_Nebula_-_Flickr_-_castro.pic.jpg' };

export default function EyeVsCamera({ params }: DiagramProps) {
  const id = useId().replace(/:/g, '');
  const [ex, setEx] = useState(typeof params?.exposure === 'number' ? Math.min(5, Math.max(0, params.exposure as number)) : 2);
  const [sky, setSky] = useState<'dark' | 'city'>('dark');
  const e = EXPOSURES[ex];
  const glow = sky === 'city' ? 0.16 : 0.03; // sky background added before the eye's threshold / camera's stretch
  // image boxes (keep the photo's 3:2 aspect)
  const W = 320, H = (W * IMG.h) / IMG.w;
  const L = { x: 24, y: 64 }, Rr = { x: 376, y: 64 };

  return (
    <div>
      <Svg w={720} h={340} title={meta.title} desc="Two versions of one photograph of the Orion Nebula. Left, as the eye sees it through a small telescope: a grey, fan-shaped glow around a few stars, with the faint outer parts invisible. Right, as a camera records it: with longer exposures the nebula brightens and its red and pink colours appear.">
        <defs>
          <filter id={`${id}eye`} colorInterpolationFilters="sRGB">
            <feColorMatrix type="saturate" values="0.06" />
            <feComponentTransfer>
              <feFuncR type="linear" slope={1.5} intercept={glow - 0.42} />
              <feFuncG type="linear" slope={1.5} intercept={glow - 0.42} />
              <feFuncB type="linear" slope={1.5} intercept={glow - 0.42} />
            </feComponentTransfer>
            <feGaussianBlur stdDeviation="0.8" />
          </filter>
          <filter id={`${id}cam`} colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncR type="linear" slope={e.gain} intercept={glow * e.gain - 0.05} />
              <feFuncG type="linear" slope={e.gain} intercept={glow * e.gain - 0.05} />
              <feFuncB type="linear" slope={e.gain} intercept={glow * e.gain * 1.1 - 0.05} />
            </feComponentTransfer>
          </filter>
          <clipPath id={`${id}ep`}><ellipse cx={L.x + W / 2} cy={L.y + H / 2} rx={W / 2} ry={H / 2 + 6} /></clipPath>
          <clipPath id={`${id}fr`}><rect x={Rr.x} y={Rr.y} width={W} height={H} rx={6} /></clipPath>
        </defs>
        <Label x={L.x + W / 2} y={34} anchor="middle" weight={700}>Your eye at the eyepiece</Label>
        <Label x={L.x + W / 2} y={52} anchor="middle" size="s" color={C.dim}>rods only: no colour, faint parts lost</Label>
        <Label x={Rr.x + W / 2} y={34} anchor="middle" weight={700}>A camera, {e.label}</Label>
        <Label x={Rr.x + W / 2} y={52} anchor="middle" size="s" color={C.dim}>collects light the whole time, in colour</Label>
        <rect x={L.x} y={L.y - 6} width={W} height={H + 12} fill="#000" clipPath={`url(#${id}ep)`} />
        <image href={imgUrl(IMG.file)} x={L.x} y={L.y} width={W} height={H} filter={`url(#${id}eye)`} clipPath={`url(#${id}ep)`} />
        <ellipse cx={L.x + W / 2} cy={L.y + H / 2} rx={W / 2} ry={H / 2 + 6} fill="none" stroke={C.lineStrong} />
        <rect x={Rr.x} y={Rr.y} width={W} height={H} rx={6} fill="#000" />
        <image href={imgUrl(IMG.file)} x={Rr.x} y={Rr.y} width={W} height={H} filter={`url(#${id}cam)`} clipPath={`url(#${id}fr)`} />
        <rect x={Rr.x} y={Rr.y} width={W} height={H} rx={6} fill="none" stroke={C.lineStrong} />
        <Label x={360} y={L.y + H + 34} anchor="middle" size="s" color={C.dim}>
          Both panels are simulations made by filtering one real photograph (80 mm telescope).
        </Label>
      </Svg>
      <Controls>
        <RangeControl label="Camera exposure" value={ex} min={0} max={5} onChange={setEx} format={(v) => EXPOSURES[v].label} />
        <ChoiceControl label="Sky" value={sky} options={[{ value: 'dark', label: 'Dark site' }, { value: 'city', label: 'City' }]} onChange={setSky} />
      </Controls>
      <Readout>
        {ex === 0
          ? 'In a thirtieth of a second, about what your eye takes in at once, even the camera records only a dim core. Your eye does no better, and in this dim light it sees in grey.'
          : ex <= 2
            ? `After ${e.label} the camera already shows more than your eye ever will: it keeps adding up light, while your eye starts afresh every fraction of a second.`
            : `A ${e.label} exposure brings out the faint outer clouds and the deep red of glowing hydrogen. That red is real, but too dim for the colour-sensing cones in your eye.`}
        {sky === 'city' ? ' Under city skyglow the faint outer parts are lost for both, though the bright core still shows.' : ''}
      </Readout>
      <p className="fig-credit">
        Photo: Orion Nebula through an 80 mm refractor (DSLR colour with added hydrogen-alpha), {IMG.credit}, {IMG.license},{' '}
        <a href={IMG.sourceUrl} target="_blank" rel="noreferrer">source</a>. Filtered here to simulate eye and camera.
      </p>
    </div>
  );
}
