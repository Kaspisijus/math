import { ALL_OPERATIONS, type Operation, type Settings, type Step } from '../types';

export type RandomFn = () => number;

/**
 * How a × or ÷ step uses its numbers: against 0 (`0 × 4`, `0 ÷ 3`), against 1
 * (`5 × 1`, `1 × 4`, `4 ÷ 1`, `4 ÷ 4`) or with normal numbers only (`3 × 4`, `16 ÷ 4`).
 */
type MultiplicativeKind = 'zero' | 'one' | 'normal';

type KindCounts = Record<MultiplicativeKind, number>;

const KINDS: MultiplicativeKind[] = ['zero', 'one', 'normal'];

function isMultiplicative(op: Operation): boolean {
  return op === '×' || op === '÷';
}

function isAdditive(op: Operation): boolean {
  return !isMultiplicative(op);
}

function pick<T>(items: T[], rng: RandomFn): T {
  return items[Math.floor(rng() * items.length)];
}

/** Picks a step, avoiding a repeat of the previous operand when another step is available. */
function pickAvoiding(steps: Step[], rng: RandomFn, previousOperand?: number): Step {
  const fresh = steps.filter((step) => step.operand !== previousOperand);
  return pick(fresh.length > 0 ? fresh : steps, rng);
}

/** Every valid `op` step from `total`: within the op's max, `maxTotal` and the negative rule. */
function stepsFor(op: Operation, total: number, settings: Settings): Step[] {
  const max = settings.maxByOp[op];
  const steps: Step[] = [];

  if (op === '+') {
    const upperBound = Math.min(max, settings.maxTotal - total);
    for (let operand = 1; operand <= upperBound; operand++) {
      steps.push({ op, operand, total: total + operand });
    }
  } else if (op === '-') {
    const upperBound = settings.allowNegative ? max : Math.min(max, total);
    for (let operand = 1; operand <= upperBound; operand++) {
      steps.push({ op, operand, total: total - operand });
    }
  } else if (op === '×') {
    // Both factors must fit within max. A non-positive total can only grow further from 0
    // (never past maxTotal on the positive side), so the cap only matters once it is positive.
    if (Math.abs(total) > max) return steps;
    const upperBound = total > 0 ? Math.min(max, Math.floor(settings.maxTotal / total)) : max;
    for (let operand = 1; operand <= upperBound; operand++) {
      steps.push({ op, operand, total: total * operand });
    }
  } else {
    // Both the divisor and the result must fit within max. Dividing only shrinks the total's
    // magnitude, so it can never push it outside bounds that the current total already satisfies.
    for (let divisor = 1; divisor <= max; divisor++) {
      const result = total / divisor;
      if (Number.isInteger(result) && Math.abs(result) <= max) {
        steps.push({ op, operand: divisor, total: result });
      }
    }
  }

  return steps;
}

/** The kind of a × or ÷ step taken from `totalBefore`; `null` for + and −. */
function kindOf(step: Step, totalBefore: number): MultiplicativeKind | null {
  if (!isMultiplicative(step.op)) return null;
  if (totalBefore === 0) return 'zero';
  // The number besides the operand: the other factor for ×, the result for ÷.
  const otherNumber = step.op === '×' ? totalBefore : step.total;
  return step.operand === 1 || Math.abs(otherNumber) === 1 ? 'one' : 'normal';
}

/** The largest number × and ÷ may use (the settings screen sets both to the same value). */
function multiplicativeMax(settings: Settings): number {
  return Math.max(settings.maxByOp['×'], settings.maxByOp['÷']);
}

/**
 * With X as the × / ÷ max, one in every X of those steps goes against 0, one against 1 and
 * the rest use normal numbers. Kinds are dealt like cards from a bag of X, so the split holds
 * within every X steps instead of only on average; this returns what is left in the current bag.
 */
