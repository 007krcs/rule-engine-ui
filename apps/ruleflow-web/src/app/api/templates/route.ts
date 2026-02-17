import { noStoreJson } from '@/app/api/_shared';
import { getTemplateSummaries } from '@/templates/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return noStoreJson({ ok: true, templates: getTemplateSummaries() });
  } catch (error) {
    return noStoreJson(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}
