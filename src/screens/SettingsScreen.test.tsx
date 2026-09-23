import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsScreen } from './SettingsScreen';
import { DEFAULT_PRESET, PRESETS } from '../presets';
import { fetchLeaderboard } from '../leaderboard/api';

vi.mock('../leaderboard/api', () => ({
  fetchLeaderboard: vi.fn(),
  submitScore: vi.fn(),
}));

const fetchLeaderboardMock = vi.mocked(fetchLeaderboard);

beforeEach(() => {
  fetchLeaderboardMock.mockReset();
  fetchLeaderboardMock.mockResolvedValue([]);
});

function renderScreen(onStart = vi.fn()) {
  render(
    <SettingsScreen
      initialPresetId={DEFAULT_PRESET.id}
      initialSettings={DEFAULT_PRESET.settings}
      onStart={onStart}
    />
  );
  return onStart;
}

function groupInputs(label: RegExp) {
  const row = screen.getByLabelText(label).closest('.op-row') as HTMLElement;
  return {
    checkbox: within(row).getByRole('checkbox') as HTMLInputElement,
    max: within(row).getByRole('spinbutton') as HTMLInputElement,
  };
}

describe('presets', () => {
  it('defines the three levels as specified, none allowing negative totals', () => {
    const [ant, elephant, wizard] = PRESETS;

    expect(ant.settings).toEqual({
      enabledOps: ['+', '-'],
      maxByOp: expect.objectContaining({ '+': 20, '-': 20 }),
      allowNegative: false,
      maxTotal: 100,
    });
    expect(elephant.settings).toEqual({
      enabledOps: ['+', '-'],
      maxByOp: expect.objectContaining({ '+': 500, '-': 500 }),
      allowNegative: false,
      maxTotal: 1000,
    });
    expect(wizard.settings).toEqual({
      enabledOps: ['+', '-', '×', '÷'],
      maxByOp: { '+': 20, '-': 20, '×': 5, '÷': 5 },
      allowNegative: false,
      maxTotal: 100,
    });
  });
});

describe('SettingsScreen presets', () => {
  it('selects the first preset by default and shows its settings locked', () => {
    renderScreen();

    expect(screen.getByRole('radio', { name: /Skruzdėlytė/ })).toBeChecked();

    const additive = groupInputs(/Sudėtis \/ Atimtis/);
    const multiplicative = groupInputs(/Daugyba \/ Dalyba/);
    expect(additive.checkbox).toBeChecked();
    expect(additive.max).toHaveValue(20);
    expect(multiplicative.checkbox).not.toBeChecked();
    expect(screen.getByLabelText(/Viršutinė riba/)).toHaveValue(100);

    expect(additive.checkbox).toBeDisabled();
    expect(additive.max).toBeDisabled();
    expect(multiplicative.checkbox).toBeDisabled();
    expect(screen.getByLabelText(/Leisti sumai/)).toBeDisabled();
    expect(screen.getByLabelText(/Viršutinė riba/)).toBeDisabled();
  });

  it('shows each preset\'s own values when switching between them', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole('radio', { name: /Drambliukas/ }));
    expect(groupInputs(/Sudėtis \/ Atimtis/).max).toHaveValue(500);
    expect(screen.getByLabelText(/Viršutinė riba/)).toHaveValue(1000);

    await user.click(screen.getByRole('radio', { name: /Burtininkė/ }));
    const multiplicative = groupInputs(/Daugyba \/ Dalyba/);
    expect(multiplicative.checkbox).toBeChecked();
    expect(multiplicative.max).toHaveValue(5);
    expect(groupInputs(/Sudėtis \/ Atimtis/).max).toHaveValue(20);
    expect(screen.getByLabelText(/Viršutinė riba/)).toHaveValue(100);
    expect(multiplicative.max).toBeDisabled();
  });

  it('starts a round with the selected preset\'s settings', async () => {
    const user = userEvent.setup();
    const onStart = renderScreen();

    await user.click(screen.getByRole('radio', { name: /Burtininkė/ }));
    await user.click(screen.getByRole('button', { name: /Pradėti!/ }));

    expect(onStart).toHaveBeenCalledWith(PRESETS[2].settings, 'wizard');
  });

  it('unlocks editing for custom, starting from the previously shown preset', async () => {
    const user = userEvent.setup();
    const onStart = renderScreen();

    await user.click(screen.getByRole('radio', { name: /Drambliukas/ }));
    await user.click(screen.getByRole('radio', { name: /Savi nustatymai/ }));

    const maxTotal = screen.getByLabelText(/Viršutinė riba/);
    expect(maxTotal).toBeEnabled();
    expect(maxTotal).toHaveValue(1000);

    fireEvent.change(maxTotal, { target: { value: '250' } });
    await user.click(screen.getByLabelText(/Daugyba \/ Dalyba/));
    await user.click(screen.getByRole('button', { name: /Pradėti!/ }));

    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        maxTotal: 250,
        enabledOps: ['+', '-', '×', '÷'],
        maxByOp: expect.objectContaining({ '+': 500, '-': 500 }),
      }),
      'custom'
    );
  });

  it('does not let custom edits leak into the presets', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole('radio', { name: /Savi nustatymai/ }));
    fireEvent.change(screen.getByLabelText(/Viršutinė riba/), { target: { value: '7' } });
    await user.click(screen.getByRole('radio', { name: /Skruzdėlytė/ }));

    expect(screen.getByLabelText(/Viršutinė riba/)).toHaveValue(100);
    expect(PRESETS[0].settings.maxTotal).toBe(100);
  });
});

describe('SettingsScreen leaderboard panel', () => {
  it('shows the selected preset\'s board and reloads when the preset changes', async () => {
    const user = userEvent.setup();
    fetchLeaderboardMock.mockImplementation(async (presetId) =>
      presetId === 'ant'
        ? [{ name: 'Ona', points: 25, achievedAt: 1 }]
        : [{ name: 'Tėtis', points: 40, achievedAt: 1 }]
    );
    renderScreen();

    const panel = screen.getByRole('region', { name: 'Lyderiai' });
    expect(await within(panel).findByText('Ona')).toBeInTheDocument();
    expect(fetchLeaderboardMock).toHaveBeenCalledWith('ant');

    await user.click(screen.getByRole('radio', { name: /Drambliukas/ }));
    expect(await within(panel).findByText('Tėtis')).toBeInTheDocument();
    expect(within(panel).queryByText('Ona')).not.toBeInTheDocument();
    expect(fetchLeaderboardMock).toHaveBeenLastCalledWith('elephant');
  });

  it('shows an empty-board message when nobody has played yet', async () => {
    renderScreen();
    expect(await screen.findByText(/Lentelė dar tuščia/)).toBeInTheDocument();
  });

  it('explains that custom settings have no leaderboard', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole('radio', { name: /Savi nustatymai/ }));
    expect(screen.getByText('Savi nustatymai neturi lyderių lentelės.')).toBeInTheDocument();
  });

  it('keeps the game usable when the server is unreachable', async () => {
    fetchLeaderboardMock.mockRejectedValue(new Error('offline'));
    const onStart = renderScreen();

    expect(await screen.findByText(/nepasiekiama/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: /Pradėti!/ }));
    expect(onStart).toHaveBeenCalled();
  });
});
