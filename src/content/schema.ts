/**
 * Schemas for all authored content. `npm run validate` checks every content file against these
 * and checks that every target reference resolves against the catalog.
 *
 * Text fields are plain text. Two inline conventions are rendered by <RichText>:
 *   [[<TargetRef>|label]]   → a "show in sky" link, e.g. [[star:Betelgeuse|Betelgeuse]], [[dso:M42|the Orion Nebula]]
 *   *emphasis*              → italics (use for titles of ancient works, Latin names)
 * No markdown headings, lists or HTML inside strings.
 */
import { z } from 'zod';

const ref = z.string().regex(/^(star|dso|con|body|asterism|radec|altaz|point):.+/, 'must be a TargetRef like "star:Vega"');
const para = z.string().min(1);
const equipment = z.enum(['naked-eye', 'binoculars', 'small-telescope', 'telescope']);

// ───────────── Multiple-choice question (stories, lessons, units) ─────────────
export const mcqSchema = z.object({
  /** Unique within its file, e.g. "q1" */
  id: z.string().min(1),
  prompt: z.string().min(8),
  /** Exactly 4 choices, each plausible */
  choices: z.array(z.string().min(1)).length(4),
  answerIndex: z.number().int().min(0).max(3),
  /** One or two sentences shown after answering */
  explanation: z.string().min(8),
});
export type Mcq = z.infer<typeof mcqSchema>;

// ───────────── Constellations: src/content/constellations/<Abbr>.json ─────────────
export const storySchema = z.object({
  /** "<Abbr>-<slug>", e.g. "Ori-scorpion" */
  id: z.string().regex(/^[A-Z][A-Za-z]{2}-[a-z0-9-]+$/),
  /** e.g. "Orion and the scorpion" */
  title: z.string().min(3),
  /** e.g. "Greek", "Roman", "Babylonian", "Egyptian" */
  culture: z.string().min(3),
  /** Which ancient source(s) this version comes from. Only sources you have confirmed in your reading. */
  ancientSources: z
    .array(
      z.object({
        author: z.string().min(2), // e.g. "Hyginus"
        work: z.string().min(2), // e.g. "Poetic Astronomy 2.34"
        date: z.string().optional(), // e.g. "2nd century CE"
      }),
    )
    .min(1),
  /** 2–3 sentences */
  summary: z.string().min(80).max(700),
  /** 4–8 paragraphs, original wording */
  retelling: z.array(para).min(4).max(8),
  /** A full version from a well-known source. Omit unless you verified the URL resolves. */
  link: z
    .object({
      site: z.string().min(2), // "Ian Ridpath's Star Tales" | "Theoi" | "Wikipedia" | ...
      label: z.string().min(2),
      url: z.string().url(),
    })
    .optional(),
  /** Named characters, for quizzes */
  characters: z.array(z.string()).default([]),
  /** 3–5 multiple-choice questions about the characters and events of THIS version */
  questions: z.array(mcqSchema).min(3).max(6),
});
export type Story = z.infer<typeof storySchema>;

export const constellationContentSchema = z.object({
  id: z.string().regex(/^[A-Z][A-Za-z]{2}$/),
  /** 'ancient' = one of Ptolemy's 48 (or carved from Argo Navis) or with a classical myth; 'modern' = named since 1500 */
  kind: z.enum(['ancient', 'modern']),
  origin: z.object({
    /** e.g. "Ptolemy (catalogued); much older Greek and Mesopotamian figure" or "Nicolas-Louis de Lacaille" */
    namedBy: z.string().min(2),
    /** e.g. "2nd century CE", "1756" */
    when: z.string().min(2),
    /** Who named it, when and why: 1–3 paragraphs. For modern constellations this is the whole "story". */
    history: z.array(para).min(1).max(4),
  }),
  /** One or two sentences: what the figure is and what it looks like in the sky */
  overview: z.string().min(60).max(600),
  /** Beginner directions: start from an anchor/signpost and star-hop. 1–2 paragraphs. Use [[...]] links. */
  howToFind: z.array(para).min(1).max(3),
  /** What the pattern actually looks like to the eye and how big it is (hand-widths), 1 paragraph */
  shape: z.string().min(40),
  mainStars: z
    .array(
      z.object({
        ref, // "star:Betelgeuse" or "star:α Ori"
        /** 1–2 sentences: colour, what it marks in the figure, anything notable */
        note: z.string().min(10),
      }),
    )
    .min(1)
    .max(8),
  notableObjects: z
    .array(
      z.object({
        ref, // "dso:M42", or a star ref for doubles/variables
        equip: equipment,
        note: z.string().min(10),
      }),
    )
    .max(8),
  /** Empty for modern constellations with no myth. NEVER invent a myth. */
  stories: z.array(storySchema),
  /** Optional short extras (name origin, records, cultural notes) */
  facts: z.array(z.string()).max(6).default([]),
});
export type ConstellationContent = z.infer<typeof constellationContentSchema>;

