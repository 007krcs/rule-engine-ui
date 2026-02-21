'use client';

import React, { useEffect, useState } from 'react';
import type { I18nProvider } from '@platform/i18n';
import { createFallbackI18nProvider } from '@platform/i18n';
import { evaluateCondition } from '@platform/rules-engine';
import { createDataSourceAdapter, type DataSourceAdapter } from '@platform/runtime';
import { UnsupportedComponentPlaceholder } from '@platform/ui-kit';
import type {
  ExecutionContext,
  JSONValue,
  UIComponent,
  UIComponentDataSource,
  UIEventAction,
  UIGridItem,
  UISchema,
} from '@platform/schema';

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
  dataSourceAdapter?: DataSourceAdapter;
  dataSourceAdapterFactory?: (config: UIComponentDataSource) => DataSourceAdapter;
  adapterRegistry?: AdapterRegistry;
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

type AdapterRegistryEntry = {
  prefix: string;
  render: AdapterRenderFn;
};

export interface AdapterRegistry {
  register: (prefix: string, render: AdapterRenderFn) => void;
  resolve: (adapterHint: string) => AdapterRenderFn | undefined;
  hasPrefix: (prefix: string) => boolean;
  listPrefixes: () => string[];
}

export function createAdapterRegistry(): AdapterRegistry {
  const entries: AdapterRegistryEntry[] = [];
  return {
    register: (prefix, render) => {
      const normalized = prefix.trim();
      if (!normalized) {
        throw new Error('Adapter prefix must be a non-empty string.');
      }
      const existing = entries.findIndex((entry) => entry.prefix === normalized);
      if (existing >= 0) {
        entries[existing] = { prefix: normalized, render };
      } else {
        entries.push({ prefix: normalized, render });
      }
      entries.sort((a, b) => b.prefix.length - a.prefix.length);
    },
    resolve: (adapterHint) => entries.find((entry) => adapterHint.startsWith(entry.prefix))?.render,
    hasPrefix: (prefix) => entries.some((entry) => entry.prefix === prefix),
    listPrefixes: () => entries.map((entry) => entry.prefix),
  };
}

const defaultAdapterRegistry = createAdapterRegistry();
const INTERACTIVE_COMPONENT_HINTS = [
  'action',
  'autocomplete',
  'button',
  'checkbox',
  'date',
  'field',
  'input',
  'link',
  'menu',
  'pagination',
  'picker',
  'radio',
  'select',
  'slider',
  'stepper',
  'submit',
  'switch',
  'tab',
  'textarea',
  'time',
  'toggle',
] as const;

export function registerAdapter(
  prefix: string,
  render: AdapterRenderFn,
  adapterRegistry: AdapterRegistry = defaultAdapterRegistry,
): void {
  adapterRegistry.register(prefix, render);
}

export function getDefaultAdapterRegistry(): AdapterRegistry {
  return defaultAdapterRegistry;
}

export function listRegisteredAdapterPrefixes(
  adapterRegistry: AdapterRegistry = defaultAdapterRegistry,
): string[] {
  return adapterRegistry.listPrefixes();
}

export function isAdapterRegistered(
  adapterHintOrPrefix: string,
  adapterRegistry: AdapterRegistry = defaultAdapterRegistry,
): boolean {
  const normalized = adapterHintOrPrefix.trim();
  if (!normalized) return false;
  if (normalized.endsWith('.')) {
    return adapterRegistry.hasPrefix(normalized);
  }
  return Boolean(adapterRegistry.resolve(normalized));
}

