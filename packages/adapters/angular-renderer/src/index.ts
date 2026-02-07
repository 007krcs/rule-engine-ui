import type { UISchema } from '@platform/schema';

export interface AngularRenderOptions {
  uiSchema: UISchema;
}

export function renderAngular(_options: AngularRenderOptions): void {
  throw new Error('Angular renderer skeleton not implemented yet.');
}