// ───────────── Lessons: src/content/lessons/<id>.json ─────────────
const layerPatch = z
  .object({
    constellationLines: z.boolean(),
    constellationBoundaries: z.boolean(),
    constellationNames: z.boolean(),
    starNames: z.boolean(),
    dsoMarkers: z.boolean(),
    planets: z.boolean(),
    ecliptic: z.boolean(),
    equatorialGrid: z.boolean(),
    azimuthalGrid: z.boolean(),
    horizon: z.boolean(),
    ground: z.boolean(),
    atmosphere: z.boolean(),
    milkyWay: z.boolean(),
  })
  .partial();

export const highlightSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('constellation'), id: z.string(), lines: z.boolean().optional(), boundary: z.boolean().optional(), label: z.boolean().optional(), color: z.string().optional() }),
  z.object({ type: z.literal('object'), ref, label: z.union([z.string(), z.boolean()]).optional(), color: z.string().optional() }),
  z.object({ type: z.literal('polyline'), points: z.array(ref).min(2), closed: z.boolean().optional(), label: z.string().optional(), dashed: z.boolean().optional(), color: z.string().optional() }),
  z.object({ type: z.literal('angle'), from: ref, to: ref, label: z.string().optional(), color: z.string().optional() }),
  z.object({ type: z.literal('circle'), center: ref, radiusDeg: z.number().positive(), label: z.string().optional(), color: z.string().optional() }),
  z.object({ type: z.literal('label'), at: ref, text: z.string(), color: z.string().optional() }),
  z.object({ type: z.literal('trail'), ref, from: z.string(), to: z.string(), stepHours: z.number().positive(), frame: z.enum(['stars', 'horizon']).optional(), dateLabels: z.boolean().optional(), color: z.string().optional() }),
]);

/**
 * When a demo step happens.
 *   "now"                         current real time
 *   "tonight HH:MM"               today's date in the observer's time zone at that local time
 *   "YYYY-MM-DD HH:MM"            that local date/time in the observer's time zone
 *   "month:<1-12> HH:MM"          the 15th of that month in the current year at that local time
 */
const timeSpec = z.string().regex(/^(now|tonight \d{2}:\d{2}|\d{4}-\d{2}-\d{2} \d{2}:\d{2}|month:\d{1,2} \d{2}:\d{2})$/);

export const demoStepSchema = z.object({
  /** 1–3 sentences telling the learner what to notice or try in this step */
  caption: z.string().min(10),
  /** "user" = the learner's saved location (default). Or a fixed place for latitude demos. */
  observer: z.union([z.literal('user'), z.object({ name: z.string(), lat: z.number(), lon: z.number(), tz: z.string() })]).optional(),
  time: timeSpec.optional(),
  /** Simulated seconds per real second once the step starts (e.g. 600 = 10 min/s). 0/omitted = frozen. */
  rate: z.number().optional(),
  view: z
    .object({
      /** Centre the view on this target… */
      target: ref.optional(),
      /** …or on explicit az/alt (altaz mount) */
      az: z.number().optional(),
      alt: z.number().optional(),
      fov: z.number().min(1).max(160).optional(),
      mount: z.enum(['altaz', 'equatorial']).optional(),
    })
    .optional(),
  layers: layerPatch.optional(),
  /** Bortle class 1–9 → limiting magnitude */
  bortle: z.number().int().min(1).max(9).optional(),
  highlights: z.array(highlightSchema).optional(),
});
export type DemoStep = z.infer<typeof demoStepSchema>;

export const demoSchema = z.object({
  title: z.string().min(3),
  /** Extra controls shown under the sky view so the learner can play */
  controls: z.array(z.enum(['play', 'time-scrub', 'date-step', 'month-step', 'latitude', 'bortle'])).default([]),
  steps: z.array(demoStepSchema).min(1).max(8),
});
export type Demo = z.infer<typeof demoSchema>;

export const lessonSchema = z.object({
  /** kebab-case, e.g. "dark-adaptation" */
  id: z.string().regex(/^[a-z0-9-]+$/),
  /** skills = practical skills, motion = how the sky moves, ecliptic = ecliptic/planets/Moon/eclipses/meteors, objects = 2d object lessons */
  unit: z.enum(['skills', 'motion', 'ecliptic', 'objects']),
  order: z.number().int(),
  title: z.string().min(3),
  /** One line under the title */
  subtitle: z.string().min(10),
  minutes: z.number().int().min(1).max(15),
  sections: z
    .array(
      z.object({
        heading: z.string().optional(),
        body: z.array(para).min(1),
        demo: demoSchema.optional(),
        /** "Try it outside tonight" style practical tip */
        tryIt: z.string().optional(),
      }),
    )
    .min(1),
  keyPoints: z.array(z.string()).min(2).max(6),
  /** For objects lessons: real examples the learner can jump to in the sky view */
  examples: z.array(z.object({ ref, label: z.string(), note: z.string() })).default([]),
  /** End-of-lesson practice; also feeds the sky-knowledge quiz pool */
  questions: z.array(mcqSchema).min(3).max(8),
});
export type Lesson = z.infer<typeof lessonSchema>;

