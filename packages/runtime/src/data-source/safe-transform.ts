export function applySafeTransform(
  input: unknown,
  options?: {
    template?: string;
    selector?: string;
  },
): unknown {
  if (!options) return input;
  if (options.selector) {
    return selectPath(input, options.selector);
  }
  if (options.template) {
    return renderTemplate(options.template, input);
  }
  return input;
}

function renderTemplate(template: string, context: unknown): string {
  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, rawPath: string) => {
    const value = selectPath(context, rawPath.trim());
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

function selectPath(input: unknown, selector: string): unknown {
  const path = selector.replace(/^\$\.?/, '').trim();
  if (!path) return input;
  const segments = path.split('.').filter(Boolean);
  let cursor: unknown = input;
  for (const segment of segments) {
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}
