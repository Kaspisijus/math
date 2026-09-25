import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameScreen } from './GameScreen';
import type { Step } from '../types';

const step: Step = { op: '+', operand: 5, total: 5 };

function renderGame({ secondsRemaining = 15, confirmingCancel = false, stepNumber = 1 } = {}) {
  const handlers = {
    onNext: vi.fn(),
    onRequestCancel: vi.fn(),
    onDismissCancel: vi.fn(),
    onConfirmCancel: vi.fn(),
  };
  const game = (props: { secondsRemaining: number; stepNumber: number }) => (
    <GameScreen
      currentStep={step}
      durationSeconds={30}
      confirmingCancel={confirmingCancel}
      {...props}
      {...handlers}
    />
  );
  const { container, rerender } = render(game({ secondsRemaining, stepNumber }));
  return {
    container,
    rerenderWith: (props: { secondsRemaining: number; stepNumber: number }) =>
      rerender(game(props)),
    ...handlers,
  };
}

function getOperationDisplay(container: HTMLElement) {
  return container.querySelector('.operation-display') as HTMLElement;
}

function getFillWidth(container: HTMLElement) {
  const fill = container.querySelector('.progress-fill') as HTMLElement;
  return fill.style.width;
}

describe('GameScreen progress bar', () => {
  it('is empty right when the round starts', () => {
    expect(getFillWidth(renderGame({ secondsRemaining: 30 }).container)).toBe('0%');
  });

  it('is full once no time remains', () => {
    expect(getFillWidth(renderGame({ secondsRemaining: 0 }).container)).toBe('100%');
  });

  it('is halfway filled at the midpoint of the round', () => {
    expect(getFillWidth(renderGame({ secondsRemaining: 15 }).container)).toBe('50%');
  });

  it('no longer renders a numeric seconds readout', () => {
    renderGame();
    expect(screen.queryByText(/15s/)).not.toBeInTheDocument();
  });
});

describe('GameScreen new-step cue', () => {
  it('shows a new number element on the next step, even when the number looks the same', () => {
    const { container, rerenderWith } = renderGame({ stepNumber: 1 });
    const before = getOperationDisplay(container);

    rerenderWith({ secondsRemaining: 15, stepNumber: 2 });

    // A fresh element replays the pop-in animation, so a repeated "+5" still visibly arrives.
    const after = getOperationDisplay(container);
    expect(after).not.toBe(before);
    expect(after).toHaveTextContent('+5');
  });

  it('keeps the same number element while only the timer ticks', () => {
    const { container, rerenderWith } = renderGame({ secondsRemaining: 15, stepNumber: 3 });
    const before = getOperationDisplay(container);

    rerenderWith({ secondsRemaining: 14, stepNumber: 3 });

    expect(getOperationDisplay(container)).toBe(before);
  });
});

describe('GameScreen buttons', () => {
  it('asks for confirmation from the corner button instead of cancelling right away', async () => {
    const { onRequestCancel, onConfirmCancel, onNext } = renderGame();
    const cancel = screen.getByRole('button', { name: 'Nutraukti (Esc)' });
    expect(cancel).toHaveClass('cancel-button');

    await userEvent.setup().click(cancel);
    expect(onRequestCancel).toHaveBeenCalledTimes(1);
    expect(onConfirmCancel).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('advances via the Next button', async () => {
    const { onRequestCancel, onNext } = renderGame();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Kitas (tarpas)' }));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onRequestCancel).not.toHaveBeenCalled();
  });

  it.each(['Nutraukti (Esc)', 'Kitas (tarpas)'])(
    '"%s" does not keep focus after a click, so SPACE cannot press it',
    async (name) => {
      renderGame();
      const button = screen.getByRole('button', { name });
      await userEvent.setup().click(button);
      expect(button).not.toHaveFocus();
    }
  );
});

describe('GameScreen cancel confirmation', () => {
  it('is hidden until requested', () => {
    renderGame();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('focuses the safe "continue" choice so stray key presses keep playing', () => {
    renderGame({ confirmingCancel: true });
    expect(screen.getByRole('alertdialog', { name: 'Nutraukti raundą?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ne, tęsti' })).toHaveFocus();
  });

  it('dismisses with "Ne, tęsti"', async () => {
    const { onDismissCancel, onConfirmCancel } = renderGame({ confirmingCancel: true });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ne, tęsti' }));
    expect(onDismissCancel).toHaveBeenCalledTimes(1);
    expect(onConfirmCancel).not.toHaveBeenCalled();
  });

  it('cancels with "Taip, nutraukti"', async () => {
    const { onDismissCancel, onConfirmCancel } = renderGame({ confirmingCancel: true });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Taip, nutraukti' }));
    expect(onConfirmCancel).toHaveBeenCalledTimes(1);
    expect(onDismissCancel).not.toHaveBeenCalled();
  });
});
