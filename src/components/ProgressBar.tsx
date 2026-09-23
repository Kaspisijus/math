interface Props {
  secondsRemaining: number;
  durationSeconds: number;
  label: string;
}

export function ProgressBar({ secondsRemaining, durationSeconds, label }: Props) {
  const elapsedFraction = 1 - secondsRemaining / durationSeconds;
  const percent = Math.min(100, Math.max(0, elapsedFraction * 100));

  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
    >
      <div className="progress-fill" style={{ width: `${percent}%` }} />
    </div>
  );
}
