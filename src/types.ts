/**
 * Shared contracts. Every module codes against these types.
 * Angles are DEGREES unless a name says otherwise. RA is in degrees (0..360), not hours.
 * Catalog coordinates are J2000 / ICRS ("EQJ"). Azimuth: 0 = North, 90 = East.
 */

// ───────────────────────────── Catalog data (public/data/*.json) ─────────────────────────────

/** public/data/stars.json — Star[] sorted by ascending magnitude (brightest first), mag <= 6.5 */
export interface Star {
  /** HYG database id. Stable key used everywhere. */
  id: number;
  hip?: number;
  hd?: number;
  hr?: number;
  ra: number;
  dec: number;
  /** Apparent visual magnitude */
  mag: number;
  /** B−V colour index */
  bv?: number;
  /** Spectral type string, e.g. "M1-2Ia-Iab" */
  sp?: string;
  distLy?: number;
  absMag?: number;
  /** IAU proper name, e.g. "Betelgeuse" */
  name?: string;
  /** Bayer letter as unicode Greek, optionally with index, e.g. "α", "π3" */
  bayer?: string;
  flam?: number;
  /** IAU constellation abbreviation, e.g. "Ori" */
  con: string;
  /** Best short designation for display: "α Ori", "58 Ori", "HR 1234", "HIP 5678" */
  desig: string;
}

/** public/data/stars-faint.json — columnar, 6.5 < mag <= 7.6, sorted by ascending magnitude. Render-only. */
export interface FaintStars {
  ra: number[];
  dec: number[];
  mag: number[];
  /** B−V, 0.6 where unknown */
  bv: number[];
}

export type Season = 'winter' | 'spring' | 'summer' | 'autumn' | 'north-circumpolar' | 'far-south';

/** public/data/constellations.json — Constellation[88] */
export interface Constellation {
  /** IAU abbreviation, e.g. "Ori" (Serpens is one entry "Ser" with two boundary polygons) */
  id: string;
  /** Latin name, e.g. "Orion" */
  name: string;
  genitive: string;
  /** English meaning, e.g. "the Hunter" */
  english: string;
  /** Label anchor */
  ra: number;
  dec: number;
  areaSqDeg: number;
  /** Stick figure polylines, each a list of [ra, dec] */
  lines: [number, number][][];
  /** HYG ids of catalog stars the figure passes through, brightest first */
  figureStars: number[];
  /** Subset of figureStars used to score "find it" quizzes (see docs/DATA.md for the rule) */
  mainStars: number[];
  /** IAU boundary as closed polygons of [ra, dec], densified so straight segments look right */
  boundary: [number, number][][];
  /** HYG id of the brightest star */
  brightest: number;
  /**
   * Evening-sky season for mid-northern latitudes, from where the constellation culminates at ~9pm:
   * north-circumpolar if dec centre > +60, far-south if dec centre < -45, else by RA.
   */
  season: Season;
  hemisphere: 'N' | 'S';
  zodiac: boolean;
}

export type DsoType =
  | 'galaxy'
  | 'open-cluster'
  | 'globular-cluster'
  | 'emission-nebula'
  | 'reflection-nebula'
  | 'planetary-nebula'
  | 'supernova-remnant'
  | 'dark-nebula'
  | 'nebula'
  | 'cluster-with-nebula'
  | 'star-cloud'
  | 'double-star'
  | 'asterism'
  | 'other';

export type Equipment = 'naked-eye' | 'binoculars' | 'small-telescope' | 'telescope';

/** public/data/dsos.json — Dso[] sorted by ascending magnitude (unknown mag last) */
export interface Dso {
  /** Primary id without spaces: "M42", "NGC869", "IC434", "C14" only if no M/NGC/IC id exists */
  id: string;
  /** Common name, e.g. "Orion Nebula" */
  name?: string;
  messier?: number;
  caldwell?: number;
  /** Other designations, display form, e.g. ["NGC 1976"] */
  aka: string[];
  type: DsoType;
  /** e.g. Hubble type "SA(s)b" */
  typeDetail?: string;
  ra: number;
  dec: number;
  mag?: number;
  /** Major and minor axis in arcminutes */
  sizeArcmin?: [number, number];
  distLy?: number;
  con: string;
  /** Minimum equipment to see it under a reasonably dark sky (rule in docs/DATA.md) */
  equip: Equipment;
}

