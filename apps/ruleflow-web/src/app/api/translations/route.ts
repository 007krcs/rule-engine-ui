import {
  getTranslationsSnapshot,
  updateTranslationPreferences,
  upsertTranslationMessage,
} from '@/server/repository';
import { noStoreJson, requirePolicy, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const url = new URL(request.url);
    const locale = url.searchParams.get('locale') ?? undefined;
    const namespace = url.searchParams.get('namespace') ?? undefined;
    const tenantLocale = url.searchParams.get('tenantLocale') ?? undefined;
    const userLocale = url.searchParams.get('userLocale') ?? undefined;

    const snapshot = await getTranslationsSnapshot({
      locale,
      namespace,
      tenantLocale,
      userLocale,
    });
    return noStoreJson(snapshot);
  });
}

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const blocked = await requirePolicy({
      stage: 'save',
      requiredRole: 'Author',
      metadata: { route: 'translations.update' },
    });
    if (blocked) {
      return blocked;
    }

    const body = (await request.json().catch(() => null)) as null | {
      action?: 'upsert' | 'preferences';
      locale?: string;
      namespace?: string;
      key?: string;
      value?: string;
      tenantLocale?: string;
      userLocale?: string;
      fallbackLocale?: string;
    };

    if (!body?.action) {
      return noStoreJson({ ok: false, error: 'action is required' }, 400);
    }

    if (body.action === 'upsert') {
      const result = await upsertTranslationMessage({
        locale: body.locale ?? '',
        namespace: body.namespace,
        key: body.key ?? '',
        value: body.value ?? '',
      });
      return noStoreJson(result, result.ok ? 200 : 400);
    }

    const result = await updateTranslationPreferences({
      tenantLocale: body.tenantLocale,
      userLocale: body.userLocale,
      fallbackLocale: body.fallbackLocale,
    });
    return noStoreJson(result);
  });
}
