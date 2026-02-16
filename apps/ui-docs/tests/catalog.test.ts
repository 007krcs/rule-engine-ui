import { describe, expect, it } from 'vitest';
import {
  categoryOrder,
  componentCatalog,
  getComponentDoc,
  getComponentsForCategory,
} from '../src/lib/catalog';

describe('ui-docs catalog', () => {
  it('exposes all required categories', () => {
    expect(categoryOrder).toEqual([
      'inputs',
      'data-display',
      'feedback',
      'surfaces',
      'navigation',
      'layout',
      'utils',
    ]);
  });

  it('includes enterprise component coverage entries', () => {
    const required = [
      'button',
      'dialog',
      'tabs',
      'table',
      'tooltip',
      'app-shell',
      'theme-provider',
    ];
    for (const slug of required) {
      expect(getComponentDoc(slug)?.slug).toBe(slug);
    }
  });

  it('groups components by category', () => {
    const inputs = getComponentsForCategory('inputs');
    const navigation = getComponentsForCategory('navigation');

    expect(inputs.length).toBeGreaterThan(10);
    expect(navigation.some((component) => component.slug === 'tabs')).toBe(true);
    expect(componentCatalog.length).toBeGreaterThan(30);
  });
});