/** public/data/milkyway.json — brightness contours of the Milky Way; level 1 = faintest/outermost */
export interface MilkyWay {
  levels: { level: number; polygons: [number, number][][] }[];
}

export type ImageKind = 'photograph' | 'false-color' | 'artist-impression' | 'simulation';

/** public/data/images.json — Record<TargetRef, SkyImage[]>, files under public/img/ */
export interface SkyImage {
  /** Path relative to the site root, e.g. "img/M42-1.jpg" */
  file: string;
  title: string;
  kind: ImageKind;
  /** One line explaining the kind, e.g. "Visible-light colour composite" or "Infrared mapped to visible colours" */
  kindNote?: string;
  /** Telescope / instrument / spacecraft, e.g. "Hubble Space Telescope (ACS)" */
  telescope: string;
  credit: string;
  license: string;
  licenseUrl?: string;
  /** Page where the file and its licence are documented */
  sourceUrl: string;
  width: number;
  height: number;
}

// ───────────────────────────── Targets ─────────────────────────────

/**
 * A string reference to anything in the sky. Resolved by `resolveTarget` in src/data/catalog.ts.
 *   star:<HYG id> | star:<Proper name> | star:<Bayer/Flamsteed designation e.g. "α Ori", "alpha Ori", "58 Ori"> | star:HIP<n>
 *   dso:<id>            e.g. dso:M42, dso:NGC869, dso:C14 (Caldwell number also resolves)
 *   con:<Abbr>          e.g. con:Ori
 *   body:<Name>         Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune
 *   asterism:<id>       ids from src/content/asterisms.json
 *   radec:<raDeg>,<decDeg>
 *   altaz:<azDeg>,<altDeg>
 *   point:<zenith|north|south|east|west|ncp|scp>   (cardinal points are on the horizon; ncp/scp = celestial poles)
 */
export type TargetRef = string;

export type BodyId = 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars' | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune';

export interface Observer {
  name: string;
  /** North positive */
  lat: number;
  /** East positive */
  lon: number;
  /** IANA time zone used to display local times, e.g. "America/New_York" */
  tz: string;
  elevationM?: number;
}

export type SkyObjectKind = 'star' | 'dso' | 'body' | 'constellation' | 'asterism' | 'point';

/** A resolved target: where it is on the J2000 sphere at a given time (bodies move; altaz/points depend on time+place). */
export interface ResolvedTarget {
  kind: SkyObjectKind;
  /** Canonical ref, e.g. "star:27989" */
  ref: TargetRef;
  /** Display name, e.g. "Betelgeuse" */
  name: string;
  ra: number;
  dec: number;
  /** Suggested field of view (deg) to frame the object */
  fov?: number;
  star?: Star;
  dso?: Dso;
  constellation?: Constellation;
  body?: BodyId;
}

// ───────────────────────────── Sky engine (src/sky) ─────────────────────────────

export interface LayerState {
  constellationLines: boolean;
  constellationBoundaries: boolean;
  constellationNames: boolean;
  /** Illustrated figures (the bear, the hunter…) drawn faintly behind the stars */
  constellationArt: boolean;
  starNames: boolean;
  dsoMarkers: boolean;
  /** When zoomed in, load and show fainter stars (to magnitude ~11) and the full deep-sky catalogue, like a telescope */
  deepSky: boolean;
  planets: boolean;
  ecliptic: boolean;
  equatorialGrid: boolean;
  azimuthalGrid: boolean;
  /** Horizon line + cardinal direction letters */
  horizon: boolean;
  /** Opaque ground below the horizon */
  ground: boolean;
  /** Daylight/twilight sky glow; when on, stars wash out as the Sun rises */
  atmosphere: boolean;
  milkyWay: boolean;
}

export const DEFAULT_LAYERS: LayerState = {
  constellationLines: true,
  constellationBoundaries: false,
  constellationNames: true,
  constellationArt: false,
  starNames: true,
  dsoMarkers: true,
  deepSky: true,
  planets: true,
  ecliptic: false,
  equatorialGrid: false,
  azimuthalGrid: false,
  horizon: true,
  ground: true,
  atmosphere: true,
  milkyWay: true,
};

/**
 * Camera. In 'altaz' mount lon/lat are azimuth/altitude and "up" is the zenith (roll ignored).
 * In 'equatorial' mount lon/lat are RA/Dec, "up" is celestial north rotated by `roll` degrees.
 */
export interface ViewState {
  mount: 'altaz' | 'equatorial';
  lon: number;
  lat: number;
  roll: number;
  /** Vertical field of view in degrees */
  fov: number;
}

