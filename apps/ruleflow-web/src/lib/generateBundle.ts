import {
  assembleApplicationBundle,
  type ApplicationBundle,
  type ApplicationBundleStatus,
} from '@platform/schema';
import type { BuilderState } from '@/context/BuilderContext';

const defaultStatus: ApplicationBundleStatus = 'DRAFT';

export function generateBundleFromState(state: BuilderState): ApplicationBundle {
  const versionNumber = Number.isFinite(Number(state.version)) ? Number(state.version) : 1;
  const now = new Date().toISOString();

  return assembleApplicationBundle({
    metadata: {
      configId: state.appId,
      version: versionNumber,
      status: defaultStatus,
      tenantId: 'tenant-default',
      createdAt: now,
      updatedAt: now,
    },
    uiSchemas: state.screens,
    flowSchema: state.flow,
    rules: state.rules,
    apiMappings: state.apiMappings,
    extensions: {
      plugins: state.plugins,
      tokens: state.tokens,
    },
  });
}
