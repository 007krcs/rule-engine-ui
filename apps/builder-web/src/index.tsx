import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { UIComponent, UISchema } from '@platform/schema';

export type BuilderState = {
  pageId: string;
  version: string;
  components: UIComponent[];
};

const defaultComponent: UIComponent = {
  id: 'customerName',
  type: 'input',
  adapterHint: 'material.input',
  props: { label: 'Customer name' },
  i18n: {
    labelKey: 'runtime.filters.customerName.label',
    placeholderKey: 'runtime.filters.customerName.placeholder',
    helperTextKey: 'runtime.filters.customerName.helper',
  },
  accessibility: {
    ariaLabelKey: 'runtime.filters.customerName.aria',
    keyboardNav: true,
    focusOrder: 1,
  },
};

export function createBuilderState(seed?: Partial<BuilderState>): BuilderState {
  return {
    pageId: seed?.pageId ?? 'builder-preview',
    version: seed?.version ?? '1.0.0',
    components: seed?.components ?? [defaultComponent],
  };
}

export function addComponent(state: BuilderState, component: UIComponent): BuilderState {
  if (state.components.some((item) => item.id === component.id)) {
    throw new Error(`Component id already exists: ${component.id}`);
  }
  return { ...state, components: [...state.components, component] };
}

export function updateComponent(
  state: BuilderState,
  componentId: string,
  patch: Partial<UIComponent>,
): BuilderState {
  return {
    ...state,
    components: state.components.map((component) =>
      component.id === componentId ? { ...component, ...patch } : component,
    ),
  };
}

export function removeComponent(state: BuilderState, componentId: string): BuilderState {
  return {
    ...state,
    components: state.components.filter((component) => component.id !== componentId),
  };
}

export function buildSchema(state: BuilderState): UISchema {
  return {
    version: state.version,
    pageId: state.pageId,
    layout: {
      id: 'root',
      type: 'section',
      title: 'Builder Preview',
      componentIds: state.components.map((component) => component.id),
    },
    components: state.components,
  };
}

export function BuilderApp({ initialState }: { initialState?: BuilderState }) {
  const [state, setState] = useState<BuilderState>(createBuilderState(initialState));
  const [draft, setDraft] = useState({
    id: '',
    adapterHint: 'material.input',
    labelKey: 'runtime.filters.customerName.label',
    ariaLabelKey: 'runtime.filters.customerName.aria',
  });
  const schema = useMemo(() => buildSchema(state), [state]);

  const addDraft = () => {
    if (!draft.id.trim()) return;
    const nextComponent: UIComponent = {
      id: draft.id.trim(),
      type: deriveType(draft.adapterHint),
      adapterHint: draft.adapterHint,
      i18n: {
        labelKey: draft.labelKey,
      },
      accessibility: {
        ariaLabelKey: draft.ariaLabelKey,
        keyboardNav: true,
        focusOrder: state.components.length + 1,
      },
    };
    setState((current) => addComponent(current, nextComponent));
    setDraft({ ...draft, id: '' });
  };

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', display: 'grid', gap: 24 }}>
      <section style={{ display: 'grid', gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Builder Web</h1>
        <p style={{ fontSize: 14, color: '#555' }}>
          Assemble UI schema components, enforce accessibility metadata, and preview the JSON output.
        </p>
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ fontSize: 16 }}>Add component</h2>
        <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
          <input
            placeholder="Component id"
            value={draft.id}
            onChange={(event) => setDraft({ ...draft, id: event.target.value })}
          />
          <input
            placeholder="Adapter hint"
            value={draft.adapterHint}
            onChange={(event) => setDraft({ ...draft, adapterHint: event.target.value })}
          />
          <input
            placeholder="Label key"
            value={draft.labelKey}
            onChange={(event) => setDraft({ ...draft, labelKey: event.target.value })}
          />
          <input
            placeholder="Aria label key"
            value={draft.ariaLabelKey}
            onChange={(event) => setDraft({ ...draft, ariaLabelKey: event.target.value })}
          />
          <button onClick={addDraft}>Add component</button>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ fontSize: 16 }}>Components</h2>
        {state.components.map((component) => (
          <div key={component.id} style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
            <div style={{ fontWeight: 600 }}>{component.id}</div>
            <div style={{ fontSize: 12, color: '#666' }}>{component.adapterHint}</div>
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              <input
                placeholder="Label key"
                value={component.i18n?.labelKey ?? ''}
                onChange={(event) =>
                  setState((current) =>
                    updateComponent(current, component.id, {
                      i18n: { ...(component.i18n ?? {}), labelKey: event.target.value },
                    }),
                  )
                }
              />
              <input
                placeholder="Aria label key"
                value={component.accessibility.ariaLabelKey}
                onChange={(event) =>
                  setState((current) =>
                    updateComponent(current, component.id, {
                      accessibility: { ...component.accessibility, ariaLabelKey: event.target.value },
                    }),
                  )
                }
              />
              <button onClick={() => setState((current) => removeComponent(current, component.id))}>Remove</button>
            </div>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ fontSize: 16 }}>Schema preview</h2>
        <pre style={{ background: '#f6f6f6', padding: 12, borderRadius: 8 }}>
          {JSON.stringify(schema, null, 2)}
        </pre>
      </section>
    </div>
  );
}

export function mountBuilder(target: HTMLElement | string, initialState?: BuilderState): void {
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  if (!element) {
    throw new Error('Builder target not found');
  }
  createRoot(element).render(<BuilderApp initialState={initialState} />);
}

function deriveType(adapterHint: string): string {
  const parts = adapterHint.split('.');
  return parts[parts.length - 1] || adapterHint;
}
