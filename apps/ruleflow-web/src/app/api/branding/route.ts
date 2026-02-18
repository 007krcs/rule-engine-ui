import { getBranding, upsertBranding } from '@/server/repository';
import { noStoreJson, requirePolicy, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function GET() {
  return withApiErrorHandling(async () => {
    const result = await getBranding();
    return noStoreJson(result);
  });
}

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const blocked = await requirePolicy({
      stage: 'promote',
      requiredRole: 'Publisher',
      metadata: { route: 'branding.upsert' },
    });
    if (blocked) {
      return blocked;
    }

    const body = (await request.json().catch(() => null)) as null | {
      logoUrl?: string;
      mode?: 'light' | 'dark' | 'system';
      primaryColor?: string;
      secondaryColor?: string;
      typographyScale?: number;
      radius?: number;
      spacing?: number;
      cssVariables?: Record<string, unknown>;
    };
    if (!body || !body.mode || !body.primaryColor || !body.secondaryColor) {
      return noStoreJson({ ok: false, error: 'mode, primaryColor, secondaryColor are required' }, 400);
    }

    const result = await upsertBranding({
      logoUrl: body.logoUrl,
      mode: body.mode,
      primaryColor: body.primaryColor,
      secondaryColor: body.secondaryColor,
      typographyScale: body.typographyScale ?? 1,
      radius: body.radius ?? 8,
      spacing: body.spacing ?? 8,
      cssVariables: body.cssVariables ?? {},
    });
    if (!result.ok) {
      const status = result.error === 'policy_failed' ? 403 : 400;
      return noStoreJson(result, status);
    }
    return noStoreJson(result);
  });
}
