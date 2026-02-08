import { Playground } from '@/components/playground/playground';

import { getConsoleSnapshot } from '@/server/demo/repository';

export const dynamic = 'force-dynamic';

export default async function PlaygroundPage() {
  const snapshot = await getConsoleSnapshot();
  const defaultVersion = snapshot.versions.find((v) => v.status === 'ACTIVE') ?? snapshot.versions[0] ?? null;
  return <Playground initialSnapshot={snapshot} initialVersion={defaultVersion} />;
}
