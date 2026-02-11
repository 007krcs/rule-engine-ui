import React, { useEffect, useState } from 'react';
import type { I18nProvider } from '@platform/i18n';
import { createFallbackI18nProvider } from '@platform/i18n';
import type { ExecutionContext, JSONValue, UIComponent, UIEventAction, UISchema } from '@platform/schema';

export type UIEventName = 'onChange' | 'onClick' | 'onSubmit';

export type BindingTarget = 'data' | 'context' | 'computed';

export type BindingValue = {
  target: BindingTarget;
  path: string;
  value: JSONValue | undefined;
};

export type BindingGroupValues = {
  data: Record<string, BindingValue>;
  context: Record<string, BindingValue>;
  computed: Record<string, BindingValue>;
};

export type ChangeEventPayload = {
  componentId: string;
  value: JSONValue;
  bindingPath: string;
};

export type ClickEventPayload = {
  componentId: string;
};

export type RendererOnChange = (bindingPath: string, value: JSONValue, componentId: string) => void;

export interface RendererProps {
  uiSchema: UISchema;
  data: Record<string, JSONValue>;
  context: ExecutionContext;
  i18n?: I18nProvider;
  onEvent?: (event: UIEventName, actions: UIEventAction[], component: UIComponent) => void;
  onAdapterEvent?: (event: UIEventName, payload: ChangeEventPayload | ClickEventPayload, component: UIComponent) => void;
  onChange?: RendererOnChange;
  onDataChange?: (data: Record<string, JSONValue>) => void;
  onContextChange?: (context: ExecutionContext) => void;
  mode?: 'controlled' | 'internal';
  componentWrapper?: (component: UIComponent, rendered: React.ReactElement) => React.ReactElement;
}

export interface AdapterContext {
  data: Record<string, JSONValue>;
  context: ExecutionContext;
  i18n: I18nProvider;
  bindings: BindingGroupValues;
  events: {
    onChange?: (payloadOrValue: ChangeEventPayload | JSONValue, bindingPath?: string) => void;
    onClick?: (payload: ClickEventPayload) => void;
    onSubmit?: (payload: ClickEventPayload) => void;
  };
}

export type AdapterRenderFn = (component: UIComponent, ctx: AdapterContext) => React.ReactElement;

const registry: Array<{ prefix: string; render: AdapterRenderFn }> = [];

export function registerAdapter(prefix: string, render: AdapterRenderFn): void {
  registry.push({ prefix, render });
  registry.sort((a, b) => b.prefix.length - a.prefix.length);
}

export function RenderPage(props: RendererProps): React.ReactElement {
  const mode = props.mode ?? 'controlled';
  const [localData, setLocalData] = useState(props.data);
  const [localContext, setLocalContext] = useState(props.context);

  useEffect(() => {
    if (mode !== 'internal') return;
    setLocalData(props.data);
  }, [mode, props.data]);

  useEffect(() => {
    if (mode !== 'internal') return;
    setLocalContext(props.context);
  }, [mode, props.context]);

  const currentData = mode === 'internal' ? localData : props.data;
  const currentContext = mode === 'internal' ? localContext : props.context;

  const applyDataChange = (next: Record<string, JSONValue>) => {
    if (mode === 'internal') {
      setLocalData(next);
    }
    props.onDataChange?.(next);
  };

  const applyContextChange = (next: ExecutionContext) => {
    if (mode === 'internal') {
      setLocalContext(next);
    }
    props.onContextChange?.(next);
  };

  const componentMap = new Map(props.uiSchema.components.map((component) => [component.id, component]));
  const i18n = props.i18n ?? createFallbackI18nProvider();

  const renderComponent = (componentId: string): React.ReactElement => {
    const component = componentMap.get(componentId);
    if (!component) {
      return (
        <div key={componentId} data-missing-component>
          Missing component: {componentId}
        </div>
      );
    }

    assertAccessibility(component);

    const adapter = resolveAdapter(component.adapterHint);
    if (!adapter) {
      const rendered = (
        <div data-component-id={component.id} data-missing-adapter>
          No adapter for {component.adapterHint}
        </div>
      );
      const wrapped = props.componentWrapper ? props.componentWrapper(component, rendered) : rendered;
      return React.cloneElement(wrapped, { key: component.id });
    }

    const bindings = resolveBindings(component, currentData, currentContext);
    const events = buildEvents(component, {
      onEvent: props.onEvent,
      onAdapterEvent: props.onAdapterEvent,
      onChange: props.onChange,
      onDataChange: applyDataChange,
      onContextChange: applyContextChange,
      data: currentData,
      context: currentContext,
    });
    const rendered = (
      <div data-component-id={component.id}>
        {adapter(component, { data: currentData, context: currentContext, events, i18n, bindings })}
      </div>
    );
    const wrapped = props.componentWrapper ? props.componentWrapper(component, rendered) : rendered;
    return React.cloneElement(wrapped, { key: component.id });
  };

  const renderLayout = (node: UISchema['layout']): React.ReactElement => {
    switch (node.type) {
      case 'grid':
        return (
          <div
            data-layout="grid"
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns:
                typeof node.columns === 'number' && node.columns > 0 ? `repeat(${node.columns}, minmax(0, 1fr))` : undefined,
            }}
          >
            {node.componentIds?.map(renderComponent)}
            {node.children?.map((child) => (
              <div key={child.id}>{renderLayout(child)}</div>
            ))}
          </div>
        );
      case 'stack':
        return (
          <div data-layout="stack" style={{ display: 'flex', flexDirection: node.direction === 'horizontal' ? 'row' : 'column', gap: 12 }}>
            {node.componentIds?.map(renderComponent)}
            {node.children?.map((child) => (
              <div key={child.id}>{renderLayout(child)}</div>
            ))}
          </div>
        );
      case 'tabs':
        return (
          <div data-layout="tabs">
            {node.tabs.map((tab) => (
              <section key={tab.id}>
                <h3>{tab.label}</h3>
                {renderLayout(tab.child)}
              </section>
            ))}
          </div>
        );
      case 'section':
        return (
          <section data-layout="section">
            {node.title && <h2>{node.title}</h2>}
            {node.componentIds?.map(renderComponent)}
            {node.children?.map((child) => (
              <div key={child.id}>{renderLayout(child)}</div>
            ))}
          </section>
        );
      default: {
        const fallback = node as {
          componentIds?: string[];
          children?: UISchema['layout'][];
        };
        return (
          <div data-layout="unknown">
            {fallback.componentIds?.map(renderComponent)}
            {fallback.children?.map((child) => (
              <div key={child.id}>{renderLayout(child)}</div>
            ))}
          </div>
        );
      }
    }
  };

  return (
    <div data-ui-page={props.uiSchema.pageId} dir={i18n.direction}>
      {renderLayout(props.uiSchema.layout)}
    </div>
  );
}

