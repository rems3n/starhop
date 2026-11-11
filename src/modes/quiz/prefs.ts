/** Quiz-only preferences (round length, sub-modes). Local to this mode; difficulty lives in the shared settings store. */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ObjectMode, StoryMode } from './logic/build';
import type { KnowledgeMode } from './logic/sessions';
import type { HopMode, HopSeason } from './logic/starhop';
import type { SessionLength } from './logic/types';

interface QuizPrefs {
  length: SessionLength;
  nameTyped: boolean;
  objectModes: Record<ObjectMode, boolean>;
  storyModes: Record<StoryMode, boolean>;
  storyScope: 'pool' | 'all';
  knowledgeModes: Record<KnowledgeMode, boolean>;
  lessonUnit: string;
  hopSeason: HopSeason;
  hopModes: Record<HopMode, boolean>;
  set: (patch: Partial<Omit<QuizPrefs, 'set'>>) => void;
}

export const useQuizPrefs = create<QuizPrefs>()(
  persist(
    (set) => ({
      length: 10,
      nameTyped: false,
      objectModes: { star: true, dso: true, image: true, type: true },
      storyModes: { mcq: true, which: true, card: false },
      storyScope: 'all',
      knowledgeModes: { computed: true, lessons: true },
      lessonUnit: 'all',
      hopSeason: 'now',
      hopModes: { click: true, mcq: true },
      set: (patch) => set(patch),
    }),
    { name: 'starhop.quiz.v1', version: 1 },
  ),
);
