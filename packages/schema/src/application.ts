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

export type ApplicationBundleChunkKey =
  | 'uiSchemas'
  | 'flowSchema'
  | 'rules'
  | 'apiMappings'
  | 'themes'
  | 'extensions'
  | 'flowGraph';

export interface ChunkedApplicationBundle {
  metadata: ApplicationBundleMetadata;
  chunks: Partial<Record<ApplicationBundleChunkKey, string>>;
  inline: Partial<Omit<ApplicationBundle, 'metadata'>>;
}

export interface ChunkApplicationBundleOptions {
  keys?: ApplicationBundleChunkKey[];
  minBytes?: number;
  chunkIdPrefix?: string;
}

export interface ChunkApplicationBundleResult {
  manifest: ChunkedApplicationBundle;
  chunks: Record<string, JSONValue>;
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

export function chunkApplicationBundle(
  bundle: ApplicationBundle,
  options?: ChunkApplicationBundleOptions,
): ChunkApplicationBundleResult {
  const chunkKeys = options?.keys ?? ['uiSchemas', 'flowSchema', 'rules', 'apiMappings'];
  const minBytes = options?.minBytes ?? 512;
  const chunkIdPrefix = options?.chunkIdPrefix ?? `bundle-${bundle.metadata.configId}-${bundle.metadata.version}`;

  const chunks: Record<string, JSONValue> = {};
  const inline: Partial<Omit<ApplicationBundle, 'metadata'>> = {};
  const manifest: ChunkedApplicationBundle = {
    metadata: bundle.metadata,
    chunks: {},
    inline,
  };

  for (const key of chunkKeys) {
    const value = bundle[key] as JSONValue | undefined;
    if (value === undefined) continue;
    const encoded = JSON.stringify(value);
    if (encoded.length < minBytes) {
      inline[key] = value as never;
      continue;
    }
    const chunkId = `${chunkIdPrefix}:${key}`;
    manifest.chunks[key] = chunkId;
    chunks[chunkId] = value;
  }

  const fallbackKeys: ApplicationBundleChunkKey[] = ['uiSchemas', 'flowSchema', 'rules', 'apiMappings', 'themes', 'extensions', 'flowGraph'];
  for (const key of fallbackKeys) {
    if (manifest.chunks[key] || inline[key]) continue;
    const value = bundle[key] as JSONValue | undefined;
    if (value !== undefined) {
      inline[key] = value as never;
    }
  }

  return { manifest, chunks };
}

export async function assembleChunkedApplicationBundle(input: {
  manifest: ChunkedApplicationBundle;
  loadChunk: (chunkId: string, key: ApplicationBundleChunkKey) => Promise<JSONValue | undefined>;
}): Promise<ApplicationBundle> {
  const loaded: Partial<Omit<ApplicationBundle, 'metadata'>> = { ...input.manifest.inline };
  for (const [rawKey, chunkId] of Object.entries(input.manifest.chunks)) {
    if (!chunkId) continue;
    const key = rawKey as ApplicationBundleChunkKey;
    const value = await input.loadChunk(chunkId, key);
    if (value !== undefined) {
      loaded[key] = value as never;
    }
  }
  return {
    metadata: input.manifest.metadata,
    uiSchemas: (loaded.uiSchemas as ApplicationBundle['uiSchemas']) ?? {},
    flowSchema: (loaded.flowSchema as ApplicationBundle['flowSchema']) ?? {
      version: '1.0.0',
      flowId: 'default',
      initialState: '',
      states: {},
    },
    flowGraph: loaded.flowGraph as ApplicationBundle['flowGraph'],
    rules: (loaded.rules as ApplicationBundle['rules']) ?? createEmptyRuleset(),
    apiMappings: (loaded.apiMappings as ApplicationBundle['apiMappings']) ?? [],
    themes: loaded.themes as ApplicationBundle['themes'],
    extensions: loaded.extensions as ApplicationBundle['extensions'],
  };
}

export function createChunkLoader(chunks: Record<string, JSONValue>) {
  return async (chunkId: string): Promise<JSONValue | undefined> => chunks[chunkId];
}
