/** User settings, persisted to localStorage. Shared by all modes. */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_LAYERS, DEFAULT_OBSERVER, type LayerState, type Observer } from '@/types';

export interface QuizDifficulty {
  /** Faintest star shown */
  limitingMag: number;
  lines: boolean;
  boundaries: boolean;
  labels: boolean;
  /** true = sky randomly rotated, false = north up / horizon level */
  randomRotation: boolean;
  /** true = start centred near the target, false = anywhere */
  startNearTarget: boolean;
  /** 'anchors' | 'visible' | 'group:<module>/<group>' | 'season:<…>' | 'hemisphere:<N|S>' | 'tonight' | 'all' */
  pool: string;
  timer: boolean;
}

export const DIFFICULTY_PRESETS: Record<'easy' | 'medium' | 'hard' | 'expert', QuizDifficulty> = {
  easy: { limitingMag: 4.0, lines: true, boundaries: false, labels: false, randomRotation: false, startNearTarget: true, pool: 'anchors', timer: false },
  medium: { limitingMag: 4.8, lines: false, boundaries: false, labels: false, randomRotation: false, startNearTarget: true, pool: 'anchors', timer: false },
  hard: { limitingMag: 5.5, lines: false, boundaries: false, labels: false, randomRotation: false, startNearTarget: false, pool: 'visible', timer: true },
  expert: { limitingMag: 6.5, lines: false, boundaries: false, labels: false, randomRotation: true, startNearTarget: false, pool: 'all', timer: true },
};

interface SettingsState {
  observer: Observer;
  /** False until the learner has picked a location (first-run prompt) */
  locationChosen: boolean;
  /** Bortle class 1–9 used in Explore and as the default in lessons */
  bortle: number;
  layers: LayerState;
  /** Red night-vision mode for use outdoors */
  redMode: boolean;
  difficulty: QuizDifficulty;
  setObserver: (o: Observer) => void;
  setBortle: (n: number) => void;
  setLayers: (patch: Partial<LayerState>) => void;
  setRedMode: (on: boolean) => void;
  setDifficulty: (patch: Partial<QuizDifficulty>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      observer: DEFAULT_OBSERVER,
      locationChosen: false,
      bortle: 6,
      layers: DEFAULT_LAYERS,
      redMode: false,
      difficulty: DIFFICULTY_PRESETS.easy,
      setObserver: (observer) => set({ observer, locationChosen: true }),
      setBortle: (bortle) => set({ bortle: Math.min(9, Math.max(1, Math.round(bortle))) }),
      setLayers: (patch) => set((s) => ({ layers: { ...s.layers, ...patch } })),
      setRedMode: (redMode) => set({ redMode }),
      setDifficulty: (patch) => set((s) => ({ difficulty: { ...s.difficulty, ...patch } })),
    }),
    { name: 'starhop.settings.v1', version: 1 },
  ),
);
