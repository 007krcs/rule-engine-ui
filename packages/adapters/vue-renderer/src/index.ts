import type { UISchema } from '@platform/schema';

export interface VueRenderOptions {
  uiSchema: UISchema;
}

export function renderVue(_options: VueRenderOptions): void {
  throw new Error('Vue renderer skeleton not implemented yet.');
}