export function RenderPage(props: RendererProps): React.ReactElement {
  const mode = props.mode ?? 'controlled';
  const [localData, setLocalData] = useState(props.data);
  const [localContext, setLocalContext] = useState(props.context);
  const [componentDataById, setComponentDataById] = useState<Record<string, JSONValue>>({});

  useEffect(() => {
    if (mode !== 'internal') return;
    setLocalData(props.data);
  }, [mode, props.data]);

  useEffect(() => {
    if (mode !== 'internal') return;
    setLocalContext(props.context);
  }, [mode, props.context]);

  useEffect(() => {
    const componentsWithDataSource = props.uiSchema.components.filter((component) => component.dataSource);
    if (componentsWithDataSource.length === 0) {
      setComponentDataById({});
      return;
    }

    let cancelled = false;
    const loadComponentData = async () => {
      const next: Record<string, JSONValue> = {};
      await Promise.all(
        componentsWithDataSource.map(async (component) => {
          const dataSource = component.dataSource;
          if (!dataSource) return;
          try {
            const adapter = resolveDataSourceAdapter(dataSource, props);
            await adapter.connect();
            const payload = await adapter.fetch({
              endpoint: dataSource.endpoint,
              query: dataSource.query,
              componentId: component.id,
              type: dataSource.type,
            });
            next[component.id] = toJSONValue(payload);
          } catch {
            // Backward compatibility: silently ignore failed remote loads.
          }
        }),
      );

      if (cancelled) return;
      setComponentDataById(next);
    };

    void loadComponentData();
    return () => {
      cancelled = true;
    };
  }, [props.dataSourceAdapter, props.dataSourceAdapterFactory, props.uiSchema.components]);

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

  let renderData = currentData;
  let renderContext = currentContext;
  const getActiveBreakpoint = (): 'lg' | 'md' | 'sm' => resolveBreakpoint(renderContext.device);

  const renderComponent = (
    componentId: string,
    itemOverride?: Pick<UIGridItem, 'props' | 'bindings' | 'rules'>,
  ): React.ReactNode => {
    const sourceComponent = componentMap.get(componentId);
    if (!sourceComponent) {
      return (
        <div key={componentId} data-missing-component>
          Missing component: {componentId}
        </div>
      );
    }

    const component = mergeComponent(sourceComponent, itemOverride);
    assertAccessibility(component);
    if (isResponsiveHidden(component, getActiveBreakpoint(), renderContext.device)) {
      return null;
    }

    const setValueResult = applySetValueRule(component, renderData, renderContext);
    renderData = setValueResult.data;
    renderContext = setValueResult.context;

    const ruleState = resolveComponentRuleState(component, renderData, renderContext);
    if (!ruleState.visible) return null;

    const adapter = resolveAdapter(component.adapterHint, props.adapterRegistry);
    if (!adapter) {
      const rendered = renderUnavailableComponent(component, 'missing-adapter');
      const wrapped = props.componentWrapper ? props.componentWrapper(component, rendered) : rendered;
      return React.cloneElement(wrapped, { key: component.id });
    }

    const componentForAdapter: UIComponent = {
      ...component,
      props: {
        ...(component.props ?? {}),
        disabled: Boolean(ruleState.disabled || component.props?.disabled),
      },
      validations: {
        ...(component.validations ?? {}),
        required: Boolean(ruleState.required || component.validations?.required),
      },
    };

    const componentData = resolveDataForComponent(
      renderData,
      componentForAdapter,
      componentDataById[component.id],
    );
    const bindings = resolveBindings(componentForAdapter, componentData, renderContext);
    const events = buildEvents(componentForAdapter, {
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
        {adapter(componentForAdapter, {
          data: componentData,
          context: renderContext,
          events,
          i18n,
          bindings,
        })}
      </div>
    );
    const wrapped = props.componentWrapper ? props.componentWrapper(componentForAdapter, rendered) : rendered;
    return React.cloneElement(wrapped, { key: component.id });
  };

  const renderLayout = (node: UISchema['layout']): React.ReactElement => {
    if (props.uiSchema.layoutType === 'grid' && Array.isArray(props.uiSchema.items) && props.uiSchema.items.length > 0) {
      const activeBreakpoint = getActiveBreakpoint();
      const spec = resolveGridSpecForBreakpoint(props.uiSchema, activeBreakpoint);
      const items = resolveGridItemsForBreakpoint(props.uiSchema, activeBreakpoint);
      const responsiveItems = applyResponsiveGridOverrides(
        items,
        componentMap,
        activeBreakpoint,
        renderContext.device,
        spec.columns,
      );
      const orderedItems = sortGridItemsByFocus(responsiveItems, componentMap);

      return (
        <div
          data-layout="grid-v2"
          style={{
            display: 'grid',
            gap: spec.gap,
            gridTemplateColumns: `repeat(${spec.columns}, minmax(0, 1fr))`,
            gridAutoRows: `${spec.rowHeight}px`,
          }}
        >
          {orderedItems.map((item) => (
            <div
              key={item.id}
              style={{
                gridColumn: `${item.x + 1} / span ${item.w}`,
                gridRow: `${item.y + 1} / span ${item.h}`,
                minWidth: 0,
              }}
            >
              {renderComponent(item.componentId, item)}
            </div>
          ))}
        </div>
      );
    }

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
            {sortComponentIdsByFocus(node.componentIds, componentMap).map((componentId) => {
              const component = componentMap.get(componentId);
              const span = resolveResponsiveSpan(component, getActiveBreakpoint(), renderContext.device);
              const rendered = renderComponent(componentId);
              if (!rendered) return null;
              if (!span) return rendered;
              return (
                <div key={`${componentId}:responsive-span`} style={{ gridColumn: `span ${span}` }}>
                  {rendered}
                </div>
              );
            })}
            {node.children?.map((child) => (
              <div key={child.id}>{renderLayout(child)}</div>
            ))}
          </div>
        );
      case 'stack':
        return (
          <div data-layout="stack" style={{ display: 'flex', flexDirection: node.direction === 'horizontal' ? 'row' : 'column', gap: 12 }}>
            {sortComponentIdsByFocus(node.componentIds, componentMap).map((componentId) => renderComponent(componentId))}
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
            {sortComponentIdsByFocus(node.componentIds, componentMap).map((componentId) => renderComponent(componentId))}
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
            {sortComponentIdsByFocus(fallback.componentIds, componentMap).map((componentId) => renderComponent(componentId))}
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

function resolveDataSourceAdapter(
  dataSource: UIComponentDataSource,
  props: RendererProps,
): DataSourceAdapter {
  if (props.dataSourceAdapterFactory) {
    return props.dataSourceAdapterFactory(dataSource);
  }
  if (props.dataSourceAdapter) {
    return props.dataSourceAdapter;
  }
  return createDataSourceAdapter(dataSource);
}

function resolveDataForComponent(
  baseData: Record<string, JSONValue>,
  component: UIComponent,
  sourcedData: JSONValue | undefined,
): Record<string, JSONValue> {
  if (sourcedData === undefined) return baseData;

  const withComponentScope: Record<string, JSONValue> = {
    ...baseData,
    [component.id]: sourcedData,
  };

  const valueBinding = component.bindings?.data?.valuePath ?? component.bindings?.data?.value;
  if (typeof valueBinding === 'string' && valueBinding.trim().length > 0) {
    const parsed = parseBindingPath(normalizeBindingPath(valueBinding, 'data'), 'data');
    if (parsed?.target === 'data') {
      return setPath(withComponentScope, parsed.path, sourcedData);
    }
  }

  if (isRecordValue(sourcedData)) {
    return {
      ...withComponentScope,
      ...sourcedData,
    };
  }

  return withComponentScope;
}

function toJSONValue(value: unknown): JSONValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => toJSONValue(entry));
  }
  if (value && typeof value === 'object') {
    const next: Record<string, JSONValue> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      next[key] = toJSONValue(entry);
    }
    return next;
  }
  return String(value);
}

