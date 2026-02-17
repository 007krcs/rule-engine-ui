import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AdapterContext } from '@platform/react-renderer';
import type { ExecutionContext, JSONValue, UIComponent } from '@platform/schema';
import { renderPlatformComponent } from '../src/index';

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

describe('react-platform-adapter', () => {
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

    const html = renderToStaticMarkup(
      <div>
        {dateField}
        {calendar}
      </div>,
    );

    expect(html).toContain('type="date"');
    expect(html).toContain('pf-calendar');
  });
});
