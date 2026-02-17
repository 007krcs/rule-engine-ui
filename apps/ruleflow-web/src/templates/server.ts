import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import type { UISchema } from '@platform/schema';
import { listTemplateSummaries, templateCatalog } from './catalog';
import type { TemplateDetail, TemplateId } from './types';

const TEMPLATE_FILE_BY_ID: Record<TemplateId, string> = {
  'orders-list': 'orders-list.json',
  'profile-settings': 'profile-settings.json',
  'files-explorer': 'files-explorer.json',
  'messaging-screen': 'messaging-screen.json',
};

function templateRootDir(): string {
  const candidates = [
    path.join(process.cwd(), 'src', 'templates'),
    path.join(process.cwd(), 'apps', 'ruleflow-web', 'src', 'templates'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[0] ?? path.join(process.cwd(), 'src', 'templates');
}

function isTemplateId(value: string): value is TemplateId {
  return value in templateCatalog;
}

export function getTemplateSummaries() {
  return listTemplateSummaries();
}

export async function getTemplateById(templateId: string): Promise<TemplateDetail | null> {
  if (!isTemplateId(templateId)) return null;
  const filename = TEMPLATE_FILE_BY_ID[templateId];
  const filePath = path.join(templateRootDir(), filename);
  const raw = await fs.readFile(filePath, 'utf8');
  const schema = JSON.parse(raw) as UISchema;
  return {
    summary: templateCatalog[templateId],
    schema,
  };
}
