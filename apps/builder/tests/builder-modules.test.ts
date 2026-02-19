import { describe, expect, it } from 'vitest';
import { summarizeBuilderWorkspace } from '../src/lib/builder-modules';

describe('summarizeBuilderWorkspace', () => {
  it('summarizes state and component definitions', () => {
    const summary = summarizeBuilderWorkspace(
      {
        states: {
          draft: { uiPageId: 'draft-page' },
          review: { uiPageId: 'review-page' },
          published: { uiPageId: 'published-page' },
        },
      },
      [
        {
          type: 'input.text',
          displayName: 'Text Input',
          category: 'input',
          bindings: [],
          events: [],
          propsSchema: {},
        },
        {
          type: 'display.badge',
          displayName: 'Badge',
          category: 'display',
          bindings: [],
          events: [],
          propsSchema: {},
        },
      ],
    );

    expect(summary.stateCount).toBe(3);
    expect(summary.componentCount).toBe(2);
    expect(summary.componentTypes).toEqual(['display.badge', 'input.text']);
  });
});