function kindsLeft(history: readonly Step[], settings: Settings): KindCounts {
  const bag: KindCounts = { zero: 1, one: 1, normal: Math.max(multiplicativeMax(settings) - 2, 0) };
  const bagSize = bag.zero + bag.one + bag.normal;
  const dealt = history.flatMap((step, i) => kindOf(step, i === 0 ? 0 : history[i - 1].total) ?? []);

  const left = { ...bag };
  for (const kind of dealt.slice(dealt.length - (dealt.length % bagSize))) {
    left[kind] = Math.max(left[kind] - 1, 0);
  }
  return left;
}

function drawKind(
  left: KindCounts,
  allowed: MultiplicativeKind[],
  rng: RandomFn
): MultiplicativeKind | undefined {
  const cards = allowed.flatMap((kind) => Array<MultiplicativeKind>(left[kind]).fill(kind));
  return cards.length > 0 ? pick(cards, rng) : undefined;
}

/** Enabled ops used the fewest times so far this round (the opening step doesn't count). */
function leastUsedOps(history: readonly Step[], enabledOps: Operation[]): Operation[] {
  const uses = (op: Operation) => history.slice(1).filter((step) => step.op === op).length;
  const fewest = Math.min(...enabledOps.map(uses));
  return enabledOps.filter((op) => uses(op) === fewest);
}

function normalStepPossible(total: number, settings: Settings): boolean {
  return settings.enabledOps.some(
    (op) =>
      isMultiplicative(op) &&
      stepsFor(op, total, settings).some((step) => kindOf(step, total) === 'normal')
  );
}

/** Last resort when no enabled op can go: any op at all, then `×1`, which is always valid. */
function fallbackStep(
  total: number,
  settings: Settings,
  rng: RandomFn,
  previousOperand?: number
): Step {
  for (const op of ALL_OPERATIONS) {
    const steps = stepsFor(op, total, settings);
    if (steps.length > 0) return pickAvoiding(steps, rng, previousOperand);
  }
  return { op: '×', operand: 1, total };
}

/**
 * The opening step sets the starting number. It is always + from 0: a round that opened with
 * × or ÷ would stay at 0 for good (`0 × 4 = 0`, `0 ÷ 3 = 0`), and one that opened with − would
 * start below 0.
 */
function openingStep(settings: Settings, rng: RandomFn): Step {
  const opening = settings.enabledOps.includes('+') ? stepsFor('+', 0, settings) : [];
  if (opening.length > 0) return pick(opening, rng);
  if (!settings.enabledOps.some(isMultiplicative)) return fallbackStep(0, settings, rng);

  // No enabled + step can open the round (e.g. only × / ÷ are on): start from a number × and ÷
  // can work with, 2..max when there is room.
  const upperBound = Math.min(multiplicativeMax(settings), settings.maxTotal);
  const lowerBound = Math.min(2, upperBound);
  const operand = lowerBound + Math.floor(rng() * (upperBound - lowerBound + 1));
  return { op: '+', operand, total: operand };
}

/**
 * A least-used × / ÷ can't do a `kind` step from `total`, so an additive step moves the total to
 * where it can: straight there when one step reaches, otherwise as close as the + / − max allows.
 */
function bridgeStep(
  total: number,
  due: Operation[],
  kind: MultiplicativeKind,
  settings: Settings,
  rng: RandomFn,
  previousOperand: number
): Step | undefined {
  const targets = due.filter(isMultiplicative);
  const additive = settings.enabledOps.filter(isAdditive).flatMap((op) => stepsFor(op, total, settings));
  if (targets.length === 0 || additive.length === 0) return undefined;

  const op = pick(targets, rng);
  const fits = (value: number) =>
    stepsFor(op, value, settings).some((step) => kindOf(step, value) === kind);

  const landing = additive.filter((step) => fits(step.total));
  if (landing.length > 0) return pickAvoiding(landing, rng, previousOperand);

  const goals: number[] = [];
  for (let value = settings.allowNegative ? -settings.maxTotal : 0; value <= settings.maxTotal; value++) {
    if (fits(value)) goals.push(value);
  }
  if (goals.length === 0) return undefined;

  const distance = (step: Step) => Math.min(...goals.map((goal) => Math.abs(goal - step.total)));
  const closest = Math.min(...additive.map(distance));
  return pickAvoiding(
    additive.filter((step) => distance(step) === closest),
    rng,
    previousOperand
  );
}

