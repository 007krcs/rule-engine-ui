import { describe, expect, it } from 'vitest';
import type { ApiMapping, ExecutionContext } from '@platform/schema';
import { callApi } from '../src/index';

const context: ExecutionContext = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  role: 'admin',
  roles: ['admin'],
  country: 'US',
  locale: 'en-US',
  timezone: 'America/New_York',
  device: 'desktop',
  permissions: [],
  featureFlags: {},
};

describe('api-orchestrator', () => {
  it('maps request data, applies transform, and maps response', async () => {
    const mapping: ApiMapping = {
      version: '1.0.0',
      apiId: 'orders',
      type: 'rest',
      method: 'POST',
      endpoint: 'https://api.example.com/orders',
      requestMap: {
        body: {
          customer: { from: 'data.customer' },
          note: { from: 'literal:priority', transform: 'upper($)' },
        },
        query: {
          locale: { from: 'context.locale' },
        },
        headers: {
          'x-tenant': { from: 'context.tenantId' },
        },
      },
      responseMap: {
        data: {
          orderId: 'response.orderId',
        },
        context: {
          traceId: 'response.traceId',
        },
      },
    };

    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    const fetchFn = async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedInit = init;
      return new Response(JSON.stringify({ orderId: 'o-100', traceId: 't-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    const result = await callApi({
      mapping,
      context,
      data: { customer: 'Acme' },
      fetchFn,
    });

    expect(capturedUrl).toContain('locale=en-US');
    expect(JSON.parse(String(capturedInit?.body))).toEqual({ customer: 'Acme', note: 'PRIORITY' });
    expect(result.data.orderId).toBe('o-100');
    expect(result.context.traceId).toBe('t-1');
  });

  it('captures transform errors as trace error', async () => {
    const mapping: ApiMapping = {
      version: '1.0.0',
      apiId: 'bad-transform',
      type: 'rest',
      method: 'GET',
      endpoint: 'https://api.example.com/bad',
      requestMap: {
        query: {
          q: { from: 'data.query', transform: 'upper' },
        },
      },
      responseMap: {
        data: {},
      },
    };

    const result = await callApi({
      mapping,
      context,
      data: { query: 'test' },
      fetchFn: async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    });

    expect(result.trace.error).toContain('Invalid transform expression');
  });
});