function isRecordValue(value: JSONValue): value is Record<string, JSONValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeComponent(
  base: UIComponent,
  itemOverride?: Pick<UIGridItem, 'props' | 'bindings' | 'rules'>,
): UIComponent {
  if (!itemOverride) return base;
  return {
    ...base,
    props: {
      ...(base.props ?? {}),
      ...(itemOverride.props ?? {}),
    },
    bindings: {
      ...(base.bindings ?? {}),
      ...(itemOverride.bindings ?? {}),
      data: {
        ...(base.bindings?.data ?? {}),
        ...(itemOverride.bindings?.data ?? {}),
      },
      context: {
        ...(base.bindings?.context ?? {}),
        ...(itemOverride.bindings?.context ?? {}),
      },
      computed: {
        ...(base.bindings?.computed ?? {}),
        ...(itemOverride.bindings?.computed ?? {}),
      },
    },
    rules: {
      ...(base.rules ?? {}),
      ...(itemOverride.rules ?? {}),
    },
  };
}

function resolveComponentRuleState(
  component: UIComponent,
  data: Record<string, JSONValue>,
  context: ExecutionContext,
): { visible: boolean; disabled: boolean; required: boolean } {
  const rules = component.rules;
  if (!rules) return { visible: true, disabled: false, required: false };
  return {
    visible: rules.visibleWhen ? safeEvaluateCondition(rules.visibleWhen, context, data) : true,
    disabled: rules.disabledWhen ? safeEvaluateCondition(rules.disabledWhen, context, data) : false,
    required: rules.requiredWhen ? safeEvaluateCondition(rules.requiredWhen, context, data) : false,
  };
}