/**
 * Picks the next step of a round from the steps so far (`history` is empty for the opening
 * step, see `openingStep`):
 * - the least-used enabled op goes next, so every op keeps coming up;
 * - × and ÷ follow the split between steps against 0, against 1 and normal ones: the kind is
 *   drawn from the bag (see `kindsLeft`), and when a least-used × / ÷ can't do it from the
 *   current total, an additive step moves the total to where it can (see `bridgeStep`);
 * - the previous operand isn't repeated when another choice exists.
 * Some settings pin the total so that no enabled op can go at all (e.g. only + is on and the
 * total already sits at `maxTotal`) — in that case every op is tried as a fallback, and as an
 * absolute last resort the total is left unchanged (`×1`), which is always valid since it
 * doesn't move the total outside bounds it already satisfies.
 */
export function generateStep(
  history: readonly Step[],
  settings: Settings,
  rng: RandomFn = Math.random
): Step {
  const last = history[history.length - 1];
  if (!last) return openingStep(settings, rng);

  const { total, operand: previousOperand } = last;
  const left = kindsLeft(history, settings);
  const stepsByOp = new Map(settings.enabledOps.map((op) => [op, stepsFor(op, total, settings)]));
  const stepsOf = (op: Operation) => stepsByOp.get(op) ?? [];
  const stepsOfKind = (op: Operation, kind: MultiplicativeKind) =>
    stepsOf(op).filter((step) => kindOf(step, total) === kind);
  // + / − can go whenever they have a step; × / ÷ only with a step of the given kind.
  const opsThatCanGo = (ops: Operation[], kind: MultiplicativeKind) =>
    ops.filter((op) =>
      isMultiplicative(op) ? stepsOfKind(op, kind).length > 0 : stepsOf(op).length > 0
    );
  const take = (op: Operation, kind: MultiplicativeKind) =>
    pickAvoiding(isMultiplicative(op) ? stepsOfKind(op, kind) : stepsOf(op), rng, previousOperand);

  // The total only gets back to 0 now and then, so that's the moment for a step against 0.
  if (total === 0 && left.zero > 0) {
    const zeroOps = opsThatCanGo(settings.enabledOps.filter(isMultiplicative), 'zero');
    if (zeroOps.length > 0) return take(pick(zeroOps, rng), 'zero');
  }

  const wanted = drawKind(left, KINDS, rng) ?? 'normal';
  const due = leastUsedOps(history, settings.enabledOps);
  const dueNow = opsThatCanGo(due, wanted);
  if (dueNow.length > 0) return take(pick(dueNow, rng), wanted);

  const bridge = bridgeStep(total, due, wanted, settings, rng, previousOperand);
  if (bridge) return bridge;

  // Nothing least-used can go: any enabled op, with × / ÷ doing the wanted kind if they can,
  // else a normal step, else another kind still in the bag.
  const kindsToTry = new Set<MultiplicativeKind>([
    wanted,
    'normal',
    ...KINDS.filter((kind) => left[kind] > 0),
  ]);
  for (const kind of kindsToTry) {
    const ops = opsThatCanGo(settings.enabledOps, kind);
    if (ops.length > 0) return take(pick(ops, rng), kind);
  }

  // No kind still in the bag fits from here (e.g. only × / ÷ are on and the total is 1):
  // prefer a step leading to where a normal one is possible.
  const enabledSteps = settings.enabledOps.flatMap(stepsOf);
  const towardsNormal = enabledSteps.filter((step) => normalStepPossible(step.total, settings));
  for (const steps of [towardsNormal, enabledSteps]) {
    if (steps.length > 0) return pickAvoiding(steps, rng, previousOperand);
  }

  return fallbackStep(total, settings, rng, previousOperand);
}
