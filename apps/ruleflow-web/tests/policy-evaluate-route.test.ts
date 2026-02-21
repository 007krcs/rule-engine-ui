import { describe, expect, it } from 'vitest';

describe('policy evaluate route', () => {
  it('returns policy evaluation result for CI/CD hooks', async () => {
    const route = await import('../src/app/api/policies/evaluate/route');
    const response = await route.POST(
      new Request('http://localhost/api/policies/evaluate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stage: 'save' }),
      }),
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; mode: string; errors: unknown[] };
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.errors)).toBe(true);
  });
});
