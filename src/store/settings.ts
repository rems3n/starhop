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
  /** What the sky map opens with each visit (Profile → Sky map defaults). `layers` and `bortle` are this visit's values. */
  defaultLayers: LayerState;
  defaultBortle: number;
  setObserver: (o: Observer) => void;
  setBortle: (n: number) => void;
  setLayers: (patch: Partial<LayerState>) => void;
  setRedMode: (on: boolean) => void;
  setDifficulty: (patch: Partial<QuizDifficulty>) => void;
  setDefaultLayers: (patch: Partial<LayerState>) => void;
  setDefaultBortle: (n: number) => void;
  /** Make the current sky layers and light pollution the defaults */
  saveSkyAsDefault: () => void;
}

const clampBortle = (n: number) => Math.min(9, Math.max(1, Math.round(n)));

/** Each visit starts from the saved defaults (also used when an account's settings arrive from the server). */
export function withDefaults(s: SettingsState): SettingsState {
  const defaultLayers = { ...DEFAULT_LAYERS, ...(s.defaultLayers ?? s.layers) };
  const defaultBortle = clampBortle(s.defaultBortle ?? s.bortle ?? 6);
  return { ...s, defaultLayers, defaultBortle, layers: { ...defaultLayers }, bortle: defaultBortle };
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
      defaultLayers: DEFAULT_LAYERS,
      defaultBortle: 6,
      setObserver: (observer) => set({ observer, locationChosen: true }),
      setBortle: (bortle) => set({ bortle: clampBortle(bortle) }),
      setLayers: (patch) => set((s) => ({ layers: { ...s.layers, ...patch } })),
      setRedMode: (redMode) => set({ redMode }),
      setDifficulty: (patch) => set((s) => ({ difficulty: { ...s.difficulty, ...patch } })),
      setDefaultLayers: (patch) => set((s) => ({ defaultLayers: { ...s.defaultLayers, ...patch }, layers: { ...s.layers, ...patch } })),
      setDefaultBortle: (n) => set({ defaultBortle: clampBortle(n), bortle: clampBortle(n) }),
      saveSkyAsDefault: () => set((s) => ({ defaultLayers: { ...s.layers }, defaultBortle: s.bortle })),
    }),
    {
      name: 'starhop.settings.v1',
      version: 2,
      // v1 kept only the last-used layers and light pollution: they become the defaults.
      migrate: (old, version) => {
        const s = (old ?? {}) as Partial<SettingsState>;
        if (version < 2) return { ...s, defaultLayers: { ...DEFAULT_LAYERS, ...s.layers }, defaultBortle: s.bortle ?? 6 } as SettingsState;
        return s as SettingsState;
      },
      merge: (persisted, current) => withDefaults({ ...current, ...((persisted ?? {}) as Partial<SettingsState>) }),
    },
  ),
);