function applySetValueRule(
  component: UIComponent,
  data: Record<string, JSONValue>,
  context: ExecutionContext,
): { data: Record<string, JSONValue>; context: ExecutionContext } {
  const setValueRule = component.rules?.setValueWhen;
  if (!setValueRule) return { data, context };
  if (!safeEvaluateCondition(setValueRule.when, context, data)) return { data, context };

  const targetPath =
    setValueRule.path ??
    component.bindings?.data?.value ??
    component.bindings?.data?.[component.id] ??
    `data.${component.id}`;
  const parsed = parseBindingPath(targetPath, 'data');
  if (!parsed) return { data, context };

  if (parsed.target === 'context') {
    const nextContext = setPath(context as unknown as Record<string, JSONValue>, parsed.path, setValueRule.value);
    return { data, context: nextContext as unknown as ExecutionContext };
  }
  const nextData = setPath(data, parsed.path, setValueRule.value);
  return { data: nextData, context };
}

function safeEvaluateCondition(
  condition: NonNullable<UIComponent['rules']>[keyof NonNullable<UIComponent['rules']>] extends infer T
    ? T extends { when: infer C }
      ? C
      : T
    : never,
  context: ExecutionContext,
  data: Record<string, JSONValue>,
): boolean {
  try {
    return evaluateCondition(condition as never, context, data);
  } catch {
    return false;
  }
}

function resolveGridItemsForBreakpoint(schema: UISchema, breakpoint: 'lg' | 'md' | 'sm'): UIGridItem[] {
  const all = Array.isArray(schema.items) ? schema.items : [];
  const lgItems = all.filter((item) => !item.breakpoint || item.breakpoint === 'lg');
  const sortedLg = sortGridItems(lgItems);
  if (breakpoint === 'lg') return sortedLg;

  const overrides = new Map(
    all.filter((item) => item.breakpoint === breakpoint).map((item) => [item.componentId, item]),
  );

  return sortGridItems(
    sortedLg.map((base) => {
      const override = overrides.get(base.componentId);
      if (!override) {
        return {
          ...base,
          id: `${base.componentId}:${breakpoint}`,
          breakpoint,
        };
      }
      return {
        ...base,
        ...override,
        breakpoint,
      };
    }),
  );
}

function resolveGridSpecForBreakpoint(
  schema: UISchema,
  breakpoint: 'lg' | 'md' | 'sm',
): { columns: number; rowHeight: number; gap: number } {
  const grid = schema.grid;
  const baseColumns =
    grid?.columns ?? (schema.layout?.type === 'grid' ? Math.max(1, Number(schema.layout.columns ?? 1)) : 12);
  const baseRowHeight = grid?.rowHeight ?? 56;
  const baseGap = grid?.gap ?? 12;
  if (breakpoint === 'lg') {
    return {
      columns: Math.max(1, Math.trunc(baseColumns)),
      rowHeight: Math.max(1, Math.trunc(baseRowHeight)),
      gap: Math.max(1, Math.trunc(baseGap)),
    };
  }

  const bp = grid?.breakpoints?.[breakpoint];
  return {
    columns: Math.max(1, Math.trunc(bp?.columns ?? baseColumns)),
    rowHeight: Math.max(1, Math.trunc(bp?.rowHeight ?? baseRowHeight)),
    gap: Math.max(1, Math.trunc(bp?.gap ?? baseGap)),
  };
}

