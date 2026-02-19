export interface PlaygroundSnapshot {
  stepCount: number;
  firstStep: string;
  componentCount: number;
}

export function buildPlaygroundSnapshot(
  queue: string[],
  componentCount: number,
): PlaygroundSnapshot {
  return {
    stepCount: queue.length,
    firstStep: queue[0] ?? 'none',
    componentCount,
  };
}
