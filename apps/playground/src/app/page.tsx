import { buildExecutionQueue } from '@platform/core-runtime/orchestrator';
import { getDefaultComponentCatalog } from '@platform/component-system';
import { buildPlaygroundSnapshot } from '../lib/playground-runtime';

export default function Page() {
  const queue = buildExecutionQueue(['validate', 'evaluateRules', 'callApi']);
  const snapshot = buildPlaygroundSnapshot(queue, getDefaultComponentCatalog().length);

  return (
    <main>
      <h1>Runtime Playground</h1>
      <p>Live configuration runner with execution queue preview.</p>
      <pre>{JSON.stringify(snapshot, null, 2)}</pre>
    </main>
  );
}
