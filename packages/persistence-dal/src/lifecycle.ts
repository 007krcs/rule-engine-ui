import type { ConfigLifecycleStatus } from './types';

const allowedTransitions: Record<ConfigLifecycleStatus, ReadonlyArray<ConfigLifecycleStatus>> = {
  Draft: ['Submitted'],
  Submitted: ['Approved'],
  Approved: ['Deprecated'],
  Deprecated: ['Deleted'],
  Deleted: [],
};

export function canTransitionLifecycle(
  from: ConfigLifecycleStatus,
  to: ConfigLifecycleStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertLifecycleTransition(
  from: ConfigLifecycleStatus,
  to: ConfigLifecycleStatus,
): void {
  if (!canTransitionLifecycle(from, to)) {
    throw new Error(`Invalid lifecycle transition: ${from} -> ${to}`);
  }
}
