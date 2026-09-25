import { useState } from 'react';
import type { Operation, Settings } from '../types';
import { CUSTOM_PRESET_ID, PRESETS, type PresetId } from '../presets';
import { LeaderboardPanel } from '../components/LeaderboardPanel';

interface Props {
  initialPresetId: PresetId;
  initialSettings: Settings;
  onStart: (settings: Settings, presetId: PresetId) => void;
}

interface OperationGroup {
  key: string;
  label: string;
  ops: Operation[];
}

const OPERATION_GROUPS: OperationGroup[] = [
  { key: 'additive', label: 'Sudėtis / Atimtis (+ / -)', ops: ['+', '-'] },
  { key: 'multiplicative', label: 'Daugyba / Dalyba (× / ÷)', ops: ['×', '÷'] },
];

const PRESET_OPTIONS = [
  ...PRESETS.map((p) => ({ id: p.id as PresetId, name: p.name })),
  { id: CUSTOM_PRESET_ID, name: 'Savi nustatymai' },
];

export function SettingsScreen({ initialPresetId, initialSettings, onStart }: Props) {
  const [presetId, setPresetId] = useState<PresetId>(initialPresetId);
  const [customSettings, setCustomSettings] = useState<Settings>(initialSettings);
  const [error, setError] = useState<string | null>(null);

  const preset = PRESETS.find((p) => p.id === presetId);
  const settings = preset ? preset.settings : customSettings;
  const locked = preset !== undefined;

  function selectPreset(id: PresetId) {
    // Custom starts from whatever was on screen, so tweaking a preset is one click away.
    if (id === CUSTOM_PRESET_ID && presetId !== CUSTOM_PRESET_ID) setCustomSettings(settings);
    setError(null);
    setPresetId(id);
  }

  function toggleGroup(ops: Operation[]) {
    setCustomSettings((prev) => {
      const isEnabled = ops.every((op) => prev.enabledOps.includes(op));
      const enabledOps = isEnabled
        ? prev.enabledOps.filter((op) => !ops.includes(op))
        : [...prev.enabledOps.filter((op) => !ops.includes(op)), ...ops];
      return { ...prev, enabledOps };
    });
  }

  function setGroupMax(ops: Operation[], value: number) {
    setCustomSettings((prev) => {
      const maxByOp = { ...prev.maxByOp };
      for (const op of ops) maxByOp[op] = value;
      return { ...prev, maxByOp };
    });
  }

  function handleStart() {
    if (settings.enabledOps.length === 0) {
      setError('Pasirink bent vieną veiksmą!');
      return;
    }
    if (settings.maxTotal < 1) {
      setError('Viršutinė riba turi būti bent 1.');
      return;
    }
    setError(null);
    onStart(settings, presetId);
  }

  return (
    <div className="card">
      <h1>Matematikos nuotykiai</h1>
      <p className="subtitle">Pasiruošk smagiems skaičiukų žaidimams!</p>

      <div className="preset-grid" role="radiogroup" aria-label="Lygis">
        {PRESET_OPTIONS.map((option) => (
          <label
            key={option.id}
            className={`preset-option${option.id === presetId ? ' selected' : ''}`}
          >
            <input
              type="radio"
              name="preset"
              value={option.id}
              checked={option.id === presetId}
              onChange={() => selectPreset(option.id)}
            />
            <span className="preset-name">{option.name}</span>
          </label>
        ))}
      </div>

      <fieldset className={locked ? 'locked' : undefined}>
        <legend>Veiksmai</legend>
        {OPERATION_GROUPS.map((group) => {
          const enabled = group.ops.every((op) => settings.enabledOps.includes(op));
          return (
            <div className="op-row" key={group.key}>
              <label>
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={locked}
                  onChange={() => toggleGroup(group.ops)}
                />
                {group.label}
              </label>
              <label className="max-label">
                maks.
                <input
                  type="number"
                  min={1}
                  value={settings.maxByOp[group.ops[0]]}
                  disabled={locked || !enabled}
                  onChange={(e) => setGroupMax(group.ops, Number(e.target.value) || 1)}
                />
              </label>
            </div>
          );
        })}
      </fieldset>

      <label className="row">
        Leisti sumai nukristi žemiau 0
        <input
          type="checkbox"
          checked={settings.allowNegative}
          disabled={locked}
          onChange={(e) =>
            setCustomSettings((prev) => ({ ...prev, allowNegative: e.target.checked }))
          }
        />
      </label>

      <label className="row">
        Viršutinė riba (didžiausia suma)
        <input
          type="number"
          min={1}
          value={settings.maxTotal}
          disabled={locked}
          onChange={(e) =>
            setCustomSettings((prev) => ({
              ...prev,
              maxTotal: Number(e.target.value),
            }))
          }
        />
      </label>

      {error && <p className="error">{error}</p>}

      <button className="primary" onClick={handleStart}>
        Pradėti!
      </button>

      <LeaderboardPanel presetId={presetId} />
    </div>
  );
}
