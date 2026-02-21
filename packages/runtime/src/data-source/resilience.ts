import type { RequestResiliencePolicy } from './DataSourceAdapter';

interface CircuitState {
  failures: number;
  openedAt: number | null;
}

interface ResolvedPolicy {
  timeoutMs: number;
  retry: {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    jitter: boolean;
  };
  circuitBreaker: {
    failureThreshold: number;
    cooldownMs: number;
  };
}

const circuitStates = new Map<string, CircuitState>();

export async function executeWithResilience<T>(
  key: string,
  operation: () => Promise<T>,
  policy?: RequestResiliencePolicy,
): Promise<T> {
  const mergedPolicy: ResolvedPolicy = {
    timeoutMs: policy?.timeoutMs ?? 30_000,
    retry: {
      maxRetries: policy?.retry?.maxRetries ?? 0,
      baseDelayMs: policy?.retry?.baseDelayMs ?? 200,
      maxDelayMs: policy?.retry?.maxDelayMs ?? 5_000,
      jitter: policy?.retry?.jitter ?? true,
    },
    circuitBreaker: {
      failureThreshold: policy?.circuitBreaker?.failureThreshold ?? 5,
      cooldownMs: policy?.circuitBreaker?.cooldownMs ?? 20_000,
    },
  };

  guardCircuit(key, mergedPolicy);
  const maxAttempts = Math.max(1, mergedPolicy.retry.maxRetries + 1);
  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const result = await withTimeout(operation(), mergedPolicy.timeoutMs);
      resetCircuit(key);
      return result;
    } catch (error) {
      lastError = error;
      registerFailure(key, mergedPolicy);
      if (attempt >= maxAttempts) break;
      await sleep(calculateBackoff(attempt, mergedPolicy));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Data source request failed.');
}

function guardCircuit(key: string, policy: ResolvedPolicy): void {
  const state = circuitStates.get(key);
  if (!state || state.openedAt === null) return;
  const elapsed = Date.now() - state.openedAt;
  if (elapsed >= policy.circuitBreaker.cooldownMs) {
    state.openedAt = null;
    state.failures = 0;
    return;
  }
  throw new Error(`Circuit open for ${key}; retry after cooldown.`);
}

function registerFailure(key: string, policy: ResolvedPolicy): void {
  const state = circuitStates.get(key) ?? { failures: 0, openedAt: null };
  state.failures += 1;
  if (state.failures >= policy.circuitBreaker.failureThreshold) {
    state.openedAt = Date.now();
  }
  circuitStates.set(key, state);
}

function resetCircuit(key: string): void {
  circuitStates.set(key, { failures: 0, openedAt: null });
}

function calculateBackoff(attempt: number, policy: ResolvedPolicy): number {
  const exp = policy.retry.baseDelayMs * Math.pow(2, Math.max(0, attempt - 1));
  const capped = Math.min(policy.retry.maxDelayMs, exp);
  if (!policy.retry.jitter) return capped;
  return Math.floor(capped * (0.75 + Math.random() * 0.5));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
