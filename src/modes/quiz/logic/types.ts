/** Question model shared by every quiz type. A session is just a list of these. */
import type { Catalog } from '@/data/catalog';
import type { ResolvedCourse } from '@/content/course';
import type { ConstellationContent, Lesson, PathUnit, Starhop } from '@/content/schema';
import type { Skill } from '@/store/progress';
import type { Observer, SkyImage } from '@/types';

interface QBase {
  /** Unique within a session (React key) */
  key: string;
  /** Progress item id, in the formats documented in src/store/progress.ts */
  itemId: string;
  skill: Skill;
  /** Constellation the item counts toward on the dashboard */
  con?: string;
  /** Short forms for the end-of-round summary */
  promptText: string;
  answerText: string;
}

/** Draw a loop around a constellation. `tonightTime` (epoch ms) = real sky tonight, alt-az, horizon shown. */
export interface FindQ extends QBase {
  kind: 'find';
  conId: string;
  tonightTime?: number;
}

/** A constellation is emphasised in the sky: pick or type its name. */
export interface NameQ extends QBase {
  kind: 'name';
  conId: string;
  /** Constellation ids, already shuffled; includes conId */
  choices: string[];
  typed: boolean;
}

/** Something is ringed in the sky: which one is it? */
export interface SkyObjQ extends QBase {
  kind: 'skyobj';
  /** TargetRef of the ringed object */
  ref: string;
  objKind: 'star' | 'dso' | 'planet';
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation?: string;
  /** Vertical field of view to start with */
  fov: number;
  /** Planets: epoch ms of the real sky to show (alt-az, horizon on) */
  tonightTime?: number;
}

/** Plain multiple choice, optionally with a picture. */
export interface McqQ extends QBase {
  kind: 'mcq';
  /** Small line above the prompt, e.g. "Orion · Orion and the scorpion" */
  context?: string;
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation?: string;
  image?: SkyImage;
}

/** Self-graded flashcard for one myth. */
export interface CardQ extends QBase {
  kind: 'card';
  conName: string;
  title: string;
  culture: string;
  summary: string;
  characters: string[];
}

/**
 * Star-hop "follow the hop": the start star(s) are ringed and the hop's instructions shown (target masked);
 * the learner clicks the star they land on. Item `hop:<id>` (skill 'object').
 */
export interface HopQ extends QBase {
  kind: 'hop';
  hopId: string;
  /** The hop's name, shown only after answering (it usually names the target) */
  title: string;
  /** Instructions as plain text with the target masked */
  steps: string[];
  /** Canonical refs of the ringed start star(s) */
  start: string[];
  /** Canonical refs along the hop, start first, target last */
  path: string[];
  /** Canonical ref of the point to click (the last path point) */
  target: string;
  /** Display name of where the hop leads */
  targetName: string;
  explanation: string;
}

export type Question = FindQ | NameQ | SkyObjQ | McqQ | CardQ | HopQ;

/** Everything question builders need. Plain data, so builders run in tests without a browser. */
export interface QuizData {
  catalog: Catalog;
  /** Constellation pages that exist so far (may be a small subset of the 88) */
  content: ConstellationContent[];
  lessons: Lesson[];
  /** Legacy path units (only for old `unit:` pool specs) */
  units: PathUnit[];
  observer: Observer;
  now: Date;
  /** The course resolved for `observer` (src/content/course.ts); absent in some tests */
  course?: ResolvedCourse;
  /** The star-hop library (src/content/starhops.json) */
  hops?: Starhop[];
}

export type SessionLength = 5 | 10 | 20 | 'all';
