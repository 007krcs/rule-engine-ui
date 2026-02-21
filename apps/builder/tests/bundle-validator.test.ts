import { describe, expect, it } from 'vitest';
import { assembleBundle } from '../src/lib/application-bundle';
import { createInitialBuilderFlowState } from '../src/lib/flow-engine';
import { validateApplicationBundle } from '../src/lib/bundle-validator';

describe('bundle validator', () => {
  it('enforces accessibility and i18n checks by default', () => {
    const state = createInitialBuilderFlowState();
    const screenId = state.activeScreenId;
    const schema = state.schemasByScreenId[screenId];
    const firstColumn = schema.sections?.[0]?.rows[0]?.columns[0];
    expect(firstColumn).toBeDefined();

    schema.components.push({
      id: 'name-input',
      type: 'input.text',
      adapterHint: 'react',
      props: { label: 'Name' },
      i18n: {},
      accessibility: { ariaLabelKey: '' },
    });

    firstColumn?.children.push({
      id: 'name-input-node',
      kind: 'component',
      componentId: 'name-input',
      componentType: 'input.text',
    });

    const bundle = assembleBundle({
      flowGraph: state.flow,
      uiSchemasByScreenId: state.schemasByScreenId,
      configId: 'cfg-test',
      tenantId: 'tenant-test',
      version: 1,
      status: 'DRAFT',
      createdAt: '2026-02-21T00:00:00.000Z',
      updatedAt: '2026-02-21T00:00:00.000Z',
    });

    const result = validateApplicationBundle(bundle, [
      {
        type: 'input.text',
        displayName: 'Text Input',
        category: 'Input',
        props: {},
      },
    ]);

    expect(result.valid).toBe(false);
    expect(
      result.issues.some(
        (issue) =>
          issue.path.endsWith('accessibility.ariaLabelKey') &&
          issue.severity === 'error' &&
          issue.category === 'accessibility',
      ),
    ).toBe(true);
    expect(
      result.issues.some(
        (issue) =>
          issue.path.endsWith('i18n.labelKey') && issue.severity === 'error' && issue.category === 'i18n',
      ),
    ).toBe(true);
  });

  it('downgrades accessibility and i18n errors in dev skip mode', () => {
    const state = createInitialBuilderFlowState();
    const screenId = state.activeScreenId;
    const schema = state.schemasByScreenId[screenId];
    const firstColumn = schema.sections?.[0]?.rows[0]?.columns[0];

    schema.components.push({
      id: 'submit-btn',
      type: 'action.button',
      adapterHint: 'react',
      props: { label: 'Submit' },
      i18n: {},
      accessibility: { ariaLabelKey: '' },
    });

    firstColumn?.children.push({
      id: 'submit-btn-node',
      kind: 'component',
      componentId: 'submit-btn',
      componentType: 'action.button',
    });

    const bundle = assembleBundle({
      flowGraph: state.flow,
      uiSchemasByScreenId: state.schemasByScreenId,
      configId: 'cfg-test',
      tenantId: 'tenant-test',
      version: 1,
      status: 'DRAFT',
      createdAt: '2026-02-21T00:00:00.000Z',
      updatedAt: '2026-02-21T00:00:00.000Z',
    });

    const result = validateApplicationBundle(
      bundle,
      [
        {
          type: 'action.button',
          displayName: 'Button',
          category: 'Action',
          props: {},
        },
      ],
      {
        developmentMode: true,
        skipA11yI18nInDev: true,
      },
    );

    expect(result.valid).toBe(true);
    expect(result.issues.some((issue) => issue.severity === 'error')).toBe(false);
    expect(result.issues.some((issue) => issue.category === 'accessibility' && issue.severity === 'warning')).toBe(
      true,
    );
    expect(result.issues.some((issue) => issue.category === 'i18n' && issue.severity === 'warning')).toBe(true);
  });
});
