export const PRESET_IDS = ['ant', 'elephant', 'wizard'] as const;
export type LeaderboardPresetId = (typeof PRESET_IDS)[number];

export const MAX_NAME_LENGTH = 20;
export const MAX_POINTS = 1000;
export const TOP_N = 10;

export interface Entry {
  name: string;
  points: number;
  achievedAt: number;
}

export type Boards = Record<LeaderboardPresetId, Entry[]>;

export function emptyBoards(): Boards {
  return { ant: [], elephant: [], wizard: [] };
}

export function isPresetId(value: string): value is LeaderboardPresetId {
  return (PRESET_IDS as readonly string[]).includes(value);
}

export function validateSubmission(body: unknown): { name: string; points: number } | string {
  if (typeof body !== 'object' || body === null) return 'Invalid body';
  const { name, points } = body as Record<string, unknown>;

  if (typeof name !== 'string') return 'Name is required';
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'Name is required';
  if (trimmed.length > MAX_NAME_LENGTH) return `Name must be at most ${MAX_NAME_LENGTH} characters`;

  if (typeof points !== 'number' || !Number.isInteger(points)) return 'Points must be an integer';
  if (points < 1 || points > MAX_POINTS) return `Points must be between 1 and ${MAX_POINTS}`;

  return { name: trimmed, points };
}

function nameKey(name: string): string {
  return name.trim().toLocaleLowerCase('lt');
}

export function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => b.points - a.points || a.achievedAt - b.achievedAt);
}

export function upsertBest(
  entries: Entry[],
  name: string,
  points: number,
  now: number
): { entries: Entry[]; improved: boolean } {
  const key = nameKey(name);
  const existing = entries.find((e) => nameKey(e.name) === key);

  if (existing && existing.points >= points) {
    return { entries: sortEntries(entries), improved: false };
  }

  const others = entries.filter((e) => nameKey(e.name) !== key);
  return {
    entries: sortEntries([...others, { name, points, achievedAt: now }]),
    improved: true,
  };
}

export function rankOf(sortedEntries: Entry[], name: string): number {
  const key = nameKey(name);
  return sortedEntries.findIndex((e) => nameKey(e.name) === key) + 1;
}

export function findEntry(entries: Entry[], name: string): Entry | undefined {
  const key = nameKey(name);
  return entries.find((e) => nameKey(e.name) === key);
}
