import type { Step } from '../types';
import { NextButton } from '../components/NextButton';
import { formatStep } from '../formatStep';

interface Props {
  history: Step[];
  index: number;
  isCorrect: boolean;
  guess: number | null;
  onNext: () => void;
  onNewRound: () => void;
}

export function RewindScreen({ history, index, isCorrect, guess, onNext, onNewRound }: Props) {
  const step = history[index];
  const isLast = index === history.length - 1;

  return (
    <div className="card game-card">
      <p className="hint">
        {index + 1} žingsnis iš {history.length}
      </p>
      <div key={index} className="operation-display">
        {formatStep(step)}
      </div>
      <div className="running-total">Bendra suma: {step.total}</div>

      {!isLast && <NextButton onClick={onNext} />}

      {isLast && (
        <div className="result">
          {isCorrect ? (
            <p className="correct">🎉 Tu atsakei {guess} — teisingai!</p>
          ) : guess === null ? (
            <p className="incorrect">
              Nespėjai atsakyti, teisingas atsakymas buvo {step.total}.
            </p>
          ) : (
            <p className="incorrect">
              Tu atsakei {guess}, o teisingas atsakymas buvo {step.total}.
            </p>
          )}
          <button className="primary" onClick={onNewRound}>
            Naujas raundas
          </button>
        </div>
      )}
    </div>
  );
}