function sortGridItems(items: UIGridItem[]): UIGridItem[] {
  return [...items].sort((a, b) => {
    const ay = Number(a.y) || 0;
    const by = Number(b.y) || 0;
    if (ay !== by) return ay - by;
    const ax = Number(a.x) || 0;
    const bx = Number(b.x) || 0;
    if (ax !== bx) return ax - bx;
    return a.componentId.localeCompare(b.componentId);
  });
}

function applyResponsiveGridOverrides(
  items: UIGridItem[],
  componentMap: Map<string, UIComponent>,
  breakpoint: 'lg' | 'md' | 'sm',
  device: ExecutionContext['device'],
  maxColumns: number,
): UIGridItem[] {
  return items
    .map((item) => {
      const component = componentMap.get(item.componentId);
      if (component && isResponsiveHidden(component, breakpoint, device)) {
        return null;
      }
      const span = resolveResponsiveSpan(component, breakpoint, device);
      if (!span) {
        return item;
      }
      const safeSpan = Math.max(1, Math.min(maxColumns, span));
      const maxX = Math.max(0, maxColumns - safeSpan);
      return {
        ...item,
        w: safeSpan,
        x: Math.max(0, Math.min(maxX, Math.trunc(Number(item.x) || 0))),
      };
    })
    .filter((item): item is UIGridItem => item !== null);
}

