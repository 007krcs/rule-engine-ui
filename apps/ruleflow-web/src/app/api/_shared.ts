import { NextResponse } from 'next/server';
import { getMockSession, type Role } from '@/lib/auth';
import type { ConfigBundle } from '@/lib/demo/types';
import { getConfigStore, getStoreDiagnostics, isPersistenceError } from '@/server/repository';
import { recordApiCall } from '@/server/metrics';
import { appendImmutableAuditEvent } from '@/server/immutable-audit';
import {
  evaluatePolicies,
  requireRole,
  type PolicyCheckStage,
  type PolicyError,
} from '@/server/policy-engine';

export const STORE_WRITE_FAILED_MESSAGE = 'Store write failed';

const NO_STORE_HEADERS = {
  'cache-control': 'no-store',
};

export function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

export async function withApiErrorHandling(handler: () => Promise<NextResponse>) {
  const startedAt = Date.now();
  const session = getMockSession();
  const metricLabels = {
    tenantId: session.tenantId,
    env: process.env.RULEFLOW_ENV ?? process.env.NODE_ENV ?? 'dev',
  };
  try {
    await getConfigStore();
    const response = await handler();
    recordApiCall(Date.now() - startedAt, response.status, metricLabels);
    await appendImmutableAuditEvent({
      tenantId: session.tenantId,
      actor: session.user.id,
      category: 'api',
      action: 'API request completed',
      target: 'http',
      metadata: {
        status: response.status,
      },
    });
    return response;
  } catch (error) {
    const diagnostics = await getStoreDiagnostics().catch(() => null);

    if (isPersistenceError(error)) {
      const response = noStoreJson(
        {
          ok: false,
          error: STORE_WRITE_FAILED_MESSAGE,
          diagnostics,
        },
        500,
      );
      recordApiCall(Date.now() - startedAt, response.status, metricLabels);
      await appendImmutableAuditEvent({
        tenantId: session.tenantId,
        actor: session.user.id,
        category: 'api',
        action: 'API request failed',
        target: 'http',
        metadata: { status: response.status, type: 'persistence' },
      });
      return response;
    }

    const message = error instanceof Error ? error.message : String(error);

    const response = noStoreJson(
      {
        ok: false,
        error: message,
        diagnostics,
      },
      500,
    );
    recordApiCall(Date.now() - startedAt, response.status, metricLabels);
    await appendImmutableAuditEvent({
      tenantId: session.tenantId,
      actor: session.user.id,
      category: 'api',
      action: 'API request failed',
      target: 'http',
      metadata: { status: response.status, message },
    });
    return response;
  }
}

export async function requirePolicy(input: {
  stage: PolicyCheckStage;
  requiredRole?: Role;
  metadata?: Record<string, unknown>;
  currentBundle?: ConfigBundle;
  nextBundle?: ConfigBundle;
}): Promise<NextResponse | null> {
  const session = getMockSession();
  const errors: PolicyError[] = [];

  if (input.requiredRole) {
    errors.push(...requireRole({ session }, input.requiredRole, input.stage));
  }

  errors.push(
    ...(await evaluatePolicies({
      stage: input.stage,
      tenantId: session.tenantId,
      userId: session.user.id,
      roles: session.roles,
      currentBundle: input.currentBundle,
      nextBundle: input.nextBundle,
      metadata: input.metadata,
    })),
  );

  if (errors.length === 0) {
    return null;
  }

  return noStoreJson(
    {
      ok: false,
      error: 'policy_failed',
      policyErrors: errors,
    },
    403,
  );
}

