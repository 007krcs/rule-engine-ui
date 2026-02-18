'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet } from '@/lib/demo/api-client';
import {
  adapterPrefixesForIds,
  externalAdapterPrefixesForIds,
  listRuntimeAdapterDefinitions,
  registerRuntimeAdapters,
  type RuntimeAdapterRegistrationResult,
} from '@/lib/runtime-adapters';

const RUNTIME_ADAPTERS_TTL_MS = 15_000;

type RuntimeAdaptersPayload = {
  ok: true;
  tenantId: string;
  env: string;
  enabledAdapterIds: string[];
};

type RuntimeAdaptersCacheEntry = {
  expiresAt: number;
  data: RuntimeAdaptersPayload;
};

type RuntimeAdapterLoadState = {
  loadedAdapterIds: string[];
  results: RuntimeAdapterRegistrationResult[];
};

const runtimeAdaptersCache = new Map<string, RuntimeAdaptersCacheEntry>();
const runtimeAdaptersInflight = new Map<string, Promise<RuntimeAdaptersPayload>>();
const runtimeAdapterLoads = new Map<string, RuntimeAdapterLoadState>();
const runtimeAdapterLoadsInflight = new Map<string, Promise<RuntimeAdapterLoadState>>();

const FALLBACK_ADAPTER_IDS = listRuntimeAdapterDefinitions()
  .filter((definition) => definition.defaultEnabled)
  .map((definition) => definition.id);

function buildRuntimeAdaptersUrl(input: {
  env?: string;
  versionId?: string;
  packageId?: string;
}): string {
  const params = new URLSearchParams();
  if (input.env) params.set('env', input.env);
  if (input.versionId) params.set('versionId', input.versionId);
  if (input.packageId) params.set('packageId', input.packageId);
  const query = params.toString();
  return query ? `/api/runtime-adapters?${query}` : '/api/runtime-adapters';
}

function registrationCacheKey(adapterIds: readonly string[]): string {
  return [...new Set(adapterIds.map((id) => id.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .join('|');
}

async function fetchRuntimeAdapters(cacheKey: string, url: string): Promise<RuntimeAdaptersPayload> {
  const cached = runtimeAdaptersCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const inflight = runtimeAdaptersInflight.get(cacheKey);
  if (inflight) {
    return await inflight;
  }

  const pending = apiGet<RuntimeAdaptersPayload>(url)
    .then((data) => {
      runtimeAdaptersCache.set(cacheKey, {
        data,
        expiresAt: Date.now() + RUNTIME_ADAPTERS_TTL_MS,
      });
      return data;
    })
    .finally(() => {
      runtimeAdaptersInflight.delete(cacheKey);
    });

  runtimeAdaptersInflight.set(cacheKey, pending);
  return await pending;
}

async function ensureAdaptersRegistered(adapterIds: readonly string[]): Promise<RuntimeAdapterLoadState> {
  const key = registrationCacheKey(adapterIds);
  if (!key) {
    return { loadedAdapterIds: [], results: [] };
  }

  const cached = runtimeAdapterLoads.get(key);
  if (cached) {
    return cached;
  }

  const inflight = runtimeAdapterLoadsInflight.get(key);
  if (inflight) {
    return await inflight;
  }

  const pending = registerRuntimeAdapters(adapterIds)
    .then((results) => {
      const loadedAdapterIds = results.filter((result) => result.ok).map((result) => result.packId);
      const state = { loadedAdapterIds, results };
      runtimeAdapterLoads.set(key, state);
      return state;
    })
    .finally(() => {
      runtimeAdapterLoadsInflight.delete(key);
    });

  runtimeAdapterLoadsInflight.set(key, pending);
  return await pending;
}

export function useRuntimeAdapters(input: {
  env?: string;
  versionId?: string;
  packageId?: string;
}) {
  const url = useMemo(() => buildRuntimeAdaptersUrl(input), [input.env, input.packageId, input.versionId]);
  const cacheKey = useMemo(() => url, [url]);
  const cached = runtimeAdaptersCache.get(cacheKey);

  const [data, setData] = useState<RuntimeAdaptersPayload | null>(cached?.data ?? null);
  const [loadState, setLoadState] = useState<RuntimeAdapterLoadState>(() => {
    const ids = cached?.data.enabledAdapterIds ?? FALLBACK_ADAPTER_IDS;
    return runtimeAdapterLoads.get(registrationCacheKey(ids)) ?? {
      loadedAdapterIds: [],
      results: [],
    };
  });
  const [loading, setLoading] = useState<boolean>(!cached);
  const [error, setError] = useState<string | null>(null);

  const enabledAdapterIds = data?.enabledAdapterIds ?? FALLBACK_ADAPTER_IDS;

  const load = useCallback(
    async (force = false) => {
      const existing = runtimeAdaptersCache.get(cacheKey);
      if (!force && existing && existing.expiresAt > Date.now()) {
        setData(existing.data);
        setLoading(false);
        setError(null);
        return existing.data;
      }

      setLoading(true);
      try {
        const next = await fetchRuntimeAdapters(cacheKey, url);
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const registered = await ensureAdaptersRegistered(enabledAdapterIds);
      if (cancelled) return;
      setLoadState(registered);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabledAdapterIds]);

  const hasRegistrationResult = loadState.results.length > 0;
  const loadedAdapterIds = hasRegistrationResult
    ? loadState.loadedAdapterIds
    : enabledAdapterIds.filter((id) => FALLBACK_ADAPTER_IDS.includes(id));
  const effectiveLoadedAdapterIds = loadedAdapterIds.length > 0 ? loadedAdapterIds : ['platform'];
  const failedAdapterPacks = loadState.results.filter((result) => !result.ok);

  return {
    loading,
    error,
    tenantId: data?.tenantId,
    env: data?.env ?? input.env ?? 'prod',
    enabledAdapterIds,
    loadedAdapterIds: effectiveLoadedAdapterIds,
    enabledAdapterPrefixes: adapterPrefixesForIds(effectiveLoadedAdapterIds),
    enabledExternalAdapterPrefixes: externalAdapterPrefixesForIds(effectiveLoadedAdapterIds),
    failedAdapterPacks,
    refresh: async () => {
      const next = await load(true);
      if (!next) return null;
      const registered = await ensureAdaptersRegistered(next.enabledAdapterIds);
      setLoadState(registered);
      return next;
    },
  };
}

