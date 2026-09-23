import { useState } from 'react';
import { ANSWER_DURATION_SECONDS } from '../types';
import { CUSTOM_PRESET_ID, type PresetId } from '../presets';
import { SaveScore } from '../components/SaveScore';
import { ProgressBar } from '../components/ProgressBar';
import { useCountdown } from '../hooks/useCountdown';

export interface AnswerResult {
  // null when the answer time ran out before anything was typed.
  guess: number | null;
  isCorrect: boolean;
}

interface Props {
  presetId: PresetId;
  correctTotal: number;
  stepsCount: number;
  onSubmitted: (guess: number | null) => void;
  result: AnswerResult | null;
  onRewind: () => void;
  onNewRound: () => void;
}

function parseGuess(raw: string): number | null {
  if (raw.trim() === '') return null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

export function AnswerScreen({
  presetId,
  correctTotal,
  stepsCount,
  onSubmitted,
  result,
  onRewind,
  onNewRound,
}: Props) {
  const [guess, setGuess] = useState('');

  const secondsRemaining = useCountdown(
    ANSWER_DURATION_SECONDS,
    () => {
      if (!result) onSubmitted(parseGuess(guess));
    },
    null
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseGuess(guess);
    if (parsed === null) return;
    onSubmitted(parsed);
  }

  return (
    <div className="card">
      <h2>Laikas baigėsi! Koks galutinis rezultatas?</h2>
      <p className="steps-count">Iš viso peržiūrėjai {stepsCount} skaičių</p>

      {!result && (
        <form onSubmit={handleSubmit}>
          <ProgressBar
            secondsRemaining={secondsRemaining}
            durationSeconds={ANSWER_DURATION_SECONDS}
            label="Laikas atsakymui"
          />
          <input
            className="answer-input"
            type="number"
            autoFocus
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="Tavo atsakymas"
          />
          <button className="primary" type="submit">
            Patikrinti
          </button>
        </form>
      )}

      {result && (
        <div className="result">
          {result.isCorrect ? (
            <p className="correct">🎉 Teisingai! Puikus darbas!</p>
          ) : result.guess === null ? (
            <p className="incorrect">
              Nespėjai atsakyti! Teisingas atsakymas buvo {correctTotal}.
            </p>
          ) : (
            <p className="incorrect">
              Beveik! Tu atsakei {result.guess}, o teisingas atsakymas buvo {correctTotal}.
            </p>
          )}
          {result.isCorrect && presetId !== CUSTOM_PRESET_ID && (
            <SaveScore presetId={presetId} points={stepsCount} />
          )}
          <div className="button-row">
            <button className="primary" onClick={onRewind}>
              Peržiūrėti iš naujo
            </button>
            <button onClick={onNewRound}>Naujas raundas</button>
          </div>
        </div>
      )}
    </div>
  );
}
