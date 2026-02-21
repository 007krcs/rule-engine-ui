import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export type ImmutableAuditCategory = 'rules' | 'api' | 'flow' | 'policy' | 'auth' | 'runtime';

export interface ImmutableAuditEventInput {
  tenantId: string;
  actor: string;
  category: ImmutableAuditCategory;
  action: string;
  target: string;
  metadata?: Record<string, unknown>;
}

export interface ImmutableAuditEvent extends ImmutableAuditEventInput {
  id: string;
  at: string;
  prevHash: string;
  hash: string;
}

const EMPTY_HASH = '0'.repeat(64);
const CACHE_LIMIT = 2_000;
const eventCache: ImmutableAuditEvent[] = [];
let lastHash = EMPTY_HASH;

function storeDir(): string {
  return process.env.RULEFLOW_DEMO_STORE_DIR ?? path.join(process.cwd(), '.ruleflow-demo-data');
}

function storeFile(): string {
  return path.join(storeDir(), 'immutable-audit.log');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  const rec = value as Record<string, unknown>;
  const keys = Object.keys(rec).sort((a, b) => a.localeCompare(b));
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(rec[key])}`).join(',')}}`;
}

function nextHash(event: Omit<ImmutableAuditEvent, 'hash'>): string {
  return crypto.createHash('sha256').update(`${event.prevHash}:${stableStringify(event)}`, 'utf8').digest('hex');
}

function appendToCache(event: ImmutableAuditEvent): void {
  eventCache.push(event);
  if (eventCache.length > CACHE_LIMIT) {
    eventCache.splice(0, eventCache.length - CACHE_LIMIT);
  }
}

async function appendToDisk(event: ImmutableAuditEvent): Promise<void> {
  await fs.mkdir(storeDir(), { recursive: true });
  await fs.appendFile(storeFile(), `${JSON.stringify(event)}\n`, 'utf8');
}

export async function appendImmutableAuditEvent(input: ImmutableAuditEventInput): Promise<ImmutableAuditEvent> {
  const base: Omit<ImmutableAuditEvent, 'hash'> = {
    id: `ima-${crypto.randomUUID()}`,
    at: new Date().toISOString(),
    prevHash: lastHash,
    tenantId: input.tenantId,
    actor: input.actor,
    category: input.category,
    action: input.action,
    target: input.target,
    metadata: input.metadata,
  };
  const event: ImmutableAuditEvent = {
    ...base,
    hash: nextHash(base),
  };
  lastHash = event.hash;
  appendToCache(event);
  try {
    await appendToDisk(event);
  } catch {
    // Keep runtime path non-blocking even if disk is unavailable.
  }
  return event;
}

export async function listImmutableAuditEvents(limit = 200): Promise<ImmutableAuditEvent[]> {
  const safeLimit = Math.max(1, Math.min(limit, 5_000));
  if (eventCache.length > 0) {
    return eventCache.slice(-safeLimit).reverse();
  }
  try {
    const raw = await fs.readFile(storeFile(), 'utf8');
    const parsed = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ImmutableAuditEvent);
    for (const event of parsed) {
      appendToCache(event);
      lastHash = event.hash;
    }
    return eventCache.slice(-safeLimit).reverse();
  } catch {
    return [];
  }
}

export function verifyImmutableAuditChain(events: ImmutableAuditEvent[]): boolean {
  let prev = EMPTY_HASH;
  for (const event of [...events].reverse()) {
    if (event.prevHash !== prev) return false;
    const expected = nextHash({
      id: event.id,
      at: event.at,
      prevHash: event.prevHash,
      tenantId: event.tenantId,
      actor: event.actor,
      category: event.category,
      action: event.action,
      target: event.target,
      metadata: event.metadata,
    });
    if (expected !== event.hash) return false;
    prev = event.hash;
  }
  return true;
}

export async function resetImmutableAuditForTests(): Promise<void> {
  eventCache.splice(0, eventCache.length);
  lastHash = EMPTY_HASH;
  try {
    await fs.unlink(storeFile());
  } catch {
    // ignore
  }
}
