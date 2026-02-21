import { describe, expect, it, vi } from 'vitest';
import { GovernanceSdk } from '../src/index';

describe('governance sdk', () => {
  it('calls policy evaluation route', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, mode: 'shadow', errors: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const sdk = new GovernanceSdk({ baseUrl: 'http://localhost:3000', fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await sdk.evaluatePolicy({ stage: 'save' });
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
