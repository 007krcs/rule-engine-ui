import { Playground } from '@/components/playground/playground';

import { getConsoleSnapshot } from '@/server/repository';

export const dynamic = 'force-dynamic';

export default async function PlaygroundPage({ searchParams }: { searchParams: Promise<{ versionId?: string }> }) {
  const { versionId } = await searchParams;
  const snapshot = await getConsoleSnapshot();
  const requested = versionId ? snapshot.versions.find((v: { id: string }) => v.id === versionId) ?? null : null;
  const defaultVersion =
    requested ?? snapshot.versions.find((v: { status: string }) => v.status === 'ACTIVE') ?? snapshot.versions[0] ?? null;
  return <Playground initialSnapshot={snapshot} initialVersion={defaultVersion} />;
}

