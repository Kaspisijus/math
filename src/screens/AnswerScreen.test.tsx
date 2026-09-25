import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { AnswerScreen, type AnswerResult } from './AnswerScreen';
import { submitScore, type SubmitResult } from '../leaderboard/api';
import type { PresetId } from '../presets';

const CORRECT_TOTAL = 7;

vi.mock('../leaderboard/api', () => ({
  submitScore: vi.fn(),
  fetchLeaderboard: vi.fn(),
}));

const submitScoreMock = vi.mocked(submitScore);

function renderAnswer(presetId: PresetId, isCorrect = true) {
  render(
    <AnswerScreen
      presetId={presetId}
      correctTotal={CORRECT_TOTAL}
      stepsCount={23}
      onSubmitted={vi.fn()}
      result={{ guess: isCorrect ? 7 : 3, isCorrect }}
      onRewind={vi.fn()}
      onNewRound={vi.fn()}
    />
  );
}

function resultWith(overrides: Partial<SubmitResult>): SubmitResult {
  return {
    entries: [
      { name: 'Tėtis', points: 30, achievedAt: 1 },
      { name: 'Ona', points: 23, achievedAt: 2 },
    ],
    rank: 2,
    total: 2,
    improved: true,
    best: { name: 'Ona', points: 23, achievedAt: 2 },
    ...overrides,
  };
}

beforeEach(() => {
  submitScoreMock.mockReset();
  localStorage.clear();
});

