import type { ConfigBundle } from '@/lib/demo/types';
import { getMockSession } from '@/lib/auth';
import {
  evaluatePolicies,
  getPolicyEngineMode,
  type PolicyCheckStage,
} from '@/server/policy-engine';
import { noStoreJson, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const session = getMockSession();
    const body = (await request.json().catch(() => null)) as null | {
      stage?: PolicyCheckStage;
      currentBundle?: ConfigBundle;
      nextBundle?: ConfigBundle;
      metadata?: Record<string, unknown>;
    };

    if (!body || typeof body.stage !== 'string') {
      return noStoreJson({ ok: false, error: 'stage is required' }, 400);
    }

    const errors = await evaluatePolicies({
      stage: body.stage,
      tenantId: session.tenantId,
      userId: session.user.id,
      roles: session.roles,
      currentBundle: body.currentBundle,
      nextBundle: body.nextBundle,
      metadata: body.metadata,
    });

    return noStoreJson({
      ok: true,
      mode: getPolicyEngineMode(),
      errors,
    });
  });
}
