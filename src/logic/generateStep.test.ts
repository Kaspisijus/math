import { describe, expect, it } from 'vitest';
import { generateStep, type RandomFn } from './generateStep';
import type { Settings, Step } from '../types';
import { PRESETS } from '../presets';

const DEFAULT_SETTINGS: Settings = {
  enabledOps: ['+', '-'],
  maxByOp: { '+': 10, '-': 10, '×': 10, '÷': 10 },
  allowNegative: false,
  maxTotal: 100,
};

const WIZARD = PRESETS.find((preset) => preset.id === 'wizard')!.settings;
const MULTIPLICATIVE_ONLY: Settings = { ...WIZARD, enabledOps: ['×', '÷'] };

function settingsWith(overrides: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

/** Sequence RNG: returns each value in `values` in order, then repeats the last one. */
function sequenceRng(values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

/** Seeded pseudo-random numbers (mulberry32), so every run sees the same "random" rounds. */
function seededRng(seed: number): RandomFn {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A round that has reached `total`; only the last total and operand matter to the next step. */
function after(total: number, previousOperand = total): Step[] {
  return [{ op: '+', operand: previousOperand, total }];
}

function playRounds(settings: Settings, { rounds = 300, steps = 20, seed = 42 } = {}): Step[][] {
  const rng = seededRng(seed);
  return Array.from({ length: rounds }, () => {
    const history: Step[] = [];
    while (history.length < steps) history.push(generateStep(history, settings, rng));
    return history;
  });
}

type Kind = 'zero' | 'one' | 'normal';

/** Every × / ÷ step after the opening one, with the numbers of its times-table fact. */
function multiplicativeFacts(round: Step[]) {
  return round.flatMap((step, i) => {
    if (i === 0 || (step.op !== '×' && step.op !== '÷')) return [];
    const before = round[i - 1].total;
    // 3 × 4 is the fact 3·4; 16 ÷ 4 is the fact 4·4 (divisor times result).
    const factors = step.op === '×' ? [before, step.operand] : [step.operand, step.total];
    const kind: Kind =
      before === 0 ? 'zero' : factors.some((n) => Math.abs(n) === 1) ? 'one' : 'normal';
    return [{ step, before, kind, index: i }];
  });
}

function kindShares(rounds: Step[][]) {
  const kinds = rounds.flatMap((round) => multiplicativeFacts(round).map((fact) => fact.kind));
  const share = (kind: Kind) => kinds.filter((k) => k === kind).length / kinds.length;
  return { zero: share('zero'), one: share('one'), normal: share('normal') };
}

describe('generateStep', () => {
  it('only produces enabled operations', () => {
    const settings = settingsWith({ enabledOps: ['+'] });
    const rng = seededRng(1);
    for (let trial = 0; trial < 50; trial++) {
      const step = generateStep(after(10), settings, rng);
      expect(step.op).toBe('+');
    }
  });

  it('never exceeds the configured max operand', () => {
    const settings = settingsWith({ enabledOps: ['+', '×'], maxByOp: { ...DEFAULT_SETTINGS.maxByOp, '+': 5, '×': 3 } });
    const rng = seededRng(2);
    for (let trial = 0; trial < 100; trial++) {
      const step = generateStep(after(4), settings, rng);
      expect(step.operand).toBeLessThanOrEqual(settings.maxByOp[step.op]);
      expect(step.operand).toBeGreaterThanOrEqual(1);
    }
  });

  it('division always evenly divides the current total', () => {
    const settings = settingsWith({ enabledOps: ['÷'], maxByOp: { ...DEFAULT_SETTINGS.maxByOp, '÷': 12 } });
    const rng = seededRng(3);
    for (const total of [12, 24, 7, 1, 0]) {
      for (let trial = 0; trial < 20; trial++) {
        const step = generateStep(after(total), settings, rng);
        expect(step.op).toBe('÷');
        if (total !== 0) {
          expect(total % step.operand).toBe(0);
        }
      }
    }
  });

  it('never drops the total below 0 when allowNegative is false', () => {
    const settings = settingsWith({ enabledOps: ['+', '-', '÷'], allowNegative: false });
    const rng = seededRng(4);
    for (const total of [0, 1, 2, 5]) {
      for (let trial = 0; trial < 50; trial++) {
        const step = generateStep(after(total), settings, rng);
        expect(step.total).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('falls back to a safe operation when the only enabled op is impossible at total 0', () => {
    const settings = settingsWith({ enabledOps: ['-'], allowNegative: false });
    const step = generateStep(after(0), settings, seededRng(5));
    expect(step.total).toBeGreaterThanOrEqual(0);
  });

  it('applies the operand deterministically for a given rng', () => {
    const settings = settingsWith({ enabledOps: ['+'], maxByOp: { ...DEFAULT_SETTINGS.maxByOp, '+': 10 } });
    // Every rng call returns 0.99, so the largest allowed operand is picked.
    const rng = sequenceRng([0.99]);
    const step = generateStep(after(3), settings, rng);
    expect(step.op).toBe('+');
    expect(step.operand).toBe(10);
    expect(step.total).toBe(13);
  });

  it('avoids repeating the previous operand when another operand is available', () => {
    const settings = settingsWith({ enabledOps: ['+'], maxByOp: { ...DEFAULT_SETTINGS.maxByOp, '+': 3 } });
    const rng = sequenceRng([0.5]);
    const step = generateStep(after(3, 2), settings, rng);

    expect(step.op).toBe('+');
    expect(step.operand).toBe(3);
    expect(step.total).toBe(6);
  });

  it('never pushes the total above maxTotal via addition', () => {
    const settings = settingsWith({ enabledOps: ['+'], maxByOp: { ...DEFAULT_SETTINGS.maxByOp, '+': 50 }, maxTotal: 20 });
    const rng = seededRng(6);
    for (const total of [0, 5, 19, 20]) {
      for (let trial = 0; trial < 50; trial++) {
        const step = generateStep(after(total), settings, rng);
        expect(step.total).toBeLessThanOrEqual(20);
      }
    }
  });

  it('never pushes the total above maxTotal via multiplication', () => {
    const settings = settingsWith({ enabledOps: ['×'], maxByOp: { ...DEFAULT_SETTINGS.maxByOp, '×': 20 }, maxTotal: 20 });
    const rng = seededRng(7);
    for (const total of [0, 1, 4, 7, 20]) {
      for (let trial = 0; trial < 50; trial++) {
        const step = generateStep(after(total), settings, rng);
        expect(step.total).toBeLessThanOrEqual(20);
      }
    }
  });

  it('only multiplies when both factors fit within the configured max', () => {
    const settings = settingsWith({ enabledOps: ['×'], maxByOp: { ...DEFAULT_SETTINGS.maxByOp, '×': 5 } });

    const maxByMax = generateStep(after(5, 2), settings, sequenceRng([0.99]));
    expect(maxByMax.op).toBe('×');
    expect(maxByMax.operand).toBe(5);
    expect(maxByMax.total).toBe(25);

    const tooLargeFactor = generateStep(after(17), settings, seededRng(8));
    expect(tooLargeFactor.op).not.toBe('×');
  });

  it('only divides when both divisor and result fit within the configured max', () => {
    const settings = settingsWith({ enabledOps: ['÷'], maxByOp: { ...DEFAULT_SETTINGS.maxByOp, '÷': 5 } });

    const maxDividend = generateStep(after(25), settings, sequenceRng([0]));
    expect(maxDividend.op).toBe('÷');
    expect(maxDividend.operand).toBe(5);
    expect(maxDividend.total).toBe(5);

    const tooLargeResult = generateStep(after(30), settings, sequenceRng([0]));
    expect(tooLargeResult.op).not.toBe('÷');
  });

  it('stays within bounds and never crashes when the total is pinned exactly at maxTotal', () => {
    // Only "+" enabled, total already equals the cap: "+" alone is impossible for any
    // positive operand, forcing the fallback chain to kick in.
    const settings = settingsWith({ enabledOps: ['+'], maxByOp: { ...DEFAULT_SETTINGS.maxByOp, '+': 10 }, maxTotal: 20 });
    const step = generateStep(after(20), settings, seededRng(9));
    expect(step.total).toBeLessThanOrEqual(20);
    expect(step.total).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(step.total)).toBe(true);
  });
});

describe('generateStep: the opening step', () => {
  it('opens with + from 0 when + / − are on, never with × or ÷', () => {
    const rng = seededRng(10);
    for (let trial = 0; trial < 100; trial++) {
      const step = generateStep([], WIZARD, rng);
      expect(step.op).toBe('+');
      expect(step.total).toBe(step.operand);
    }
  });

  it('with only × / ÷ on, opens with a starting number from 2 up to their max', () => {
    const rng = seededRng(11);
    const operands = new Set<number>();
    for (let trial = 0; trial < 100; trial++) {
      const step = generateStep([], MULTIPLICATIVE_ONLY, rng);
      expect(step.op).toBe('+');
      expect(step.total).toBe(step.operand);
      operands.add(step.operand);
    }
    expect([...operands].sort()).toEqual([2, 3, 4, 5]);
  });

  it('keeps the starting number within the upper limit and a max of 1', () => {
    const lowLimit = generateStep([], { ...MULTIPLICATIVE_ONLY, maxTotal: 3 }, sequenceRng([0.99]));
    expect(lowLimit).toEqual({ op: '+', operand: 3, total: 3 });

    const maxOne = { ...MULTIPLICATIVE_ONLY, maxByOp: { ...MULTIPLICATIVE_ONLY.maxByOp, '×': 1, '÷': 1 } };
    expect(generateStep([], maxOne, sequenceRng([0.99]))).toEqual({ op: '+', operand: 1, total: 1 });
  });
});

describe('generateStep: × and ÷ within a round', () => {
  it('with only × / ÷ on, never sits at 0 (it used to stay there for the whole round)', () => {
    for (const round of playRounds(MULTIPLICATIVE_ONLY)) {
      for (const step of round.slice(1)) {
        expect(['×', '÷']).toContain(step.op);
        expect(step.total).not.toBe(0);
      }
    }
  });

  it('with + / − on too, goes against 0 once and against 1 once in every 5 × / ÷ steps when their max is 5', () => {
    for (const round of playRounds(WIZARD)) {
      const kinds = multiplicativeFacts(round).map((fact) => fact.kind);
      for (let start = 0; start + 5 <= kinds.length; start += 5) {
        const block = kinds.slice(start, start + 5);
        expect(block.filter((kind) => kind === 'zero')).toHaveLength(1);
        expect(block.filter((kind) => kind === 'one')).toHaveLength(1);
      }
    }
  });

  it('scales the split with the max: 1 in 10 against 0 and against 1 when the max is 10', () => {
    const settings = { ...WIZARD, maxByOp: { ...WIZARD.maxByOp, '×': 10, '÷': 10 } };
    const rounds = playRounds(settings, { steps: 40 });
    for (const round of rounds) {
      const kinds = multiplicativeFacts(round).map((fact) => fact.kind);
      for (let start = 0; start + 10 <= kinds.length; start += 10) {
        const block = kinds.slice(start, start + 10);
        expect(block.filter((kind) => kind === 'zero')).toHaveLength(1);
        expect(block.filter((kind) => kind === 'one')).toHaveLength(1);
      }
    }
    const shares = kindShares(rounds);
    expect(shares.zero).toBeCloseTo(0.1, 1);
    expect(shares.one).toBeCloseTo(0.1, 1);
  });

  it('with only × / ÷ on, leaves out steps against 0 but keeps about 1 in 5 against 1', () => {
    const shares = kindShares(playRounds(MULTIPLICATIVE_ONLY));
    expect(shares.zero).toBe(0);
    expect(shares.one).toBeGreaterThan(0.12);
    expect(shares.one).toBeLessThan(0.25);
  });

  it('never goes against 0 more than twice in a row', () => {
    for (const round of playRounds(WIZARD)) {
      let run = 0;
      round.slice(1).forEach((step, i) => {
        run = round[i].total === 0 && (step.op === '×' || step.op === '÷') ? run + 1 : 0;
        expect(run).toBeLessThanOrEqual(2);
      });
    }
  });

  it('covers the whole times table up to the max, both ways', () => {
    const facts = new Set(
      playRounds(MULTIPLICATIVE_ONLY)
        .flatMap(multiplicativeFacts)
        .filter((fact) => fact.kind === 'normal')
        .map(({ step, before }) => `${before} ${step.op} ${step.operand}`)
    );
    for (let a = 2; a <= 5; a++) {
      for (let b = 2; b <= 5; b++) {
        expect(facts).toContain(`${a} × ${b}`);
        expect(facts).toContain(`${a * b} ÷ ${b}`);
      }
    }
  });

  it('keeps every enabled operation coming up', () => {
    const steps = playRounds(WIZARD).flatMap((round) => round.slice(1));
    for (const op of WIZARD.enabledOps) {
      expect(steps.filter((step) => step.op === op).length / steps.length).toBeGreaterThan(0.2);
    }
  });

  it('goes against 0 when the total lands on 0 and the bag still has one', () => {
    const rng = seededRng(12);
    for (let trial = 0; trial < 50; trial++) {
      const history: Step[] = [
        { op: '+', operand: 7, total: 7 },
        { op: '-', operand: 7, total: 0 },
      ];
      const step = generateStep(history, WIZARD, rng);
      expect(['×', '÷']).toContain(step.op);
      expect(step.total).toBe(0);
    }
  });

  it('leaves 0 with + once this bag of 5 already went against 0', () => {
    const rng = seededRng(13);
    for (let trial = 0; trial < 50; trial++) {
      const history: Step[] = [
        { op: '+', operand: 5, total: 5 },
        { op: '-', operand: 5, total: 0 },
        { op: '×', operand: 3, total: 0 },
      ];
      expect(generateStep(history, WIZARD, rng).op).toBe('+');
    }
  });

  it('moves the total to where × can go when × is the least used', () => {
    // + − ÷ were used once each, × not yet, and 23 is too big for × with a max of 5.
    const history: Step[] = [
      { op: '+', operand: 20, total: 20 },
      { op: '÷', operand: 4, total: 5 },
      { op: '-', operand: 1, total: 4 },
      { op: '+', operand: 19, total: 23 },
    ];
    const rng = seededRng(14);
    for (let trial = 0; trial < 50; trial++) {
      const step = generateStep(history, WIZARD, rng);
      expect(step.op).toBe('-');
      expect(step.total).toBeLessThanOrEqual(5);
    }
  });

  it('gets as close as it can when one step cannot reach a total × can use', () => {
    const settings = { ...WIZARD, maxByOp: { ...WIZARD.maxByOp, '+': 60 } };
    const history: Step[] = [
      { op: '+', operand: 20, total: 20 },
      { op: '÷', operand: 4, total: 5 },
      { op: '-', operand: 1, total: 4 },
      { op: '+', operand: 56, total: 60 },
    ];
    const rng = seededRng(15);
    for (let trial = 0; trial < 20; trial++) {
      expect(generateStep(history, settings, rng)).toEqual({ op: '-', operand: 20, total: 40 });
    }
  });
});
