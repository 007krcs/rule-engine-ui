import crypto from 'node:crypto';
import type { TenantContext } from './types';

export function nowIso(): string {
  return new Date().toISOString();
}

export function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createVersionId(): string {
  return `ver-${crypto.randomUUID()}`;
}

export function assertTenantAccess(context: TenantContext, tenantId: string): void {
  if (context.tenantId !== tenantId) {
    throw new Error(`Tenant context mismatch. expected=${tenantId} actual=${context.tenantId}`);
  }
}