/** Things drawn on top of the sky to point something out. Used by Explore selection, lesson demos and quiz reveals. */
export type Highlight =
  | { type: 'constellation'; id: string; lines?: boolean; boundary?: boolean; label?: boolean; color?: string }
  | { type: 'object'; ref: TargetRef; label?: string | boolean; color?: string }
  | { type: 'polyline'; points: TargetRef[]; closed?: boolean; label?: string; dashed?: boolean; color?: string }
  /** Great-circle arc between two targets, labelled with the angular separation unless `label` is given */
  | { type: 'angle'; from: TargetRef; to: TargetRef; label?: string; color?: string }
  | { type: 'circle'; center: TargetRef; radiusDeg: number; label?: string; color?: string }
  | { type: 'label'; at: TargetRef; text: string; color?: string }
  /** Path of a target against the stars (planet loops) or across the local sky (frame 'horizon') between two instants */
  | { type: 'trail'; ref: TargetRef; from: string; to: string; stepHours: number; frame?: 'stars' | 'horizon'; dateLabels?: boolean; color?: string };

export interface PickedObject {
  kind: SkyObjectKind;
  ref: TargetRef;
  name: string;
}

export interface SkyEngineOptions {
  observer: Observer;
  time?: Date;
  /** Simulated seconds per real second. 0 = frozen, 1 = real time. */
  timeRate?: number;
  layers?: Partial<LayerState>;
  /** Faintest star magnitude drawn (before atmosphere/twilight effects) */
  limitingMag?: number;
  view?: Partial<ViewState>;
  /** 'navigate' = drag/zoom/click-select, 'lasso' = freehand drawing (two-finger/right-drag still pans), 'none' = static */
  inputMode?: 'navigate' | 'lasso' | 'none';
  /** Keep clock, limiting magnitude etc. but never show the selection marker (quizzes) */
  showSelection?: boolean;
}

export interface SkyEvents {
  ready: void;
  /** User clicked an object (or empty sky → null) in navigate mode */
  select: PickedObject | null;
  /** Throttled to ~10 Hz while the clock runs */
  time: Date;
  /** Throttled to ~10 Hz while the camera moves */
  view: ViewState;
  /** Finished freehand lasso, points in CSS pixels relative to the canvas top-left */
  lasso: { x: number; y: number }[];
}

/** Imperative handle to one sky view. Obtained from <SkyView onReady={...}/>. */
export interface SkyController {
  getTime(): Date;
  setTime(date: Date): void;
  getTimeRate(): number;
  setTimeRate(secondsPerSecond: number): void;
  getObserver(): Observer;
  setObserver(o: Observer): void;
  getLayers(): LayerState;
  setLayers(patch: Partial<LayerState>): void;
  getLimitingMag(): number;
  setLimitingMag(mag: number): void;
  getView(): ViewState;
  /** Jump immediately */
  setView(patch: Partial<ViewState>): void;
  /** Animated move so the target is centred. Keeps current mount. Resolves when the animation ends. */
  flyTo(target: TargetRef, opts?: { fov?: number; durationMs?: number }): Promise<void>;
  setHighlights(highlights: Highlight[]): void;
  /** Selection marker (also set internally when the user clicks). */
  setSelection(ref: TargetRef | null): void;
  setInputMode(mode: 'navigate' | 'lasso' | 'none'): void;
  /** Clear a finished lasso drawing from the screen */
  clearLasso(): void;
  /** Project a J2000 position to CSS pixels. `visible` is false when off-screen or (ground on) below the horizon. */
  project(ra: number, dec: number): { x: number; y: number; visible: boolean };
  unproject(x: number, y: number): { ra: number; dec: number } | null;
  /** CSS pixel size of the canvas */
  getSize(): { width: number; height: number };
  on<K extends keyof SkyEvents>(event: K, cb: (payload: SkyEvents[K]) => void): () => void;
  /** Frames per second averaged over the last second (for the perf overlay/tests) */
  getFps(): number;
  destroy(): void;
}

// ───────────────────────────── Astronomy results (src/astro) ─────────────────────────────

export interface BodyState {
  id: BodyId;
  /** J2000 equatorial, as seen from the observer */
  ra: number;
  dec: number;
  alt: number;
  az: number;
  mag: number;
  distAu: number;
  /** Illuminated fraction 0..1 */
  phase: number;
  /** Angular distance from the Sun, degrees */
  elongation: number;
  angularDiameterArcsec: number;
  /** IAU abbreviation of the constellation the body is in */
  con: string;
}

