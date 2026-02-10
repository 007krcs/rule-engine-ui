import { Playground } from '@/components/playground/playground';

import { getConsoleSnapshot } from '@/server/demo/repository';

export const dynamic = 'force-dynamic';

export default async function PlaygroundPage({ searchParams }: { searchParams: Promise<{ versionId?: string }> }) {
  const { versionId } = await searchParams;
  const snapshot = await getConsoleSnapshot();
  const requested = versionId ? snapshot.versions.find((v) => v.id === versionId) ?? null : null;
  const defaultVersion = requested ?? snapshot.versions.find((v) => v.status === 'ACTIVE') ?? snapshot.versions[0] ?? null;
  return <Playground initialSnapshot={snapshot} initialVersion={defaultVersion} />;
}
