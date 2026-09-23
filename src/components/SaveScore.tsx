import { useState } from 'react';
import type { PresetId } from '../presets';
import { submitScore, type SubmitResult } from '../leaderboard/api';
import { loadLastName, saveLastName } from '../leaderboard/playerName';
import { LeaderboardTable } from './LeaderboardTable';

interface Props {
  presetId: PresetId;
  points: number;
}

export function SaveScore({ presetId, points }: Props) {
  const [name, setName] = useState(loadLastName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setSaving(true);
    setError(null);
    try {
      setResult(await submitScore(presetId, trimmed, points));
      saveLastName(trimmed);
    } catch {
      setError('Nepavyko išsaugoti – ar serveris įjungtas?');
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <div className="save-score">
        <p className="placement">
          {result.improved
            ? `Tu užėmei ${result.rank} vietą iš ${result.total}! Taškai: ${points}`
            : `Tavo geriausias rezultatas – ${result.best.points} taškų, ${result.rank} vieta iš ${result.total}.`}
        </p>
        <LeaderboardTable entries={result.entries} highlightName={result.best.name} />
      </div>
    );
  }

  return (
    <form className="save-score" onSubmit={handleSubmit}>
      <p className="hint">Įrašyk savo vardą į lyderių lentelę (taškai: {points})</p>
      <div className="name-row">
        <input
          className="name-input"
          aria-label="Vardas"
          maxLength={20}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tavo vardas"
        />
        <button className="primary" type="submit" disabled={saving || !name.trim()}>
          Išsaugoti
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
