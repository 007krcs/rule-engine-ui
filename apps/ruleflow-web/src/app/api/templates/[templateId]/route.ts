import { noStoreJson } from '@/app/api/_shared';
import { getTemplateById } from '@/templates/server';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ templateId: string }> }) {
  try {
    const { templateId } = await params;
    const template = await getTemplateById(templateId);
    if (!template) {
      return noStoreJson({ ok: false, error: 'template_not_found' }, 404);
    }
    return noStoreJson({ ok: true, template });
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
