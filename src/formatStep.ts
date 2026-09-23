import type { Step } from './types';

export function formatStep(step: Step): string {
  const separator = step.op === '+' || step.op === '-' ? '' : ' ';
  return `${step.op}${separator}${step.operand}`;
}
