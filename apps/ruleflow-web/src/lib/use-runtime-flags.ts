'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet } from '@/lib/demo/api-client';

const RUNTIME_FLAGS_TTL_MS = 15_000;

type RuntimeKillSource = {
  scope: string;
  reason?: string;
};

type RuntimeKillSwitch = {
  active: boolean;
  reason?: string;
  sources: RuntimeKillSource[];
};

type RuntimeFlagsPayload = {
  ok: true;
  tenantId: string;
  env: string;
  featureFlags: Record<string, boolean>;
  killSwitch: RuntimeKillSwitch;
};

type RuntimeFlagsCacheEntry = {
  expiresAt: number;
  data: RuntimeFlagsPayload;
};

const runtimeFlagsCache = new Map<string, RuntimeFlagsCacheEntry>();
const runtimeFlagsInflight = new Map<string, Promise<RuntimeFlagsPayload>>();

function buildRuntimeFlagsUrl(input: {
  env?: string;
  versionId?: string;
  packageId?: string;
}): string {
  const params = new URLSearchParams();
  if (input.env) params.set('env', input.env);
  if (input.versionId) params.set('versionId', input.versionId);
  if (input.packageId) params.set('packageId', input.packageId);
  const query = params.toString();
  return query ? `/api/runtime-flags?${query}` : '/api/runtime-flags';
}

async function fetchRuntimeFlags(cacheKey: string, url: string): Promise<RuntimeFlagsPayload> {
  const cached = runtimeFlagsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const inflight = runtimeFlagsInflight.get(cacheKey);
  if (inflight) {
    return await inflight;
  }

  const pending = apiGet<RuntimeFlagsPayload>(url)
    .then((data) => {
      runtimeFlagsCache.set(cacheKey, {
        data,
        expiresAt: Date.now() + RUNTIME_FLAGS_TTL_MS,
      });
      return data;
    })
    .finally(() => {
      runtimeFlagsInflight.delete(cacheKey);
    });

  runtimeFlagsInflight.set(cacheKey, pending);
  return await pending;
}

export function useRuntimeFlags(input: {
  env?: string;
  versionId?: string;
  packageId?: string;
}) {
  const url = useMemo(() => buildRuntimeFlagsUrl(input), [input.env, input.packageId, input.versionId]);
  const cacheKey = useMemo(() => url, [url]);
  const cached = runtimeFlagsCache.get(cacheKey);

  const [data, setData] = useState<RuntimeFlagsPayload | null>(cached?.data ?? null);
  const [loading, setLoading] = useState<boolean>(!cached);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (force = false) => {
      const existing = runtimeFlagsCache.get(cacheKey);
      if (!force && existing && existing.expiresAt > Date.now()) {
        setData(existing.data);
        setLoading(false);
        setError(null);
        return existing.data;
      }

      setLoading(true);
      try {
        const next = await fetchRuntimeFlags(cacheKey, url);
        setData(next);
        setError(null);
        return next;
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [cacheKey, url],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await load(false);
      if (cancelled || !next) return;
      setData(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return {
    loading,
    error,
    tenantId: data?.tenantId,
    env: data?.env ?? input.env ?? 'prod',
    featureFlags: data?.featureFlags ?? {},
    killSwitch:
      data?.killSwitch ?? {
        active: false,
        sources: [],
      },
    refresh: async () => await load(true),
  };
}