function resolveAdapter(adapterHint: string): AdapterRenderFn | undefined {
  return registry.find((entry) => adapterHint.startsWith(entry.prefix))?.render;
}

function assertAccessibility(component: UIComponent): void {
  const accessibility = component.accessibility;
  if (!accessibility) {
    throw new Error(`Accessibility metadata is required for component ${component.id}`);
  }
  if (!accessibility.ariaLabelKey || accessibility.ariaLabelKey.trim().length === 0) {
    throw new Error(`ariaLabelKey is required for component ${component.id}`);
  }
  if (accessibility.keyboardNav !== true) {
    throw new Error(`keyboardNav must be true for component ${component.id}`);
  }
  const focusOrder = accessibility.focusOrder;
  if (typeof focusOrder !== 'number' || !Number.isInteger(focusOrder) || focusOrder < 1) {
    throw new Error(`focusOrder must be an integer >= 1 for component ${component.id}`);
  }
}

function buildEvents(
  component: UIComponent,
  options: {
    onEvent?: (event: UIEventName, actions: UIEventAction[], component: UIComponent) => void;
    onAdapterEvent?: (event: UIEventName, payload: ChangeEventPayload | ClickEventPayload, component: UIComponent) => void;
    onChange?: RendererOnChange;
    onDataChange: (next: Record<string, JSONValue>) => void;
    onContextChange: (next: ExecutionContext) => void;
    data: Record<string, JSONValue>;
    context: ExecutionContext;
  },
): AdapterContext['events'] {
  const emitSchemaEvent = (event: UIEventName) => {
    const actions = component.events?.[event];
    if (actions && actions.length > 0) {
      options.onEvent?.(event, actions, component);
    }
  };

  return {
    onChange: (payloadOrValue, bindingPath) => {
      const payload = normalizeChangePayload(component, payloadOrValue, bindingPath);
      const resolvedBindingPath = payload.bindingPath || component.bindings?.data?.value || 'data.value';
      const parsed = parseBindingPath(resolvedBindingPath, 'data');
      if (parsed) {
        if (parsed.target === 'data') {
          const next = setPath(options.data, parsed.path, payload.value);
          options.onDataChange(next);
        } else if (parsed.target === 'context') {
          const next = setPath(options.context as unknown as Record<string, JSONValue>, parsed.path, payload.value);
          options.onContextChange(next as unknown as ExecutionContext);
        }
      }
      const normalizedPath = parsed ? `${parsed.target}.${parsed.path}` : resolvedBindingPath;
      options.onChange?.(normalizedPath, payload.value, payload.componentId);
      options.onAdapterEvent?.('onChange', payload, component);
      emitSchemaEvent('onChange');
    },
    onClick: (payload) => {
      options.onAdapterEvent?.('onClick', payload, component);
      emitSchemaEvent('onClick');
    },
    onSubmit: (payload) => {
      options.onAdapterEvent?.('onSubmit', payload, component);
      emitSchemaEvent('onSubmit');
    },
  };
}

