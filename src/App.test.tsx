import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { ANSWER_DURATION_SECONDS, ROUND_DURATION_SECONDS } from './types';
import { playResultSound } from './sound/resultSound';

vi.mock('./leaderboard/api', () => ({
  fetchLeaderboard: vi.fn().mockResolvedValue([]),
  submitScore: vi.fn(),
}));

vi.mock('./sound/resultSound', () => ({
  playResultSound: vi.fn(),
}));

const playResultSoundMock = vi.mocked(playResultSound);

function pressSpace() {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
  });
}

function pressEscape() {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
  });
}

async function chooseCustom(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('radio', { name: /Savi nustatymai/ }));
}

function expireRound() {
  act(() => {
    vi.advanceTimersByTime(ROUND_DURATION_SECONDS * 1000);
  });
}

async function configureAndStart(user: ReturnType<typeof userEvent.setup>) {
  // Addition/subtraction is enabled by default; switch to multiplication/division
  // and cap its operand at 1, so the round opens with +1 and every later step is a
  // deterministic identity step (×1 or ÷1) that keeps the running total at 1.
  await chooseCustom(user);
  await user.click(screen.getByLabelText(/Sudėtis \/ Atimtis/));
  await user.click(screen.getByLabelText(/Daugyba \/ Dalyba/));

  const multiplicativeRow = screen
    .getByText('Daugyba / Dalyba (× / ÷)')
    .closest('.op-row') as HTMLElement;
  const maxInput = within(multiplicativeRow).getByRole('spinbutton');
  fireEvent.change(maxInput, { target: { value: '1' } });

  await user.click(screen.getByRole('button', { name: /Pradėti!/ }));
}

