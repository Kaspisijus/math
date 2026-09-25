import { useCallback, useEffect, useState } from 'react';
import './App.css';
import { generateStep } from './logic/generateStep';
import { useCountdown } from './hooks/useCountdown';
import { playResultSound } from './sound/resultSound';
import { SettingsScreen } from './screens/SettingsScreen';
import { GameScreen } from './screens/GameScreen';
import { AnswerScreen, type AnswerResult } from './screens/AnswerScreen';
import { RewindScreen } from './screens/RewindScreen';
import { ROUND_DURATION_SECONDS, type Settings, type Step } from './types';
import { DEFAULT_PRESET, type PresetId } from './presets';

type Screen = 'settings' | 'game' | 'answer' | 'rewind';

function App() {
  const [screen, setScreen] = useState<Screen>('settings');
  const [presetId, setPresetId] = useState<PresetId>(DEFAULT_PRESET.id);
  const [settings, setSettings] = useState<Settings>(DEFAULT_PRESET.settings);
  const [history, setHistory] = useState<Step[]>([]);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [rewindIndex, setRewindIndex] = useState(0);
  const [roundId, setRoundId] = useState(0);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  function handleStart(newSettings: Settings, newPresetId: PresetId) {
    setSettings(newSettings);
    setPresetId(newPresetId);
    setHistory([generateStep([], newSettings)]);
    setAnswerResult(null);
    setConfirmingCancel(false);
    setRoundId((id) => id + 1);
    setScreen('game');
  }

  const advanceGame = useCallback(() => {
    setHistory((prev) => [...prev, generateStep(prev, settings)]);
  }, [settings]);

  const handleExpire = useCallback(() => {
    setConfirmingCancel(false);
    setScreen('answer');
  }, []);

  const secondsRemaining = useCountdown(
    ROUND_DURATION_SECONDS,
    screen === 'game' ? handleExpire : () => {},
    roundId
  );

  function handleAnswerSubmitted(guess: number | null) {
    const correctTotal = history[history.length - 1].total;
    const isCorrect = guess === correctTotal;
    setAnswerResult({ guess, isCorrect });
    playResultSound(isCorrect);
  }

  function handleRewind() {
    setRewindIndex(0);
    setScreen('rewind');
  }

  const handleNewRound = useCallback(() => {
    setHistory([]);
    setAnswerResult(null);
    setRewindIndex(0);
    setConfirmingCancel(false);
    setScreen('settings');
  }, []);

  const advanceRewind = useCallback(() => {
    setRewindIndex((prev) => Math.min(prev + 1, history.length - 1));
  }, [history.length]);

  useEffect(() => {
    if (screen !== 'game' && screen !== 'rewind') return;

    function handleKeydown(e: KeyboardEvent) {
      if (screen === 'game' && e.code === 'Escape') {
        setConfirmingCancel((open) => !open);
        return;
      }
      // While the confirmation is open, SPACE belongs to its focused button, not the game.
      if (e.code !== 'Space' || confirmingCancel) return;
      e.preventDefault();
      if (screen === 'game') advanceGame();
      if (screen === 'rewind') advanceRewind();
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [screen, confirmingCancel, advanceGame, advanceRewind]);

  return (
    <div className="app-background">
      {screen === 'settings' && (
        <SettingsScreen
          initialPresetId={presetId}
          initialSettings={settings}
          onStart={handleStart}
        />
      )}

      {screen === 'game' && history.length > 0 && (
        <GameScreen
          currentStep={history[history.length - 1]}
          stepNumber={history.length}
          secondsRemaining={secondsRemaining}
          durationSeconds={ROUND_DURATION_SECONDS}
          onNext={advanceGame}
          confirmingCancel={confirmingCancel}
          onRequestCancel={() => setConfirmingCancel(true)}
          onDismissCancel={() => setConfirmingCancel(false)}
          onConfirmCancel={handleNewRound}
        />
      )}

      {screen === 'answer' && history.length > 0 && (
        <AnswerScreen
          presetId={presetId}
          correctTotal={history[history.length - 1].total}
          stepsCount={history.length}
          onSubmitted={handleAnswerSubmitted}
          result={answerResult}
          onRewind={handleRewind}
          onNewRound={handleNewRound}
        />
      )}

      {screen === 'rewind' && history.length > 0 && answerResult && (
        <RewindScreen
          history={history}
          index={rewindIndex}
          isCorrect={answerResult.isCorrect}
          guess={answerResult.guess}
          onNext={advanceRewind}
          onNewRound={handleNewRound}
        />
      )}
    </div>
  );
}

export default App;
