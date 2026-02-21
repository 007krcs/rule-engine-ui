import crypto from 'node:crypto';

type FeatureFlagLike = {
  key: string;
  enabled: boolean;
  value?: Record<string, unknown>;
};

type RolloutPhase = {
  name: string;
  startAt?: string;
  endAt?: string;
  enabled?: boolean;
  rolloutPercentage?: number;
};

type RolloutConfig = {
  rolloutPercentage?: number;
  tenantAllowlist?: string[];
  tenantDenylist?: string[];
  startAt?: string;
  endAt?: string;
  phases?: RolloutPhase[];
  activePhase?: string;
};

export type FeatureFlagEvaluationContext = {
  tenantId: string;
  now?: Date;
};

export function toFeatureFlagMap(
  flags: ReadonlyArray<FeatureFlagLike>,
  context: FeatureFlagEvaluationContext,
): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const flag of flags) {
    map[flag.key] = isFeatureFlagEnabled(flag, context);
  }
  return map;
}

export function isFeatureFlagEnabled(
  flag: FeatureFlagLike,
  context: FeatureFlagEvaluationContext,
): boolean {
  if (!flag.enabled) return false;
  const cfg = parseRolloutConfig(flag.value);
  const tenant = normalize(context.tenantId);
  if (cfg.tenantDenylist?.includes(tenant)) return false;
  if (cfg.tenantAllowlist && cfg.tenantAllowlist.length > 0) {
    return cfg.tenantAllowlist.includes(tenant);
  }

  const now = context.now ?? new Date();
  const activePhase = resolveActivePhase(cfg, now);
  const gatedByWindow = inWindow(activePhase?.startAt ?? cfg.startAt, activePhase?.endAt ?? cfg.endAt, now);
  if (!gatedByWindow) return false;
  if (activePhase && activePhase.enabled === false) return false;

  const rolloutPercentage = clampPercent(
    activePhase?.rolloutPercentage ?? cfg.rolloutPercentage ?? 100,
  );
  if (rolloutPercentage >= 100) return true;
  if (rolloutPercentage <= 0) return false;

  const bucket = deterministicPercentBucket(`${tenant}:${flag.key}`);
  return bucket < rolloutPercentage;
}

function parseRolloutConfig(value: unknown): RolloutConfig {
  const rec = asRecord(value);
  const phasesRaw = Array.isArray(rec?.phases) ? rec.phases : [];
  const phases: RolloutPhase[] = phasesRaw
    .map((phase) => asRecord(phase))
    .filter(Boolean)
    .map((phase) => ({
      name: asString(phase?.name) ?? 'phase',
      startAt: asString(phase?.startAt),
      endAt: asString(phase?.endAt),
      enabled: asBool(phase?.enabled),
      rolloutPercentage: asNumber(phase?.rolloutPercentage),
    }));

  return {
    rolloutPercentage: asNumber(rec?.rolloutPercentage),
    tenantAllowlist: toNormalizedList(rec?.tenantAllowlist),
    tenantDenylist: toNormalizedList(rec?.tenantDenylist),
    startAt: asString(rec?.startAt),
    endAt: asString(rec?.endAt),
    phases,
    activePhase: asString(rec?.activePhase),
  };
}

function resolveActivePhase(config: RolloutConfig, now: Date): RolloutPhase | undefined {
  if (!config.phases || config.phases.length === 0) return undefined;
  if (config.activePhase) {
    const explicit = config.phases.find((phase) => phase.name === config.activePhase);
    if (explicit) return explicit;
  }
  return config.phases.find((phase) => inWindow(phase.startAt, phase.endAt, now));
}

function inWindow(startAt: string | undefined, endAt: string | undefined, now: Date): boolean {
  const nowMs = now.getTime();
  const startMs = parseTime(startAt);
  const endMs = parseTime(endAt);
  if (startMs !== null && nowMs < startMs) return false;
  if (endMs !== null && nowMs > endMs) return false;
  return true;
}

function parseTime(value: string | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function deterministicPercentBucket(seed: string): number {
  const hash = crypto.createHash('sha256').update(seed, 'utf8').digest('hex').slice(0, 8);
  const n = Number.parseInt(hash, 16);
  if (!Number.isFinite(n)) return 0;
  return (n / 0xffffffff) * 100;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asBool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function toNormalizedList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((entry) => (typeof entry === 'string' ? normalize(entry) : ''))
    .filter((entry) => entry.length > 0);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