describe('App', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs the full happy path: settings -> drill -> timeout -> correct answer -> rewind', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await configureAndStart(user);

    expect(screen.getByText(/^\+1$/)).toBeInTheDocument();

    // Press space twice more -> 3 steps total, total stays 1 throughout.
    pressSpace();
    pressSpace();
    expect(screen.getByText(/^[×÷]\s*1$/)).toBeInTheDocument();

    expireRound();

    expect(screen.getByText(/Laikas baigėsi/)).toBeInTheDocument();
    expect(screen.getByText(/Iš viso peržiūrėjai 3 skaičių/)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Tavo atsakymas'), '1');
    await user.click(screen.getByRole('button', { name: /Patikrinti/ }));

    expect(screen.getByText(/Teisingai!/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Peržiūrėti iš naujo/ }));

    expect(screen.getByText('Bendra suma: 1')).toBeInTheDocument();
    pressSpace();
    expect(screen.getByText('Bendra suma: 1')).toBeInTheDocument();
    pressSpace();
    expect(screen.getByText('Bendra suma: 1')).toBeInTheDocument();
    expect(screen.getByText(/Tu atsakei 1 — teisingai!/i)).toBeInTheDocument();
  });

  it('shows the correct total when the guess is wrong', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await configureAndStart(user);

    expireRound();

    await user.type(screen.getByPlaceholderText('Tavo atsakymas'), '999');
    await user.click(screen.getByRole('button', { name: /Patikrinti/ }));

    expect(screen.getByText(/Tu atsakei 999, o teisingas atsakymas buvo 1/)).toBeInTheDocument();
  });

  it('auto-transitions from the game screen to the answer screen when the timer expires', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await configureAndStart(user);
    expect(screen.getByText(/^\+1$/)).toBeInTheDocument();

    expireRound();

    expect(screen.getByText(/Laikas baigėsi/)).toBeInTheDocument();
  });

  it('cancels the round with the button and returns to settings for good', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await user.click(screen.getByRole('radio', { name: /Burtininkė/ }));
    await user.click(screen.getByRole('button', { name: /Pradėti!/ }));
    await user.click(screen.getByRole('button', { name: 'Nutraukti (Esc)' }));

    // Nothing is cancelled until the confirmation is accepted.
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pradėti!/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Taip, nutraukti' }));

    expect(screen.getByRole('button', { name: /Pradėti!/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Burtininkė/ })).toBeChecked();

    // The abandoned round's timer must not pull the app into the answer screen later.
    expireRound();
    expect(screen.queryByText(/Laikas baigėsi/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pradėti!/ })).toBeInTheDocument();
  });

  it('lets mouse users advance both the round and the replay with the Next button', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await configureAndStart(user);
    await user.click(screen.getByRole('button', { name: 'Kitas (tarpas)' }));
    await user.click(screen.getByRole('button', { name: 'Kitas (tarpas)' }));
    expireRound();

    expect(screen.getByText(/Iš viso peržiūrėjai 3 skaičių/)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Tavo atsakymas'), '1');
    await user.click(screen.getByRole('button', { name: /Patikrinti/ }));
    await user.click(screen.getByRole('button', { name: /Peržiūrėti iš naujo/ }));

    expect(screen.getByText('1 žingsnis iš 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Kitas (tarpas)' }));
    expect(screen.getByText('2 žingsnis iš 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Kitas (tarpas)' }));
    expect(screen.getByText('3 žingsnis iš 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kitas (tarpas)' })).not.toBeInTheDocument();
  });

  it('shows every step as a fresh number, so an identical repeat still visibly arrives', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(<App />);
    const operationDisplay = () => container.querySelector('.operation-display');

    // Every step after the opening one is ×1 or ÷1, so the same text often follows itself.
    await configureAndStart(user);
    pressSpace();
    const beforeSpace = operationDisplay();
    pressSpace();
    expect(operationDisplay()).not.toBe(beforeSpace);

    const beforeClick = operationDisplay();
    await user.click(screen.getByRole('button', { name: 'Kitas (tarpas)' }));
    expect(operationDisplay()).not.toBe(beforeClick);

    expireRound();
    await user.type(screen.getByPlaceholderText('Tavo atsakymas'), '1');
    await user.click(screen.getByRole('button', { name: /Patikrinti/ }));
    await user.click(screen.getByRole('button', { name: /Peržiūrėti iš naujo/ }));

    const replayed = operationDisplay();
    pressSpace();
    expect(operationDisplay()).not.toBe(replayed);
  });

  it('opens the confirmation with Escape, closes it with Escape again, and cancels on confirm', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Pradėti!/ }));
    pressEscape();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    pressEscape();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kitas (tarpas)' })).toBeInTheDocument();

    pressEscape();
    await user.click(screen.getByRole('button', { name: 'Taip, nutraukti' }));
    expect(screen.getByRole('button', { name: /Pradėti!/ })).toBeInTheDocument();
  });

  it('keeps playing the same round after "Ne, tęsti"', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await configureAndStart(user);
    await user.click(screen.getByRole('button', { name: 'Nutraukti (Esc)' }));
    await user.click(screen.getByRole('button', { name: 'Ne, tęsti' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    pressSpace();
    expireRound();
    expect(screen.getByText(/Iš viso peržiūrėjai 2 skaičių/)).toBeInTheDocument();
  });

  it('ignores SPACE for the game while the confirmation is open', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await configureAndStart(user);
    await user.click(screen.getByRole('button', { name: 'Nutraukti (Esc)' }));
    pressSpace();
    pressSpace();
    await user.click(screen.getByRole('button', { name: 'Ne, tęsti' }));
    expireRound();

    expect(screen.getByText(/Iš viso peržiūrėjai 1 skaičių/)).toBeInTheDocument();
  });

  it('treats a stray SPACE on the open confirmation as "continue", never as cancel', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await configureAndStart(user);
    await user.click(screen.getByRole('button', { name: 'Nutraukti (Esc)' }));
    await user.keyboard(' ');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kitas (tarpas)' })).toBeInTheDocument();
    expireRound();
    expect(screen.getByText(/Iš viso peržiūrėjai 1 skaičių/)).toBeInTheDocument();
  });

  it('still ends the round normally if time runs out while the confirmation is open', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await configureAndStart(user);
    await user.click(screen.getByRole('button', { name: 'Nutraukti (Esc)' }));
    expireRound();

    expect(screen.getByText(/Laikas baigėsi/)).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('hides the last number on the answer page and counts a silent 20 s as no answer', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await configureAndStart(user);
    expect(screen.getByText(/^\+1$/)).toBeInTheDocument();
    expireRound();

    // Children read a visible last number as one more step to add, so it must be gone.
    expect(screen.queryByText(/^\+1$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Paskutinis skaičius/)).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(ANSWER_DURATION_SECONDS * 1000);
    });

    expect(screen.getByText('Nespėjai atsakyti! Teisingas atsakymas buvo 1.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Vardas')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Peržiūrėti iš naujo/ }));
    expect(screen.getByText('Nespėjai atsakyti, teisingas atsakymas buvo 1.')).toBeInTheDocument();
  });

  it('lasts exactly 60 seconds', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Pradėti!/ }));
    act(() => {
      vi.advanceTimersByTime(59_000);
    });
    expect(screen.queryByText(/Laikas baigėsi/)).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByText(/Laikas baigėsi/)).toBeInTheDocument();
  });

  it('starts a fresh full-length round after cancelling', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    const mostOfRoundMs = ROUND_DURATION_SECONDS * 1000 * 0.6;

    await user.click(screen.getByRole('button', { name: /Pradėti!/ }));
    act(() => {
      vi.advanceTimersByTime(mostOfRoundMs);
    });
    await user.click(screen.getByRole('button', { name: 'Nutraukti (Esc)' }));
    await user.click(screen.getByRole('button', { name: 'Taip, nutraukti' }));
    await user.click(screen.getByRole('button', { name: /Pradėti!/ }));

    // Together with the old round this passes the full length; only the new round's time may count.
    act(() => {
      vi.advanceTimersByTime(mostOfRoundMs);
    });
    expect(screen.queryByText(/Laikas baigėsi/)).not.toBeInTheDocument();
    expireRound();
    expect(screen.getByText(/Laikas baigėsi/)).toBeInTheDocument();
  });

  it('remembers the chosen preset when starting a new round', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await user.click(screen.getByRole('radio', { name: /Drambliukas/ }));
    await user.click(screen.getByRole('button', { name: /Pradėti!/ }));
    expireRound();
    await user.type(screen.getByPlaceholderText('Tavo atsakymas'), '1');
    await user.click(screen.getByRole('button', { name: /Patikrinti/ }));
    await user.click(screen.getByRole('button', { name: /Naujas raundas/ }));

    expect(screen.getByRole('radio', { name: /Drambliukas/ })).toBeChecked();
    expect(screen.getByLabelText(/Viršutinė riba/)).toHaveValue(1000);
  });

  it('defaults the upper-limit setting to 100 and rejects values below 1', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await chooseCustom(user);

    const maxTotalInput = screen.getByLabelText(/Viršutinė riba/) as HTMLInputElement;
    expect(maxTotalInput.value).toBe('100');

    fireEvent.change(maxTotalInput, { target: { value: '0' } });
    await user.click(screen.getByRole('button', { name: /Pradėti!/ }));

    expect(screen.getByText(/Viršutinė riba turi būti bent 1/)).toBeInTheDocument();
  });

  it('never lets the running total climb above the configured upper limit', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    // Addition/subtraction stays enabled (the default); cap the running total at 3 — every
    // generated step (including any fallback step) must keep the total within [0, 3].
    await chooseCustom(user);
    fireEvent.change(screen.getByLabelText(/Viršutinė riba/), { target: { value: '3' } });
    await user.click(screen.getByRole('button', { name: /Pradėti!/ }));

    for (let i = 0; i < 15; i++) pressSpace();

    expireRound();

    await user.type(screen.getByPlaceholderText('Tavo atsakymas'), '0');
    await user.click(screen.getByRole('button', { name: /Patikrinti/ }));
    await user.click(screen.getByRole('button', { name: /Peržiūrėti iš naujo/ }));

    // Walk through every recorded step via rewind, checking the running total shown at each.
    let steps = 0;
    while (true) {
      const totalText = screen.getByText(/^Bendra suma: /).textContent ?? '';
      const total = Number(totalText.replace('Bendra suma: ', ''));
      expect(total).toBeGreaterThanOrEqual(0);
      expect(total).toBeLessThanOrEqual(3);
      steps++;
      if (screen.queryByRole('button', { name: 'Kitas (tarpas)' })) {
        pressSpace();
      } else {
        break;
      }
    }
    expect(steps).toBe(16); // initial step + 15 spacebar presses
  });
});

