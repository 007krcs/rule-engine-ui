import { renderPrometheusMetrics } from '@/server/metrics';

export const runtime = 'nodejs';

export async function GET() {
  return new Response(renderPrometheusMetrics(), {
    status: 200,
    headers: {
      'content-type': 'text/plain; version=0.0.4; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
