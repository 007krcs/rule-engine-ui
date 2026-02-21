import { describe, expect, it } from 'vitest';
import type { FlowSchema, UISchema } from '../src/types';
import { migrateBundleToMultiPage } from '../src/ui-migration';

describe('ui schema migration', () => {
  it('migrates single-page bundle into uiSchemasById', () => {
    const uiSchema: UISchema = {
      version: '1.0.0',
      pageId: 'start',
      layout: { id: 'root', type: 'stack', children: [] },
      components: [],
    };
    const flowSchema: FlowSchema = {
      version: '1.0.0',
      flowId: 'flow',
      initialState: 'start',
      states: {
        start: { uiPageId: 'start', on: {} },
      },
    };

    const result = migrateBundleToMultiPage({
      uiSchema,
      flowSchema,
      rules: { version: '1.0.0', rules: [] },
      apiMappingsById: {},
    });

    expect(result.changed).toBe(true);
    expect(result.migrated.activeUiPageId).toBe('start');
    expect(Object.keys(result.migrated.uiSchemasById ?? {})).toEqual(['start']);
    expect(result.migrated.uiSchema?.pageId).toBe('start');
  });

  it('rebinds flow states when legacy page ids are missing', () => {
    const result = migrateBundleToMultiPage({
      uiSchemasById: {
        pageA: {
          version: '1.0.0',
          pageId: 'pageA',
          layout: { id: 'root', type: 'stack', children: [] },
          components: [],
        },
      },
      activeUiPageId: 'pageA',
      flowSchema: {
        version: '1.0.0',
        flowId: 'flow',
        initialState: 's1',
        states: {
          s1: { uiPageId: 'missing', on: {} },
        },
      },
    });

    expect(result.migrated.flowSchema?.states.s1?.uiPageId).toBe('pageA');
  });
});
