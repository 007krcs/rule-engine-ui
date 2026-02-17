import { describe, expect, it } from 'vitest';
import type { UIComponent, UISchema } from '@platform/schema';
import {
  createSchemaFromComponents,
  getSchemaComponents,
  getSchemaItemsForBreakpoint,
  migrateSchemaToGridLayout,
  moveComponentInSchema,
  removeComponentFromSchema,
} from '../src/components/builder/schema-state';

const SAMPLE_COMPONENTS: UIComponent[] = [
  {
    id: 'customerName',
    type: 'input',
    adapterHint: 'material.input',
    props: {},
    i18n: {
      labelKey: 'runtime.filters.customerName.label',
    },
    accessibility: {
      ariaLabelKey: 'runtime.filters.customerName.aria',
      keyboardNav: true,
      focusOrder: 1,
    },
  },
  {
    id: 'orderTotal',
    type: 'input',
    adapterHint: 'material.input',
    props: {},
    i18n: {
      labelKey: 'runtime.filters.orderTotal.label',
    },
    accessibility: {
      ariaLabelKey: 'runtime.filters.orderTotal.aria',
      keyboardNav: true,
      focusOrder: 2,
    },
  },
];

describe('builder schema state', () => {
  it('decreases schema component length when onRemove callback is invoked', () => {
    let schema = createSchemaFromComponents(SAMPLE_COMPONENTS);
    const onRemove = (id: string) => {
      schema = removeComponentFromSchema(schema, id);
    };

    onRemove('customerName');

    const remaining = getSchemaComponents(schema);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe('orderTotal');
  });

  it('moves components to a new index', () => {
    const schema = createSchemaFromComponents(SAMPLE_COMPONENTS);
    const moved = moveComponentInSchema(schema, 'orderTotal', 0);
    const items = getSchemaItemsForBreakpoint(moved, 'lg');
    expect(items[0]?.componentId).toBe('orderTotal');
    expect(items[1]?.componentId).toBe('customerName');
  });

  it('migrates legacy layout schemas to grid layout with coordinates', () => {
    const legacySchema: UISchema = {
      version: '1.0.0',
      pageId: 'legacy',
      layout: {
        id: 'root',
        type: 'grid',
        columns: 12,
        componentIds: ['customerName', 'orderTotal'],
      },
      components: SAMPLE_COMPONENTS,
    };

    const migrated = migrateSchemaToGridLayout(legacySchema);
    const items = getSchemaItemsForBreakpoint(migrated, 'lg');

    expect(migrated.layoutType).toBe('grid');
    expect(migrated.grid?.columns).toBe(12);
    expect(items).toHaveLength(2);
    expect(items[0]?.componentId).toBe('customerName');
    expect(items[0]?.x).toBe(0);
    expect(items[1]?.componentId).toBe('orderTotal');
    expect(items[1]?.y).toBeGreaterThanOrEqual(items[0]?.y ?? 0);
  });
});
