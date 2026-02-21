import {
  assembleChunkedApplicationBundle,
  assembleApplicationBundle,
  chunkApplicationBundle,
  createChunkLoader,
  type JSONValue,
  type ChunkApplicationBundleResult,
  type ChunkedApplicationBundle,
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

export function generateChunkedBundleFromState(
  state: BuilderState,
  options?: {
    minBytes?: number;
    chunkIdPrefix?: string;
  },
): ChunkApplicationBundleResult {
  const full = generateBundleFromState(state);
  return chunkApplicationBundle(full, {
    minBytes: options?.minBytes ?? 2_048,
    chunkIdPrefix: options?.chunkIdPrefix ?? `app-${state.appId}-${state.version}`,
    keys: ['uiSchemas', 'flowSchema', 'rules'],
  });
}

export async function loadBundleFromChunks(input: {
  manifest: ChunkedApplicationBundle;
  chunkStore: Record<string, JSONValue>;
  onChunkLoad?: (chunk: { key: string; chunkId: string; durationMs: number }) => void;
}): Promise<ApplicationBundle> {
  const loader = createChunkLoader(input.chunkStore);
  return await assembleChunkedApplicationBundle({
    manifest: input.manifest,
    loadChunk: async (chunkId, key) => {
      const started = Date.now();
      const chunk = await loader(chunkId);
      input.onChunkLoad?.({
        key,
        chunkId,
        durationMs: Date.now() - started,
      });
      return chunk;
    },
  });
}