export interface MoonPhase {
  /** 0 = new, 90 = first quarter, 180 = full, 270 = last quarter */
  phaseAngle: number;
  illumination: number;
  name: 'New Moon' | 'Waxing Crescent' | 'First Quarter' | 'Waxing Gibbous' | 'Full Moon' | 'Waning Gibbous' | 'Last Quarter' | 'Waning Crescent';
}

export interface RiseSet {
  rise: Date | null;
  transit: Date | null;
  set: Date | null;
  transitAlt: number;
  circumpolar: boolean;
  neverRises: boolean;
}

export interface NightWindow {
  sunset: Date | null;
  sunrise: Date | null;
  /** Sun at −6°, −12°, −18° */
  civilDusk: Date | null;
  nauticalDusk: Date | null;
  astroDusk: Date | null;
  astroDawn: Date | null;
  nauticalDawn: Date | null;
  civilDawn: Date | null;
}

export type VisibilityClass = 'all-night' | 'evening' | 'morning' | 'not-visible';

export interface VisibilityInfo {
  cls: VisibilityClass;
  /** Hours the target spends usefully above the horizon while the sky is dark on that night */
  darkHours: number;
  /** Best time to look that night (highest while dark), or null */
  bestTime: Date | null;
  bestAlt: number;
  bestAz: number;
}

export interface TonightItem {
  ref: TargetRef;
  name: string;
  kind: SkyObjectKind;
  visibility: VisibilityInfo;
  rise?: Date | null;
  set?: Date | null;
  note?: string;
}

export type SkyEventKind =
  | 'opposition'
  | 'conjunction'
  | 'greatest-elongation'
  | 'meteor-shower'
  | 'lunar-eclipse'
  | 'solar-eclipse'
  | 'moon-phase'
  | 'equinox'
  | 'solstice';

export interface SkyEvent {
  kind: SkyEventKind;
  date: Date;
  title: string;
  /** Plain-language description incl. how/when to look from the observer's location */
  detail: string;
  /** Bodies / radiant involved, for "show in sky" */
  refs: TargetRef[];
  /** False when it happens below the horizon / in daylight for this observer */
  visibleHere: boolean;
}

// ───────────────────────────── Bortle scale ─────────────────────────────

export interface BortleClass {
  n: number;
  label: string;
  /** Naked-eye limiting magnitude used by the app */
  limitingMag: number;
  description: string;
}

export const BORTLE: BortleClass[] = [
  { n: 1, label: 'Excellent dark site', limitingMag: 7.6, description: 'Zodiacal light and the Milky Way cast faint shadows. Thousands of stars.' },
  { n: 2, label: 'Truly dark site', limitingMag: 7.3, description: 'Summer Milky Way highly structured. Airglow visible near the horizon.' },
  { n: 3, label: 'Rural sky', limitingMag: 6.8, description: 'Some light domes on the horizon. Milky Way still complex.' },
  { n: 4, label: 'Rural/suburban transition', limitingMag: 6.3, description: 'Light domes in several directions. Milky Way obvious but lacks detail.' },
  { n: 5, label: 'Suburban sky', limitingMag: 5.8, description: 'Milky Way washed out near the horizon, weak overhead.' },
  { n: 6, label: 'Bright suburban sky', limitingMag: 5.3, description: 'Milky Way only near the zenith. Sky glows grey-white near the horizon.' },
  { n: 7, label: 'Suburban/urban transition', limitingMag: 4.8, description: 'Milky Way invisible. The whole sky has a grey glow.' },
  { n: 8, label: 'City sky', limitingMag: 4.3, description: 'Only the brighter constellation stars. The sky glows orange-grey.' },
  { n: 9, label: 'Inner-city sky', limitingMag: 3.8, description: 'Only the Moon, planets and the brightest stars. Many constellations lose most of their figure.' },
];

export const DEFAULT_OBSERVER: Observer = { name: 'Brooklyn, NY', lat: 40.6782, lon: -73.9442, tz: 'America/New_York', elevationM: 10 };

/** The 15 anchor constellations the guided path starts with. */
export const ANCHORS = ['UMa', 'UMi', 'Cas', 'Ori', 'Tau', 'CMa', 'Gem', 'Leo', 'Boo', 'Vir', 'Sco', 'Lyr', 'Cyg', 'Aql', 'Peg'] as const;
