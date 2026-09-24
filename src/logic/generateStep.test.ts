import { describe, expect, it } from 'vitest';
import { generateStep } from './generateStep';
import type { Settings } from '../types';

const DEFAULT_SETTINGS: Settings = {
  enabledOps: ['+', '-'],
  maxByOp: { '+': 10, '-': 10, '×': 10, '÷': 10 },
  allowNegative: false,
  maxTotal: 100,
};

function settingsWith(overrides: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

/** Sequence RNG: returns each value in `values` in order, then repeats the last one. */
function sequenceRng(values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('generateStep', () => {
  it('only produces enabled operations', () => {
    const settings = settingsWith({ enabledOps: ['+'] });
    for (let trial = 0; trial < 50; trial++) {
      const step = generateStep(10, settings, () => Math.random());
      expect(step.op).toBe('+');
    }
  });

  it('never exceeds the configured max operand', () => {
    const settings = settingsWith({ enabledOps: ['+', '×'], maxByOp: { ...DEFAULT_SETTINGS.maxByOp, '+': 5, '×': 3 } });
    for (let trial = 0; trial < 100; trial++) {
      const step = generateStep(4, settings, Math.random);
      expect(step.operand).toBeLessThanOrEqual(settings.maxByOp[step.op]);
      expect(step.operand).toBeGreaterThanOrEqual(1);
    }
  });

  it('division always evenly divides the current total', () => {
    const settings = settingsWith({ enabledOps: ['÷'], maxByOp: { ...DEFAULT_SETTINGS.maxByOp, '÷': 12 } });
    for (const total of [12, 24, 7, 1, 0]) {
      for (let trial = 0; trial < 20; trial++) {
        const step = generateStep(total, settings, Math.random);
        expect(step.op).toBe('÷');
        if (total !== 0) {
          expect(total % step.operand).toBe(0);
        }
      }
    }
  });

  it('never drops the total below 0 when allowNegative is false', () => {
    const settings = settingsWith({ enabledOps: ['+', '-', '÷'], allowNegative: false });
    for (const total of [0, 1, 2, 5]) {
      for (let trial = 0; trial < 50; trial++) {
        const step = generateStep(total, settings, Math.random);
        expect(step.total).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('falls back to a safe operation when the only enabled op is impossible at total 0', () => {
    const settings = settingsWith({ enabledOps: ['-'], allowNegative: false });
    const step = generateStep(0, settings, Math.random);
    expect(step.total).toBeGreaterThanOrEqual(0);
  });

  it('applies the operand deterministically for a given rng', () => {
    const settings = settingsWith({ enabledOps: ['+'], maxByOp: { ...DEFAULT_SETTINGS.maxByOp, '+': 10 } });
    // A single enabled op means shuffle makes no rng calls; the only call left picks the operand.
    const rng = sequenceRng([0.99]);
    const step = generateStep(3, settings, rng);
    expect(step.op).toBe('+');
    expect(step.operand).toBe(10); // 0.99 -> floor(0.99*10)+1 = 10
    expect(step.total).toBe(13);
  });

  it('avoids repeating the previous operand when another operand is available', () => {
    const settings = settingsWith({ enabledOps: ['+'], maxByOp: { ...DEFAULT_SETTINGS.maxByOp, '+': 3 } });
    const rng = sequenceRng([0.5]);
    const step = generateStep(3, settings, rng, 2);

    expect(step.op).toBe('+');
    expect(step.operand).toBe(3);
    expect(step.total).toBe(6);
  });

  it('never pushes the total above maxTotal via addition', () => {
    const settings = settingsWith({ enabledOps: ['+'], maxByOp: { ...DEFAULT_SETTINGS.maxByOp, '+': 50 }, maxTotal: 20 });
    for (const total of [0, 5, 19, 20]) {
      for (let trial = 0; trial < 50; trial++) {
        const step = generateStep(total, settings, Math.random);
        expect(step.total).toBeLessThanOrEqual(20);
      }
    }
  });

  it('never pushes the total above maxTotal via multiplication', () => {
    const settings = settingsWith({ enabledOps: ['×'], maxByOp: { ...DEFAULT_SETTINGS.maxByOp, '×': 20 }, maxTotal: 20 });
    for (const total of [0, 1, 4, 7, 20]) {
      for (let trial = 0; trial < 50; trial++) {
        const step = generateStep(total, settings, Math.random);
        expect(step.total).toBeLessThanOrEqual(20);
      }
    }
  });

  it('only multiplies when both factors fit within the configured max', () => {
    const settings = settingsWith({ enabledOps: ['×'], maxByOp: { ...DEFAULT_SETTINGS.maxByOp, '×': 5 } });

    const maxByMax = generateStep(5, settings, sequenceRng([0.99]));
    expect(maxByMax.op).toBe('×');
    expect(maxByMax.operand).toBe(5);
    expect(maxByMax.total).toBe(25);

    const tooLargeFactor = generateStep(17, settings, Math.random);
    expect(tooLargeFactor.op).not.toBe('×');
  });

  it('only divides when both divisor and result fit within the configured max', () => {
    const settings = settingsWith({ enabledOps: ['÷'], maxByOp: { ...DEFAULT_SETTINGS.maxByOp, '÷': 5 } });

    const maxDividend = generateStep(25, settings, sequenceRng([0]));
    expect(maxDividend.op).toBe('÷');
    expect(maxDividend.operand).toBe(5);
    expect(maxDividend.total).toBe(5);

    const tooLargeResult = generateStep(30, settings, sequenceRng([0]));
    expect(tooLargeResult.op).not.toBe('÷');
  });

  it('stays within bounds and never crashes when the total is pinned exactly at maxTotal', () => {
    // Only "+" enabled, total already equals the cap: "+" alone is impossible for any
    // positive operand, forcing the fallback chain to kick in.
    const settings = settingsWith({ enabledOps: ['+'], maxByOp: { ...DEFAULT_SETTINGS.maxByOp, '+': 10 }, maxTotal: 20 });
    const step = generateStep(20, settings, Math.random);
    expect(step.total).toBeLessThanOrEqual(20);
    expect(step.total).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(step.total)).toBe(true);
  });
});