describe('AnswerScreen leaderboard entry', () => {
  it('offers a name form pre-filled with the last name used after a correct answer', () => {
    localStorage.setItem('math-game:last-player-name', 'Ona');
    renderAnswer('wizard');

    expect(screen.getByLabelText('Vardas')).toHaveValue('Ona');
    expect(screen.getByText(/taškai: 23/)).toBeInTheDocument();
  });

  it('submits the round\'s points and shows the placement with the player highlighted', async () => {
    const user = userEvent.setup();
    submitScoreMock.mockResolvedValue(resultWith({}));
    renderAnswer('wizard');

    await user.type(screen.getByLabelText('Vardas'), 'Ona');
    await user.click(screen.getByRole('button', { name: 'Išsaugoti' }));

    expect(submitScoreMock).toHaveBeenCalledWith('wizard', 'Ona', 23);
    expect(await screen.findByText('Tu užėmei 2 vietą iš 2! Taškai: 23')).toBeInTheDocument();
    const highlighted = screen.getByRole('row', { current: true });
    expect(highlighted).toHaveTextContent('Ona');
    expect(localStorage.getItem('math-game:last-player-name')).toBe('Ona');
  });

  it('tells the player their earlier best stands when the new score is lower', async () => {
    const user = userEvent.setup();
    submitScoreMock.mockResolvedValue(
      resultWith({ improved: false, rank: 1, best: { name: 'Ona', points: 40, achievedAt: 1 } })
    );
    renderAnswer('ant');

    await user.type(screen.getByLabelText('Vardas'), 'Ona');
    await user.click(screen.getByRole('button', { name: 'Išsaugoti' }));

    expect(
      await screen.findByText('Tavo geriausias rezultatas – 40 taškų, 1 vieta iš 2.')
    ).toBeInTheDocument();
  });

  it('shows an error when saving fails and lets the player retry', async () => {
    const user = userEvent.setup();
    submitScoreMock.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(resultWith({}));
    renderAnswer('ant');

    await user.type(screen.getByLabelText('Vardas'), 'Ona');
    await user.click(screen.getByRole('button', { name: 'Išsaugoti' }));
    expect(await screen.findByText(/Nepavyko išsaugoti/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Išsaugoti' }));
    expect(await screen.findByText(/Tu užėmei 2 vietą/)).toBeInTheDocument();
    expect(submitScoreMock).toHaveBeenCalledTimes(2);
  });

  it('does not allow saving a blank name', async () => {
    const user = userEvent.setup();
    renderAnswer('ant');

    await user.type(screen.getByLabelText('Vardas'), '   ');
    expect(screen.getByRole('button', { name: 'Išsaugoti' })).toBeDisabled();
  });

  it('offers no leaderboard entry for a wrong answer', () => {
    renderAnswer('ant', false);
    expect(screen.queryByLabelText('Vardas')).not.toBeInTheDocument();
  });

  it('offers no leaderboard entry for custom settings', () => {
    renderAnswer('custom');
    expect(screen.queryByLabelText('Vardas')).not.toBeInTheDocument();
  });

  it('asks for confirmation before leaving a correct unsaved leaderboard result', async () => {
    const user = userEvent.setup();
    const onNewRound = vi.fn();
    render(
      <AnswerScreen
        presetId="ant"
        correctTotal={CORRECT_TOTAL}
        stepsCount={23}
        onSubmitted={vi.fn()}
        result={{ guess: 7, isCorrect: true }}
        onRewind={vi.fn()}
        onNewRound={onNewRound}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Naujas raundas' }));

    expect(onNewRound).not.toHaveBeenCalled();
    expect(
      screen.getByRole('alertdialog', {
        name: 'Ar tikrai tęsti neišsaugojus rezultato?',
      })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ne, išsaugoti rezultatą' }));
    expect(onNewRound).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Naujas raundas' }));
    await user.click(screen.getByRole('button', { name: 'Taip, tęsti neišsaugojus' }));

    expect(onNewRound).toHaveBeenCalledTimes(1);
  });

  it('does not ask for confirmation after the score is saved', async () => {
    const user = userEvent.setup();
    const onNewRound = vi.fn();
    submitScoreMock.mockResolvedValue(resultWith({}));
    render(
      <AnswerScreen
        presetId="ant"
        correctTotal={CORRECT_TOTAL}
        stepsCount={23}
        onSubmitted={vi.fn()}
        result={{ guess: 7, isCorrect: true }}
        onRewind={vi.fn()}
        onNewRound={onNewRound}
      />
    );

    await user.type(screen.getByLabelText('Vardas'), 'Ona');
    await user.click(screen.getByRole('button', { name: 'Išsaugoti' }));
    expect(await screen.findByText('Tu užėmei 2 vietą iš 2! Taškai: 23')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Naujas raundas' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onNewRound).toHaveBeenCalledTimes(1);
  });
});

describe('AnswerScreen while answering', () => {
  // Mirrors App: submitting stores the result, which switches the screen to the result view.
  function Harness({ onSubmitted }: { onSubmitted: (guess: number | null) => void }) {
    const [result, setResult] = useState<AnswerResult | null>(null);
    return (
      <AnswerScreen
        presetId="custom"
        correctTotal={CORRECT_TOTAL}
        stepsCount={5}
        onSubmitted={(guess) => {
          onSubmitted(guess);
          setResult({ guess, isCorrect: guess === CORRECT_TOTAL });
        }}
        result={result}
        onRewind={vi.fn()}
        onNewRound={vi.fn()}
      />
    );
  }

  function typeGuess(value: string) {
    fireEvent.change(screen.getByPlaceholderText('Tavo atsakymas'), { target: { value } });
  }

  function advance(ms: number) {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });


  it('shows a filling 20-second answer bar', () => {
    render(<Harness onSubmitted={vi.fn()} />);
    const bar = screen.getByRole('progressbar', { name: 'Laikas atsakymui' });
    expect(bar).toHaveAttribute('aria-valuenow', '0');

    advance(10_000);
    expect(Number(bar.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(46);
    expect(Number(bar.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(50);
  });

  it('does nothing before the 20 seconds are up, even past the old 15 s limit', () => {
    const onSubmitted = vi.fn();
    render(<Harness onSubmitted={onSubmitted} />);
    typeGuess('7');

    advance(19_000);
    expect(onSubmitted).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Tavo atsakymas')).toBeInTheDocument();
  });

  it('submits the typed answer automatically when time runs out', () => {
    const onSubmitted = vi.fn();
    render(<Harness onSubmitted={onSubmitted} />);
    typeGuess('7');

    advance(20_000);
    expect(onSubmitted).toHaveBeenCalledWith(7);
    expect(screen.getByText(/Teisingai!/)).toBeInTheDocument();
  });

  it('reports "no answer" when time runs out with an empty field', () => {
    const onSubmitted = vi.fn();
    render(<Harness onSubmitted={onSubmitted} />);

    advance(20_000);
    expect(onSubmitted).toHaveBeenCalledWith(null);
    expect(screen.getByText('Nespėjai atsakyti! Teisingas atsakymas buvo 7.')).toBeInTheDocument();
  });

  it('does not submit again when the timer ends after a manual answer', () => {
    const onSubmitted = vi.fn();
    render(<Harness onSubmitted={onSubmitted} />);
    typeGuess('3');
    fireEvent.click(screen.getByRole('button', { name: 'Patikrinti' }));

    advance(20_000);
    expect(onSubmitted).toHaveBeenCalledTimes(1);
    expect(onSubmitted).toHaveBeenCalledWith(3);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('submits when Enter is pressed in the focused answer field', () => {
    const onSubmitted = vi.fn();
    render(<Harness onSubmitted={onSubmitted} />);
    const input = screen.getByPlaceholderText('Tavo atsakymas');

    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(onSubmitted).toHaveBeenCalledTimes(1);
    expect(onSubmitted).toHaveBeenCalledWith(7);
    expect(screen.getByText(/Teisingai!/)).toBeInTheDocument();
  });

  it('ignores a manual submit with an empty field', () => {
    const onSubmitted = vi.fn();
    render(<Harness onSubmitted={onSubmitted} />);
    fireEvent.click(screen.getByRole('button', { name: 'Patikrinti' }));
    expect(onSubmitted).not.toHaveBeenCalled();
  });
});