// ───────────── Asterisms & signposts: src/content/asterisms.json ─────────────
export const asterismSchema = z.object({
  /** kebab-case, e.g. "summer-triangle" */
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  /** A seasonal signpost gets a full guide page */
  signpost: z.boolean(),
  season: z.enum(['winter', 'spring', 'summer', 'autumn', 'all-year']),
  /** Star refs joined in order to draw the figure. Several polylines allowed. */
  lines: z.array(z.array(ref).min(2)).min(1),
  closed: z.boolean().default(false),
  /** Constellations it touches */
  constellations: z.array(z.string()),
  /** 1–2 sentences */
  summary: z.string().min(30),
  /** How to spot the asterism itself */
  howToFind: z.array(para).min(1),
  /** Signposts only: hops from this asterism to other things */
  hops: z
    .array(
      z.object({
        /** e.g. "Arc to Arcturus" */
        title: z.string(),
        /** What you reach */
        to: ref,
        text: z.string().min(20),
        /** Drawn in the sky view while this hop is selected */
        highlights: z.array(highlightSchema).default([]),
      }),
    )
    .default([]),
  /** Best local evening months at mid-northern latitudes, 1–12 */
  bestMonths: z.array(z.number().int().min(1).max(12)),
});
export type Asterism = z.infer<typeof asterismSchema>;

// ───────────── Object blurbs: src/content/objects/*.json  (Record<TargetRef, ObjectBlurb>) ─────────────
export const objectBlurbSchema = z.object({
  /** 2–4 sentences: what it is physically and why it is interesting */
  about: z.string().min(40),
  /** 1–3 sentences of star-hop directions with [[...]] links */
  howToFind: z.string().min(20),
  /** What you will actually see with eye / binoculars / small telescope, 1–2 sentences */
  whatYouSee: z.string().min(20),
  /** Physical size in plain language, e.g. "about 24 light-years across" (omit if unknown) */
  physicalSize: z.string().optional(),
});
export type ObjectBlurb = z.infer<typeof objectBlurbSchema>;
export const objectBlurbFileSchema = z.record(ref, objectBlurbSchema);

// ───────────── Monthly guides: src/content/monthly.json (12 entries) ─────────────
export const monthlyGuideSchema = z.object({
  month: z.number().int().min(1).max(12),
  title: z.string(),
  /** 2–3 paragraphs for mid-northern latitudes (~40°N) describing the evening sky and how to tour it */
  intro: z.array(para).min(1).max(4),
  /** Constellation abbreviations best placed in the evening this month (authored highlight picks) */
  featured: z.array(z.string()).min(2),
  /** Bright stars to learn this month */
  stars: z.array(ref),
  /** Deep-sky picks */
  objects: z.array(z.object({ ref, equip: equipment, note: z.string() })),
  /** Which signpost asterism to start from (asterism id) */
  signpost: z.string().optional(),
  /** Short note for southern-hemisphere observers */
  southernNote: z.string().optional(),
});
export type MonthlyGuide = z.infer<typeof monthlyGuideSchema>;

// ───────────── Meteor showers: src/content/showers.json ─────────────
export const showerSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  /** Solar longitude (J2000, degrees) of maximum — the app converts this to a date each year */
  peakSolarLongitude: z.number().min(0).max(360),
  /** Typical activity window as MM-DD */
  activeFrom: z.string().regex(/^\d{2}-\d{2}$/),
  activeTo: z.string().regex(/^\d{2}-\d{2}$/),
  zhr: z.number(),
  radiant: z.object({ ra: z.number(), dec: z.number(), con: z.string() }),
  speedKmS: z.number(),
  parent: z.string(),
  /** 1–2 sentences for beginners */
  note: z.string(),
  source: z.string(),
});
export type MeteorShower = z.infer<typeof showerSchema>;

// ───────────── Guided path: src/content/path.json ─────────────
export const pathUnitSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  /** Stage 1 = anchors, 2 = seasons, 3 = far south */
  stage: z.number().int().min(1).max(3),
  blurb: z.string(),
  /** Lesson ids to read in this unit, in order */
  lessons: z.array(z.string()),
  /** Constellations learned in this unit */
  constellations: z.array(z.string()),
  /** Asterism ids learned in this unit */
  asterisms: z.array(z.string()),
});
export type PathUnit = z.infer<typeof pathUnitSchema>;
