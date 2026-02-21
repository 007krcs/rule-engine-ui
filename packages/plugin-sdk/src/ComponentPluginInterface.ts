import type { ComponentType } from 'react';
import type { ComponentContract } from '@platform/component-contract';
import type { JSONValue } from '@platform/schema';

export type ComponentCapability =
  | 'data-binding'
  | 'events'
  | 'theming'
  | 'realtime'
  | 'analytics';

export interface ComponentPluginInterface {
  type: string;
  renderer: ComponentType<any>;
  contract: Record<string, JSONValue>;
  capabilities: ComponentCapability | ComponentCapability[];
  displayName?: string;
  category?: string;
  description?: string;
  adapterHint?: string;
}

export interface ComponentRegistration<TImplementation = unknown> {
  contract: ComponentContract;
  implementation?: TImplementation;
  capabilities?: ComponentCapability[];
}
