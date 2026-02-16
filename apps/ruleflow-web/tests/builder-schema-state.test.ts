import { describe, expect, it } from 'vitest';
import type { UIComponent } from '@platform/schema';
import { createSchemaFromComponents, getSchemaComponents, moveComponentInSchema, removeComponentFromSchema } from '../src/components/builder/schema-state';

const SAMPLE_COMPONENTS: UIComponent[] = [
  {
    id: 'customerName',
    type: 'input',
    adapterHint: 'material.input',
    props: { label: 'Customer name' },
  },
  {
    id: 'orderTotal',
    type: 'input',
    adapterHint: 'material.input',
    props: { label: 'Order total' },
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
    const components = getSchemaComponents(moved);
    expect(components[0]?.id).toBe('orderTotal');
    expect(components[1]?.id).toBe('customerName');
  });
});
