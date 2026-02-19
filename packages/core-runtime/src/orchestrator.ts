export interface ExecutionPlan {
  readonly queue: string[];
  readonly skipped: string[];
}

export function buildExecutionQueue(steps: readonly string[]): string[] {
  return steps
    .map((step) => step.trim())
    .filter((step, index, queue) => step.length > 0 && queue.indexOf(step) === index);
}

export function createExecutionPlan(
  requestedSteps: readonly string[],
  disabledSteps: readonly string[] = [],
): ExecutionPlan {
  const disabled = new Set(disabledSteps.map((step) => step.trim()).filter((step) => step.length > 0));
  const queue = buildExecutionQueue(requestedSteps).filter((step) => !disabled.has(step));

  return {
    queue,
    skipped: Array.from(disabled),
  };
}
