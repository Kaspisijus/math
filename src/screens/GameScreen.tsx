import type { Step } from '../types';
import { NextButton } from '../components/NextButton';
import { ProgressBar } from '../components/ProgressBar';
import { formatStep } from '../formatStep';

interface Props {
  currentStep: Step;
  secondsRemaining: number;
  durationSeconds: number;
  onNext: () => void;
  confirmingCancel: boolean;
  onRequestCancel: () => void;
  onDismissCancel: () => void;
  onConfirmCancel: () => void;
}

export function GameScreen({
  currentStep,
  secondsRemaining,
  durationSeconds,
  onNext,
  confirmingCancel,
  onRequestCancel,
  onDismissCancel,
  onConfirmCancel,
}: Props) {
  return (
    <div className="card game-card">
      <button
        type="button"
        className="cancel-button"
        aria-label="Nutraukti (Esc)"
        title="Nutraukti (Esc)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onRequestCancel}
      >
        ✕
      </button>
      <ProgressBar
        secondsRemaining={secondsRemaining}
        durationSeconds={durationSeconds}
        label="Raundo laikas"
      />
      <div className="operation-display">{formatStep(currentStep)}</div>
      <NextButton onClick={onNext} />

      {confirmingCancel && (
        <div className="confirm-overlay">
          <div
            className="confirm-box"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-cancel-title"
            aria-describedby="confirm-cancel-text"
          >
            <h2 id="confirm-cancel-title">Nutraukti raundą?</h2>
            <p id="confirm-cancel-text" className="hint">
              Šis raundas nebus įskaičiuotas.
            </p>
            <div className="button-row">
              {/* The safe choice gets focus, so stray SPACE/Enter presses keep playing. */}
              <button type="button" className="primary" autoFocus onClick={onDismissCancel}>
                Ne, tęsti
              </button>
              <button type="button" className="danger" onClick={onConfirmCancel}>
                Taip, nutraukti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
