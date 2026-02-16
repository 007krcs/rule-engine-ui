import { getMockSession } from '@/lib/auth';
import { noStoreJson } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function GET() {
  const session = getMockSession();
  return noStoreJson({
    ok: true,
    session: {
      user: session.user,
      tenantId: session.tenantId,
      roles: session.roles,
    },
  });
}
