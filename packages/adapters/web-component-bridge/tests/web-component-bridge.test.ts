import { describe, expect, it } from 'vitest';
import { defineRuleflowRendererElement } from '../src/index';

describe('web-component-bridge', () => {
  it('registers the custom element', () => {
    if (typeof HTMLElement === 'undefined') {
      (globalThis as typeof globalThis & { HTMLElement?: typeof HTMLElement }).HTMLElement = class {};
    }
    if (typeof customElements === 'undefined') {
      const registry = new Map<string, CustomElementConstructor>();
      (globalThis as typeof globalThis & { customElements?: CustomElementRegistry }).customElements = {
        define(name, ctor) {
          registry.set(name, ctor);
        },
        get(name) {
          return registry.get(name);
        },
      } as CustomElementRegistry;
    }
    defineRuleflowRendererElement({ tagName: 'ruleflow-test' });
    expect(customElements.get('ruleflow-test')).toBeTruthy();
  });
});
