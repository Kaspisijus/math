import { ALL_OPERATIONS, type Operation, type Settings, type Step } from '../types';

export type RandomFn = () => number;

function randInt(rng: RandomFn, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randIntExcept(rng: RandomFn, min: number, max: number, excluded?: number): number {
  if (excluded === undefined || excluded < min || excluded > max || min === max) {
    return randInt(rng, min, max);
  }

  const value = randInt(rng, min, max - 1);
  return value >= excluded ? value + 1 : value;
}

function shuffled<T>(items: T[], rng: RandomFn): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function divisorsOf(n: number, max: number): number[] {
  const abs = Math.abs(n);
  const divisors: number[] = [];
  for (let d = 1; d <= max; d++) {
    if (abs === 0 || abs % d === 0) divisors.push(d);
  }
  return divisors;
}

function tryOperation(
  op: Operation,
  total: number,
  settings: Settings,
  rng: RandomFn,
  previousOperand?: number
): Step | null {
  const max = settings.maxByOp[op];

  if (op === '+') {
    const upperBound = Math.min(max, settings.maxTotal - total);
    if (upperBound < 1) return null;
    const operand = randIntExcept(rng, 1, upperBound, previousOperand);
    return { op, operand, total: total + operand };
  }

  if (op === '-') {
    const upperBound = settings.allowNegative ? max : Math.min(max, total);
    if (upperBound < 1) return null;
    const operand = randIntExcept(rng, 1, upperBound, previousOperand);
    return { op, operand, total: total - operand };
  }

  if (op === '×') {
    if (Math.abs(total) > max) return null;
    // A non-positive total can only grow further from 0 (never past maxTotal on the
    // positive side), so the cap on operand only matters once the total is positive.
    const upperBound = total > 0 ? Math.min(max, Math.floor(settings.maxTotal / total)) : max;
    if (upperBound < 1) return null;
    const operand = randIntExcept(rng, 1, upperBound, previousOperand);
    return { op, operand, total: total * operand };
  }

  // op === '÷' — dividing only shrinks the total's magnitude, so it can never
  // push it outside bounds that the current total already satisfies.
  const divisors = divisorsOf(total, max).filter((divisor) => Math.abs(total / divisor) <= max);
  if (divisors.length === 0) return null;
  const eligibleDivisors =
    previousOperand === undefined || divisors.length === 1
      ? divisors
      : divisors.filter((divisor) => divisor !== previousOperand);
  const operand = eligibleDivisors[Math.floor(rng() * eligibleDivisors.length)];
  return { op, operand, total: total === 0 ? 0 : total / operand };
}

/**
 * Picks a random enabled operation that produces a valid next step and
 * applies it to `currentTotal`. Some settings combinations can pin the total
 * so that no enabled operation is currently possible (e.g. only `+` is
 * enabled and the total already sits at `maxTotal`) — in that case every
 * operation is tried as a fallback, and as an absolute last resort the total
 * is left unchanged (`×1`), which is always valid since it doesn't move the
 * total outside bounds it already satisfies.
 */
export function generateStep(
  currentTotal: number,
  settings: Settings,
  rng: RandomFn = Math.random,
  previousOperand?: number
): Step {
  const candidateOps = shuffled(settings.enabledOps, rng);

  for (const op of candidateOps) {
    const step = tryOperation(op, currentTotal, settings, rng, previousOperand);
    if (step) return step;
  }

  for (const op of ALL_OPERATIONS) {
    const step = tryOperation(op, currentTotal, settings, rng, previousOperand);
    if (step) return step;
  }

  return { op: '×', operand: 1, total: currentTotal };
}
