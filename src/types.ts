export type Operation = '+' | '-' | '×' | '÷';

export const ALL_OPERATIONS: Operation[] = ['+', '-', '×', '÷'];

export interface Settings {
  enabledOps: Operation[];
  maxByOp: Record<Operation, number>;
  allowNegative: boolean;
  maxTotal: number;
}

export interface Step {
  op: Operation;
  operand: number;
  total: number;
}

export const ROUND_DURATION_SECONDS = 60;
export const ANSWER_DURATION_SECONDS = 15;