function normalizeChangePayload(
  component: UIComponent,
  payloadOrValue: ChangeEventPayload | JSONValue,
  bindingPath?: string,
): ChangeEventPayload {
  if (isChangeEventPayload(payloadOrValue)) {
    return payloadOrValue;
  }

  return {
    componentId: component.id,
    value: payloadOrValue,
    bindingPath: bindingPath ?? component.bindings?.data?.value ?? 'data.value',
  };
}

function isChangeEventPayload(value: ChangeEventPayload | JSONValue): value is ChangeEventPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<ChangeEventPayload>;
  return typeof candidate.componentId === 'string' && typeof candidate.bindingPath === 'string' && 'value' in candidate;
}

function resolveBindings(
  component: UIComponent,
  data: Record<string, JSONValue>,
  context: ExecutionContext,
): BindingGroupValues {
  const bindings = component.bindings;
  const out: BindingGroupValues = { data: {}, context: {}, computed: {} };
  if (!bindings) return out;

  if (bindings.data) {
    for (const [key, path] of Object.entries(bindings.data)) {
      if (typeof path !== 'string' || path.trim().length === 0) continue;
      const normalized = normalizeBindingPath(path, 'data');
      const parsed = parseBindingPath(normalized, 'data');
      if (!parsed) continue;
      out.data[key] = {
        target: 'data',
        path: normalized,
        value: getPath(data, parsed.path),
      };
    }
  }

  if (bindings.context) {
    for (const [key, path] of Object.entries(bindings.context)) {
      if (typeof path !== 'string' || path.trim().length === 0) continue;
      const normalized = normalizeBindingPath(path, 'context');
      const parsed = parseBindingPath(normalized, 'context');
      if (!parsed) continue;
      out.context[key] = {
        target: 'context',
        path: normalized,
        value: getPath(context as unknown as Record<string, JSONValue>, parsed.path),
      };
    }
  }

  if (bindings.computed) {
    for (const [key, path] of Object.entries(bindings.computed)) {
      if (typeof path !== 'string' || path.trim().length === 0) continue;
      const normalized = normalizeBindingPath(path, 'data');
      const parsed = parseBindingPath(normalized, 'data');
      if (!parsed) continue;
      const source = parsed.target === 'context' ? (context as unknown as Record<string, JSONValue>) : data;
      out.computed[key] = {
        target: 'computed',
        path: normalized,
        value: getPath(source, parsed.path),
      };
    }
  }

  return out;
}

function normalizeBindingPath(path: string, target: 'data' | 'context'): string {
  const trimmed = path.trim();
  if (trimmed.startsWith('data.') || trimmed.startsWith('context.')) return trimmed;
  return `${target}.${trimmed}`;
}

function parseBindingPath(
  bindingPath: string,
  defaultTarget: 'data' | 'context',
): { target: 'data' | 'context'; path: string } | null {
  const raw = bindingPath.trim();
  if (!raw) return null;
  if (raw.startsWith('data.')) return { target: 'data', path: raw.slice('data.'.length) };
  if (raw.startsWith('context.')) return { target: 'context', path: raw.slice('context.'.length) };
  return { target: defaultTarget, path: raw };
}

function getPath(obj: Record<string, JSONValue>, path: string): JSONValue | undefined {
  if (!path) return obj as unknown as JSONValue;
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let current: JSONValue | undefined = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    const index = Number(part);
    if (!Number.isNaN(index) && Array.isArray(current)) {
      current = current[index];
      continue;
    }
    if (typeof current !== 'object' || Array.isArray(current)) return undefined;
    if (isUnsafeKey(part)) return undefined;
    current = (current as Record<string, JSONValue>)[part];
  }
  return current;
}

function setPath(obj: Record<string, JSONValue>, path: string, value: JSONValue): Record<string, JSONValue> {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  return setAtPath(obj, parts, value) as Record<string, JSONValue>;
}

function setAtPath(current: JSONValue | undefined, parts: string[], value: JSONValue): JSONValue {
  if (parts.length === 0) return value;
  const [head, ...rest] = parts;
  if (head === undefined) return value;
  const index = Number(head);
  const isIndex = !Number.isNaN(index);

  const base: JSONValue = current && typeof current === 'object' ? current : isIndex ? [] : {};
  const next = Array.isArray(base) ? [...base] : ({ ...base } as Record<string, JSONValue>);

  if (isIndex && Array.isArray(next)) {
    next[index] = setAtPath(next[index] as JSONValue | undefined, rest, value) as JSONValue;
    return next;
  }

  if (typeof next !== 'object' || Array.isArray(next)) return next;
  if (isUnsafeKey(head)) return next;
  next[head] = setAtPath(next[head], rest, value) as JSONValue;
  return next;
}

function isUnsafeKey(value: string): boolean {
  return value === '__proto__' || value === 'constructor' || value === 'prototype';
}
