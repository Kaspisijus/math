// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  MAX_NAME_LENGTH,
  MAX_POINTS,
  isPresetId,
  rankOf,
  sortEntries,
  upsertBest,
  validateSubmission,
  type Entry,
} from './leaderboard.ts';

describe('validateSubmission', () => {
  it('accepts a valid name and points, trimming the name', () => {
    expect(validateSubmission({ name: '  Milda ', points: 12 })).toEqual({ name: 'Milda', points: 12 });
  });

  it('accepts boundary values', () => {
    expect(validateSubmission({ name: 'a'.repeat(MAX_NAME_LENGTH), points: 1 })).not.toBeTypeOf('string');
    expect(validateSubmission({ name: 'M', points: MAX_POINTS })).not.toBeTypeOf('string');
  });

  it.each([
    [null],
    ['text'],
    [{ points: 5 }],
    [{ name: '   ', points: 5 }],
    [{ name: 'a'.repeat(MAX_NAME_LENGTH + 1), points: 5 }],
    [{ name: 'Milda' }],
    [{ name: 'Milda', points: 2.5 }],
    [{ name: 'Milda', points: '5' }],
    [{ name: 'Milda', points: 0 }],
    [{ name: 'Milda', points: MAX_POINTS + 1 }],
  ])('rejects %j', (body) => {
    expect(validateSubmission(body)).toBeTypeOf('string');
  });
});

describe('isPresetId', () => {
  it('accepts only the three leaderboard presets', () => {
    expect(isPresetId('ant')).toBe(true);
    expect(isPresetId('wizard')).toBe(true);
    expect(isPresetId('custom')).toBe(false);
    expect(isPresetId('__proto__')).toBe(false);
  });
});

describe('upsertBest', () => {
  const base: Entry[] = [
    { name: 'Milda', points: 10, achievedAt: 1 },
    { name: 'Tėtis', points: 20, achievedAt: 2 },
  ];

  it('adds a new name and keeps entries sorted', () => {
    const { entries, improved } = upsertBest(base, 'Mama', 15, 3);
    expect(improved).toBe(true);
    expect(entries.map((e) => e.name)).toEqual(['Tėtis', 'Mama', 'Milda']);
  });

  it('replaces a lower score for the same name', () => {
    const { entries, improved } = upsertBest(base, 'Milda', 25, 3);
    expect(improved).toBe(true);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ name: 'Milda', points: 25, achievedAt: 3 });
  });

  it('keeps the existing best when the new score is lower or equal', () => {
    for (const points of [5, 10]) {
      const { entries, improved } = upsertBest(base, 'Milda', points, 3);
      expect(improved).toBe(false);
      expect(entries.find((e) => e.name === 'Milda')).toEqual({ name: 'Milda', points: 10, achievedAt: 1 });
    }
  });

  it('matches names case-insensitively and shows the latest spelling', () => {
    const { entries } = upsertBest(base, 'MILDA', 30, 3);
    expect(entries).toHaveLength(2);
    expect(entries[0].name).toBe('MILDA');
  });

  it('does not mutate the input array', () => {
    const copy = structuredClone(base);
    upsertBest(base, 'Milda', 99, 3);
    expect(base).toEqual(copy);
  });
});

describe('sortEntries / rankOf', () => {
  it('breaks ties by whoever reached the score first', () => {
    const sorted = sortEntries([
      { name: 'Late', points: 10, achievedAt: 5 },
      { name: 'Early', points: 10, achievedAt: 1 },
      { name: 'Top', points: 11, achievedAt: 9 },
    ]);
    expect(sorted.map((e) => e.name)).toEqual(['Top', 'Early', 'Late']);
    expect(rankOf(sorted, 'early')).toBe(2);
    expect(rankOf(sorted, 'Late')).toBe(3);
  });

  it('returns 0 for a name not on the board', () => {
    expect(rankOf([], 'Milda')).toBe(0);
  });
});
