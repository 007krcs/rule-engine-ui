import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const AdapterWidget = () => React.createElement('div', null, 'Adapter Widget');

afterEach(() => {
  delete (globalThis as { __RULEFLOW_BUILDER_ADAPTER_COMPONENTS__?: unknown }).__RULEFLOW_BUILDER_ADAPTER_COMPONENTS__;
  delete (globalThis as { __RULEFLOW_BUILDER_ADAPTERS__?: unknown }).__RULEFLOW_BUILDER_ADAPTERS__;
  vi.resetModules();
});

describe('plugin host adapter registration', () => {
  it('registers adapter components from globals and merges with platform catalog', async () => {
    (globalThis as { __RULEFLOW_BUILDER_ADAPTER_COMPONENTS__?: unknown }).__RULEFLOW_BUILDER_ADAPTER_COMPONENTS__ = [
      {
        type: 'adapter.widget',
        renderer: AdapterWidget,
        contract: {
          type: 'adapter.widget',
          displayName: 'Adapter Widget',
          category: 'Adapter',
          props: {},
        },
        capabilities: ['theming'],
      },
    ];

    const host = await import('../src/lib/plugin-host');
    const catalog = host.getBuilderComponentCatalog();

    expect(catalog.some((entry) => entry.type === 'adapter.widget')).toBe(true);
    expect(catalog.length).toBeGreaterThan(1);
  });

  it('deduplicates adapter component registration by type', async () => {
    const host = await import('../src/lib/plugin-host');
    const component = {
      type: 'adapter.unique',
      renderer: AdapterWidget,
      contract: {
        type: 'adapter.unique',
        displayName: 'Adapter Unique',
        category: 'Adapter',
        props: {},
      },
      capabilities: ['events'],
    };

    host.registerBuilderAdapterComponent(component);
    host.registerBuilderAdapterComponent(component);

    const catalog = host.getBuilderComponentCatalog().filter((entry) => entry.type === 'adapter.unique');
    expect(catalog).toHaveLength(1);
  });
});
