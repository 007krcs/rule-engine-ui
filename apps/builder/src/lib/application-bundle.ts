import {
  assembleApplicationBundle,
  createEmptyRuleset,
  flowGraphToStateMachine,
  type ApiMapping,
  type ApplicationBundle,
  type ApplicationBundleStatus,
  type ApplicationBundleTheme,
  type FlowGraphSchema,
  type RuleSet,
  type UISchema,
} from '@platform/schema';

export interface AssembleBuilderBundleInput {
  flowGraph: FlowGraphSchema;
  uiSchemasByScreenId: Record<string, UISchema>;
  configId: string;
  tenantId: string;
  version?: number;
  status?: ApplicationBundleStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  rules?: RuleSet;
  apiMappings?: ApiMapping[];
  themes?: ApplicationBundleTheme;
}

export function assembleBundle(input: AssembleBuilderBundleInput): ApplicationBundle {
  const uiSchemas: Record<string, UISchema> = {};

  for (const screen of input.flowGraph.screens) {
    const existing = input.uiSchemasByScreenId[screen.id];
    if (existing) {
      uiSchemas[screen.id] = {
        ...existing,
        pageId: screen.uiPageId,
      };
    }
  }

  return assembleApplicationBundle({
    metadata: {
      configId: input.configId,
      version: input.version ?? 1,
      status: input.status ?? 'DRAFT',
      tenantId: input.tenantId,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      createdBy: input.createdBy,
      updatedBy: input.updatedBy,
    },
    uiSchemas,
    flowSchema: flowGraphToStateMachine(input.flowGraph),
    flowGraph: input.flowGraph,
    rules: input.rules ?? createEmptyRuleset(),
    apiMappings: input.apiMappings ?? [],
    themes: input.themes,
  });
}
