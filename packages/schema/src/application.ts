import type {
  ApiMapping,
  FlowSchema,
  JSONValue,
  RuleSet,
  UISchema,
} from './types';
import type { FlowGraphSchema } from './flow';

export type ApplicationBundleStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'PUBLISHED'
  | 'ARCHIVED';

export interface ApplicationBundleMetadata {
  configId: string;
  version: number;
  status: ApplicationBundleStatus;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  tags?: string[];
}

export interface ApplicationBundleTheme {
  id?: string;
  name?: string;
  tokens: Record<string, JSONValue>;
}

export interface ApplicationBundle {
  metadata: ApplicationBundleMetadata;
  uiSchemas: Record<string, UISchema>;
  flowSchema: FlowSchema;
  flowGraph?: FlowGraphSchema;
  rules: RuleSet;
  apiMappings: ApiMapping[];
  themes?: ApplicationBundleTheme;
  extensions?: Record<string, JSONValue>;
}

export interface AssembleApplicationBundleInput {
  metadata: ApplicationBundleMetadata;
  uiSchemas: Record<string, UISchema>;
  flowSchema: FlowSchema;
  flowGraph?: FlowGraphSchema;
  rules?: RuleSet;
  apiMappings?: ApiMapping[];
  themes?: ApplicationBundleTheme;
  extensions?: Record<string, JSONValue>;
}

export function assembleApplicationBundle(input: AssembleApplicationBundleInput): ApplicationBundle {
  return {
    metadata: input.metadata,
    uiSchemas: input.uiSchemas,
    flowSchema: input.flowSchema,
    flowGraph: input.flowGraph,
    rules: input.rules ?? createEmptyRuleset(),
    apiMappings: input.apiMappings ?? [],
    themes: input.themes,
    extensions: input.extensions,
  };
}

export function serializeApplicationBundle(bundle: ApplicationBundle, spacing = 2): string {
  return JSON.stringify(bundle, null, spacing);
}

export function createEmptyRuleset(version = '1.0.0'): RuleSet {
  return {
    version,
    rules: [],
  };
}