describe('App result sounds', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    playResultSoundMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function answer(user: ReturnType<typeof userEvent.setup>, guess: string) {
    await user.type(screen.getByPlaceholderText('Tavo atsakymas'), guess);
    await user.click(screen.getByRole('button', { name: /Patikrinti/ }));
  }

  it('stays quiet while the answer is still being typed', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await configureAndStart(user);
    expireRound();
    await user.type(screen.getByPlaceholderText('Tavo atsakymas'), '1');

    expect(playResultSoundMock).not.toHaveBeenCalled();
  });

  it('plays the success sound once for a correct answer', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await configureAndStart(user);
    expireRound();
    await answer(user, '1');

    expect(screen.getByText(/Teisingai!/)).toBeInTheDocument();
    expect(playResultSoundMock).toHaveBeenCalledTimes(1);
    expect(playResultSoundMock).toHaveBeenCalledWith(true);
  });

  it('plays the fail sound once for a wrong answer', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await configureAndStart(user);
    expireRound();
    await answer(user, '999');

    expect(playResultSoundMock).toHaveBeenCalledTimes(1);
    expect(playResultSoundMock).toHaveBeenCalledWith(false);
  });

  it('plays the fail sound once when the answer time runs out, and not again afterwards', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await configureAndStart(user);
    expireRound();
    act(() => {
      vi.advanceTimersByTime(ANSWER_DURATION_SECONDS * 1000);
    });

    expect(screen.getByText(/Nespėjai atsakyti!/)).toBeInTheDocument();
    expect(playResultSoundMock).toHaveBeenCalledTimes(1);
    expect(playResultSoundMock).toHaveBeenCalledWith(false);

    act(() => {
      vi.advanceTimersByTime(ANSWER_DURATION_SECONDS * 1000);
    });
    expect(playResultSoundMock).toHaveBeenCalledTimes(1);
  });

  it('plays the sound again for the next round', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await configureAndStart(user);
    expireRound();
    await answer(user, '999');
    await user.click(screen.getByRole('button', { name: 'Naujas raundas' }));

    await user.click(screen.getByRole('button', { name: /Pradėti!/ }));
    expireRound();
    await answer(user, '1');

    expect(playResultSoundMock.mock.calls).toEqual([[false], [true]]);
  });
});
