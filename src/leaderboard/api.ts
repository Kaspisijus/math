import type { PresetId } from '../presets';

export interface LeaderboardEntry {
  name: string;
  points: number;
  achievedAt: number;
}

export interface SubmitResult {
  entries: LeaderboardEntry[];
  rank: number;
  total: number;
  improved: boolean;
  best: LeaderboardEntry;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Leaderboard request failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchLeaderboard(presetId: PresetId): Promise<LeaderboardEntry[]> {
  const { entries } = await request<{ entries: LeaderboardEntry[] }>(`/api/leaderboard/${presetId}`);
  return entries;
}

export function submitScore(presetId: PresetId, name: string, points: number): Promise<SubmitResult> {
  return request<SubmitResult>(`/api/leaderboard/${presetId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, points }),
  });
}
