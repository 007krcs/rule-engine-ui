import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { builtinComponentDefinitions } from '@platform/component-registry';
import type { ComponentDefinition } from '@platform/component-registry';
import type { AdapterContext } from '@platform/react-renderer';
import type { ExecutionContext, JSONValue, UIComponent } from '@platform/schema';
import { eventBus } from '@platform/runtime';
import { getImplementedComponentIds, getPlatformComponent, renderPlatformComponent } from '../src/index';

const context: ExecutionContext = {
  tenantId: 'tenant-1',
  userId: 'builder',
  role: 'author',
  roles: ['author'],
  country: 'US',
  locale: 'en-US',
  timezone: 'UTC',
  device: 'desktop',
  permissions: [],
  featureFlags: {},
};

function createAdapterContext(data: Record<string, JSONValue>): AdapterContext {
  return {
    data,
    context,
    i18n: {
      locale: 'en-US',
      direction: 'ltr',
      t: (key: string) => key,
      has: () => true,
      formatNumber: (value: number) => String(value),
      formatDate: (value: Date) => value.toISOString(),
    },
    bindings: { data: {}, context: {}, computed: {} },
    events: {
      onChange: () => undefined,
      onClick: () => undefined,
      onSubmit: () => undefined,
    },
  };
}

function createComponent(overrides: Partial<UIComponent>): UIComponent {
  return {
    id: 'component-1',
    type: 'input',
    adapterHint: 'platform.dateField',
    props: {},
    bindings: { data: { valuePath: 'data.startDate' } },
    accessibility: {
      ariaLabelKey: 'runtime.filters.customerName.aria',
      keyboardNav: true,
      focusOrder: 1,
    },
    ...overrides,
  };
}

function registryImplementedPlatformIds(definitions: ComponentDefinition[]): string[] {
  return definitions
    .filter((definition) => definition.adapterHint.startsWith('platform.'))
    .filter((definition) => definition.availability === 'implemented' && definition.supportsDrag)
    .map((definition) => definition.adapterHint);
}

describe('react-platform-adapter', () => {
  it('matches implemented registry entries with adapter map', () => {
    const implementedFromRegistry = registryImplementedPlatformIds(builtinComponentDefinitions())
      .sort((a, b) => a.localeCompare(b));
    const implementedFromAdapter = getImplementedComponentIds().sort((a, b) => a.localeCompare(b));

    expect(implementedFromAdapter).toEqual(implementedFromRegistry);
  });

  it('renders platform date components', () => {
    const dateField = renderPlatformComponent(
      createComponent({
        id: 'date-field',
        adapterHint: 'platform.dateField',
        validations: { minDate: '2026-01-01', maxDate: '2026-12-31' },
      }),
      createAdapterContext({ startDate: '2026-03-20' }),
    );

    const calendar = renderPlatformComponent(
      createComponent({
        id: 'calendar',
        type: 'calendar',
        adapterHint: 'platform.calendar',
        validations: { minDate: '2026-01-01', maxDate: '2026-12-31' },
      }),
      createAdapterContext({ startDate: '2026-03-20' }),
    );

    const datePicker = renderPlatformComponent(
      createComponent({
        id: 'date-picker',
        type: 'datePicker',
        adapterHint: 'platform.datePicker',
        validations: { minDate: '2026-01-01', maxDate: '2026-12-31' },
      }),
      createAdapterContext({ startDate: '2026-03-20' }),
    );

    const timePicker = renderPlatformComponent(
      createComponent({
        id: 'time-picker',
        type: 'timePicker',
        adapterHint: 'platform.timePicker',
        props: { showClock: true, step: 300 },
      }),
      createAdapterContext({ startDate: '09:15' }),
    );

    const html = renderToStaticMarkup(
      <div>
        {dateField}
        {calendar}
        {datePicker}
        {timePicker}
      </div>,
    );

    expect(html).toContain('type="date"');
    expect(html).toContain('pf-calendar');
    expect(html).toContain('pf-date-picker');
    expect(html).toContain('pf-time-picker');
  });

  it('renders chip/avatar/badge/divider components without unsupported fallback', () => {
    const chip = renderPlatformComponent(
      createComponent({
        id: 'chip-1',
        type: 'chip',
        adapterHint: 'platform.chip',
        props: { label: 'Review', intent: 'info' },
      }),
      createAdapterContext({}),
    );

    const avatar = renderPlatformComponent(
      createComponent({
        id: 'avatar-1',
        type: 'avatar',
        adapterHint: 'platform.avatar',
        props: { name: 'Dana Chen' },
      }),
      createAdapterContext({}),
    );

    const badge = renderPlatformComponent(
      createComponent({
        id: 'badge-1',
        type: 'badge',
        adapterHint: 'platform.badge',
        props: { badgeContent: 4, max: 9 },
      }),
      createAdapterContext({}),
    );

    const divider = renderPlatformComponent(
      createComponent({
        id: 'divider-1',
        type: 'divider',
        adapterHint: 'platform.divider',
        props: { orientation: 'horizontal' },
      }),
      createAdapterContext({}),
    );

    const html = renderToStaticMarkup(
      <div>
        {chip}
        {avatar}
        {badge}
        {divider}
      </div>,
    );

    expect(html).toContain('pf-chip');
    expect(html).toContain('pf-avatar');
    expect(html).toContain('pf-badge');
    expect(html).toContain('pf-divider');
    expect(html).not.toContain('Unsupported platform component');
  });

  it('returns placeholder component factory for unknown ids', () => {
    const Unknown = getPlatformComponent('platform.unknownWidget');
    const html = renderToStaticMarkup(<Unknown />);
    expect(html).toContain('Component not enabled');
  });

  it('publishes filterChanged for platform.textField changes', () => {
    const onChange = vi.fn();
    const received = vi.fn();
    eventBus.subscribe('filterChanged', received);

    const node = renderPlatformComponent(
      createComponent({
        id: 'customerFilter',
        type: 'input',
        adapterHint: 'platform.textField',
        bindings: { data: { valuePath: 'data.orders.filters.search' } },
      }),
      {
        ...createAdapterContext({ orders: { filters: { search: '' } } }),
        events: { onChange, onClick: () => undefined, onSubmit: () => undefined },
      },
    );

    node.props.onChange({ target: { value: 'ACME' } });

    expect(onChange).toHaveBeenCalledWith('ACME', 'data.orders.filters.search');
    expect(received).toHaveBeenCalledWith({
      componentId: 'customerFilter',
      field: 'search',
      value: 'ACME',
    });
    eventBus.unsubscribe('filterChanged', received);
  });
});
