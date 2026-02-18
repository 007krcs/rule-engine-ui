import type { PolicyEvaluationInput } from '@/server/policy/types';

const DEFAULT_OPA_TIMEOUT_MS = 1500;
const OPA_CACHE_TTL_MS = 10_000;

type OpaDecisionCacheEntry = {
  expiresAt: number;
  decision: OpaPolicyDecision;
};

const decisionCache = new Map<string, OpaDecisionCacheEntry>();

export type OpaPolicyDecision = {
  allow: boolean;
  messages: string[];
};

export class OpaClientError extends Error {
  readonly code: 'opa_timeout' | 'opa_unreachable' | 'opa_http_error' | 'opa_invalid_response';

  constructor(
    code: OpaClientError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'OpaClientError';
    this.code = code;
  }
}

type OpaConfig = {
  endpoint: string;
  timeoutMs: number;
};

function parseTimeoutMs(rawValue: string | undefined): number {
  if (!rawValue) {
    return DEFAULT_OPA_TIMEOUT_MS;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_OPA_TIMEOUT_MS;
  }
  return Math.floor(parsed);
}

function buildEndpoint(baseUrl: string, packageName: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  if (/\/v1\/data(?:\/|$)/.test(normalizedBase)) {
    return normalizedBase;
  }
  return `${normalizedBase}/v1/data/${packageName.replace(/^\/+/, '')}`;
}

function getOpaConfig(): OpaConfig | null {
  const baseUrl = process.env.OPA_URL?.trim();
  if (!baseUrl) {
    return null;
  }

  const packageName = (process.env.OPA_PACKAGE ?? 'ruleflow/allow').trim();
  return {
    endpoint: buildEndpoint(baseUrl, packageName),
    timeoutMs: parseTimeoutMs(process.env.OPA_TIMEOUT_MS),
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(',')}}`;
}

function getCacheKey(input: PolicyEvaluationInput, endpoint: string): string {
  return `${endpoint}:${stableStringify(input)}`;
}

function parseOpaDecision(payload: unknown): OpaPolicyDecision {
  if (!payload || typeof payload !== 'object') {
    throw new OpaClientError('opa_invalid_response', 'OPA response must be a JSON object.');
  }

  const envelope = payload as { result?: unknown };
  const result = envelope.result;

  if (typeof result === 'boolean') {
    return {
      allow: result,
      messages: [],
    };
  }

  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new OpaClientError(
      'opa_invalid_response',
      'OPA response must include a boolean `result` or an object with `allow`.',
    );
  }

  const typed = result as {
    allow?: unknown;
    allowed?: unknown;
    deny?: unknown;
    reason?: unknown;
    message?: unknown;
    errors?: unknown;
    reasons?: unknown;
  };

  const resolvedAllow =
    typeof typed.allow === 'boolean'
      ? typed.allow
      : typeof typed.allowed === 'boolean'
        ? typed.allowed
        : typeof typed.deny === 'boolean'
          ? !typed.deny
          : null;

  if (resolvedAllow === null) {
    throw new OpaClientError(
      'opa_invalid_response',
      'OPA response object must include `allow` (boolean) or `deny` (boolean).',
    );
  }

  const messages: string[] = [];
  if (typeof typed.reason === 'string' && typed.reason.trim()) {
    messages.push(typed.reason.trim());
  }
  if (typeof typed.message === 'string' && typed.message.trim()) {
    messages.push(typed.message.trim());
  }
  if (Array.isArray(typed.errors)) {
    for (const item of typed.errors) {
      if (typeof item === 'string' && item.trim()) {
        messages.push(item.trim());
      }
    }
  }
  if (Array.isArray(typed.reasons)) {
    for (const item of typed.reasons) {
      if (typeof item === 'string' && item.trim()) {
        messages.push(item.trim());
      }
    }
  }

  return {
    allow: resolvedAllow,
    messages: [...new Set(messages)],
  };
}

async function fetchWithTimeout(endpoint: string, payload: unknown, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new OpaClientError(
        'opa_http_error',
        `OPA request failed with HTTP ${response.status} (${response.statusText || 'unknown'}).`,
      );
    }

    try {
      return await response.json();
    } catch {
      throw new OpaClientError('opa_invalid_response', 'OPA response was not valid JSON.');
    }
  } catch (error) {
    if (error instanceof OpaClientError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new OpaClientError(
        'opa_timeout',
        `OPA request timed out after ${timeoutMs}ms.`,
      );
    }
    throw new OpaClientError(
      'opa_unreachable',
      `OPA request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

export function isOpaConfigured(): boolean {
  return getOpaConfig() !== null;
}

export async function evaluateOpaPolicy(input: PolicyEvaluationInput): Promise<OpaPolicyDecision | null> {
  const config = getOpaConfig();
  if (!config) {
    return null;
  }

  const cacheKey = getCacheKey(input, config.endpoint);
  const cached = decisionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.decision;
  }

  const payload = await fetchWithTimeout(config.endpoint, { input }, config.timeoutMs);
  const decision = parseOpaDecision(payload);
  decisionCache.set(cacheKey, {
    decision,
    expiresAt: Date.now() + OPA_CACHE_TTL_MS,
  });
  return decision;
}

export function clearOpaDecisionCacheForTests(): void {
  decisionCache.clear();
}