function sortGridItemsByFocus(items: UIGridItem[], componentMap: Map<string, UIComponent>): UIGridItem[] {
  return [...items].sort((left, right) => {
    const leftOrder = resolveComponentFocusOrder(componentMap.get(left.componentId));
    const rightOrder = resolveComponentFocusOrder(componentMap.get(right.componentId));
    const leftHasOrder = leftOrder !== null;
    const rightHasOrder = rightOrder !== null;
    if (leftHasOrder && rightHasOrder && leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    if (leftHasOrder !== rightHasOrder) {
      return leftHasOrder ? -1 : 1;
    }
    const yDiff = (Number(left.y) || 0) - (Number(right.y) || 0);
    if (yDiff !== 0) return yDiff;
    const xDiff = (Number(left.x) || 0) - (Number(right.x) || 0);
    if (xDiff !== 0) return xDiff;
    return left.componentId.localeCompare(right.componentId);
  });
}

function sortComponentIdsByFocus(
  componentIds: string[] | undefined,
  componentMap: Map<string, UIComponent>,
): string[] {
  if (!componentIds || componentIds.length < 2) return componentIds ?? [];
  return [...componentIds].sort((left, right) => {
    const leftOrder = resolveComponentFocusOrder(componentMap.get(left));
    const rightOrder = resolveComponentFocusOrder(componentMap.get(right));
    const leftHasOrder = leftOrder !== null;
    const rightHasOrder = rightOrder !== null;
    if (leftHasOrder && rightHasOrder && leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    if (leftHasOrder !== rightHasOrder) {
      return leftHasOrder ? -1 : 1;
    }
    return 0;
  });
}

function resolveResponsiveBreakpoints(
  component: UIComponent,
): NonNullable<NonNullable<UIComponent['responsive']>['breakpoints']> | null {
  const breakpoints = component.responsive?.breakpoints;
  if (!breakpoints) return null;
  return breakpoints;
}

function resolveResponsiveValue(
  component: UIComponent | undefined,
  breakpoint: 'lg' | 'md' | 'sm',
  device: ExecutionContext['device'],
):
  | {
      columns?: number;
      span?: number;
      hidden?: boolean;
    }
  | null {
  if (!component) return null;
  const breakpoints = resolveResponsiveBreakpoints(component);
  if (!breakpoints) return null;

  const alias = breakpoint === 'lg' ? 'desktop' : breakpoint === 'md' ? 'tablet' : 'mobile';
  const keys = [breakpoint, breakpoint.toUpperCase(), device, device.toUpperCase(), alias, alias.toUpperCase()];
  for (const key of keys) {
    const value = breakpoints[key];
    if (value) return value;
  }
  return null;
}

function resolveResponsiveSpan(
  component: UIComponent | undefined,
  breakpoint: 'lg' | 'md' | 'sm',
  device: ExecutionContext['device'],
): number | null {
  const responsiveValue = resolveResponsiveValue(component, breakpoint, device);
  if (!responsiveValue) return null;
  const raw = responsiveValue.span ?? responsiveValue.columns;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  return Math.max(1, Math.trunc(raw));
}

function isResponsiveHidden(
  component: UIComponent | undefined,
  breakpoint: 'lg' | 'md' | 'sm',
  device: ExecutionContext['device'],
): boolean {
  const responsiveValue = resolveResponsiveValue(component, breakpoint, device);
  return Boolean(responsiveValue?.hidden);
}

function resolveBreakpoint(device: ExecutionContext['device']): 'lg' | 'md' | 'sm' {
  if (device === 'mobile') return 'sm';
  if (device === 'tablet') return 'md';
  return 'lg';
}

function resolveAdapter(
  adapterHint: string,
  adapterRegistry: AdapterRegistry | undefined,
): AdapterRenderFn | undefined {
  const registry = adapterRegistry ?? defaultAdapterRegistry;
  return registry.resolve(adapterHint);
}

function renderUnavailableComponent(
  component: UIComponent,
  reason: 'missing-adapter' | 'unsupported-component',
): React.ReactElement {
  return (
    <UnsupportedComponentPlaceholder
      id={component.adapterHint}
      data-component-id={component.id}
      data-component-not-available
      data-component-reason={reason}
      onReplace={() => {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(
          new CustomEvent('ruleflow:replace-component-request', {
            detail: {
              componentId: component.id,
              adapterHint: component.adapterHint,
            },
          }),
        );
      }}
      onViewRegistry={() => {
        if (typeof window === 'undefined') return;
        window.location.assign(`/component-registry?c=${encodeURIComponent(component.adapterHint)}`);
      }}
      onContactAdmin={() => {
        if (typeof navigator === 'undefined' || !navigator.clipboard) return;
        const requestText =
          `Please enable support for ${component.adapterHint}.\n` +
          `Component id: ${component.id}\n` +
          'This component is required by an active schema.';
        void navigator.clipboard.writeText(requestText);
      }}
    />
  );
}

function assertAccessibility(component: UIComponent): void {
  const accessibility = component.accessibility;
  if (!accessibility) {
    throw new Error(`Accessibility metadata is required for component ${component.id}`);
  }
  if (isInteractiveComponent(component) && (!accessibility.ariaLabelKey || accessibility.ariaLabelKey.trim().length === 0)) {
    throw new Error(`ariaLabelKey is required for component ${component.id}`);
  }
  if (isInteractiveComponent(component) && accessibility.keyboardNav !== true) {
    throw new Error(`keyboardNav must be true for component ${component.id}`);
  }
  const focusOrder = accessibility.focusOrder;
  if (isTabbableComponent(component) && (typeof focusOrder !== 'number' || !Number.isInteger(focusOrder) || focusOrder < 1)) {
    throw new Error(`focusOrder must be an integer >= 1 for component ${component.id}`);
  }
}

function isInteractiveComponent(component: UIComponent): boolean {
  const type = String(component.type ?? '').toLowerCase();
  const adapterHint = String(component.adapterHint ?? '').toLowerCase();
  const hasHandlers = Boolean(
    component.events?.onChange?.length ||
      component.events?.onClick?.length ||
      component.events?.onSubmit?.length,
  );
  if (hasHandlers) return true;
  return INTERACTIVE_COMPONENT_HINTS.some((hint) => type.includes(hint) || adapterHint.includes(hint));
}

function isTabbableComponent(component: UIComponent): boolean {
  return isInteractiveComponent(component);
}

function resolveComponentFocusOrder(component: UIComponent | undefined): number | null {
  if (!component || !isTabbableComponent(component)) return null;
  const focusOrder = component.accessibility?.focusOrder;
  if (typeof focusOrder !== 'number' || !Number.isInteger(focusOrder) || focusOrder < 1) return null;
  return focusOrder;
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
