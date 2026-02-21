# Enterprise Configuration Runtime (ECR)

Enterprise Configuration Runtime (ECR) is a schema-driven UI, flow, and rules execution platform for React hosts.

## Installation

```bash
npm install @ecr-platform/core
```

## Peer Dependencies

ECR expects these peer dependencies in your host app:

- `react`
- `react-dom`

## Usage (React)

```tsx
import React from 'react';
import { ECRProvider, useECR } from '@ecr-platform/core';

function RuntimeScreen() {
  const config = useECR();
  return <pre>{JSON.stringify(config, null, 2)}</pre>;
}

export default function App() {
  return (
    <ECRProvider config={{ tenantId: 'tenant-1', locale: 'en-US', environment: 'prod' }}>
      <RuntimeScreen />
    </ECRProvider>
  );
}
```

## Build Scripts

- `npm run build` -> bundles CommonJS + ESModule + types into `dist/`
- `npm test` -> runs Vitest
- `npm run prepublishOnly` -> build + test gate before publish

## Publishing

```bash
npm login
npm publish --access public
```
