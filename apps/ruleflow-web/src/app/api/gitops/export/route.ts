import { NextResponse } from 'next/server';
import { exportGitOpsBundle } from '@/server/demo/repository';

export const runtime = 'nodejs';

export async function GET() {
  const bundle = await exportGitOpsBundle();
  const filename = `ruleflow-gitops-${bundle.tenantId}-${bundle.exportedAt.slice(0, 10)}.json`;
  return NextResponse.json(bundle, {
    headers: {
      'cache-control': 'no-store',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}

