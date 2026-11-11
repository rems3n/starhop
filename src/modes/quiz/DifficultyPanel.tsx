import { useMemo } from 'react';
import { DIFFICULTY_PRESETS, useSettings } from '@/store/settings';
import { Slider, Switch } from '@/ui';
import { matchingPreset, PRESET_LABEL, PRESET_NAMES, starCount } from './logic/difficulty';
import { poolOptions } from './logic/pools';
import { courseGroups } from './logic/sessions';
import type { QuizData } from './logic/types';

/** Every difficulty setting on its own, plus one-tap presets. Shows which preset matches, or "Custom". */
export function DifficultyPanel({ data }: { data: QuizData }) {
  const d = useSettings((s) => s.difficulty);
  const set = useSettings((s) => s.setDifficulty);
  const mags = useMemo(() => data.catalog.stars.map((s) => s.mag), [data.catalog]);
  const preset = matchingPreset(d);
  const groups = useMemo(() => poolOptions({ units: data.units, groups: courseGroups(data) }), [data]);
  return (
    <section className="card qz-diff" aria-label="Difficulty" data-testid="difficulty">
      <div className="qz-diff-head">
        <h4>Difficulty</h4>
        <span className="dim" data-testid="preset-name">{preset ? PRESET_LABEL[preset] : 'Custom'}</span>
      </div>
      <div className="segmented qz-presets" role="group" aria-label="Presets">
        {PRESET_NAMES.map((name) => (
          <button key={name} type="button" aria-pressed={preset === name} onClick={() => set(DIFFICULTY_PRESETS[name])} data-preset={name}>
            {PRESET_LABEL[name]}
          </button>
        ))}
      </div>
      <label className="field">
        <span className="qz-diff-row">
          <span>Faintest stars shown: magnitude {d.limitingMag.toFixed(1)}</span>
          <span className="faint">{starCount(mags, d.limitingMag).toLocaleString()} stars</span>
        </span>
        <Slider label="Faintest star magnitude" min={3} max={6.5} step={0.1} value={d.limitingMag} onChange={(v) => set({ limitingMag: Math.round(v * 10) / 10 })} />
        <span className="faint qz-diff-note">Lower = a city sky with only the bright stars. Higher = a dark sky, with many more stars to sort through.</span>
      </label>
      <label className="field">
        <span>Constellations to ask about</span>
        <select className="select" value={d.pool} onChange={(e) => set({ pool: e.target.value })} data-testid="pool">
          {groups.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="qz-diff-switches">
        <Switch checked={d.lines} onChange={(lines) => set({ lines })} label="Constellation lines" />
        <Switch checked={d.boundaries} onChange={(boundaries) => set({ boundaries })} label="Boundaries" />
        <Switch checked={d.labels} onChange={(labels) => set({ labels })} label="Name labels" />
        <Switch checked={d.randomRotation} onChange={(randomRotation) => set({ randomRotation })} label="Random sky rotation" />
        <Switch checked={d.startNearTarget} onChange={(startNearTarget) => set({ startNearTarget })} label="Start near the target" />
        <Switch checked={d.timer} onChange={(timer) => set({ timer })} label="Countdown timer" />
      </div>
    </section>
  );
}
