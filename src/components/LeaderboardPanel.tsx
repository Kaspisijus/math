import { useEffect, useState } from 'react';
import { CUSTOM_PRESET_ID, type PresetId } from '../presets';
import { fetchLeaderboard, type LeaderboardEntry } from '../leaderboard/api';
import { LeaderboardTable } from './LeaderboardTable';

type State =
  | { status: 'loading' }
  | { status: 'ready'; entries: LeaderboardEntry[] }
  | { status: 'error' };

export function LeaderboardPanel({ presetId }: { presetId: PresetId }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (presetId === CUSTOM_PRESET_ID) return;
    let cancelled = false;
    setState({ status: 'loading' });
    fetchLeaderboard(presetId).then(
      (entries) => !cancelled && setState({ status: 'ready', entries }),
      () => !cancelled && setState({ status: 'error' })
    );
    return () => {
      cancelled = true;
    };
  }, [presetId]);

  return (
    <section className="leaderboard-panel" aria-label="Lyderiai">
      <h3>Lyderiai</h3>
      {presetId === CUSTOM_PRESET_ID ? (
        <p className="hint">Savi nustatymai neturi lyderių lentelės.</p>
      ) : state.status === 'loading' ? (
        <p className="hint">Kraunama…</p>
      ) : state.status === 'error' ? (
        <p className="hint">Lyderių lentelė dabar nepasiekiama.</p>
      ) : (
        <LeaderboardTable entries={state.entries} />
      )}
    </section>
  );
}
