import type {
  BindingSpec,
  ExecutionContext,
  JSONValue,
  LayoutNode,
  RuleCondition,
  UIComponent,
  UIEventAction,
  UIGridItem,
  UISchema,
} from '@platform/schema';
import type { I18nProvider } from '@platform/i18n';
import { createFallbackI18nProvider } from '@platform/i18n';
import { evaluateCondition } from '@platform/rules-engine';

export type UIEventName = 'onChange' | 'onClick' | 'onSubmit';

export type BindingValue = {
  target: 'data' | 'context' | 'computed';
  path: string;
  value: JSONValue | undefined;
};

export type BindingGroupValues = {
  data: Record<string, BindingValue>;
  context: Record<string, BindingValue>;
  computed: Record<string, BindingValue>;
};

export type ChangeEventPayload = { componentId: string; value: JSONValue; bindingPath: string };
export type ClickEventPayload = { componentId: string };

export interface VueAdapterContext {
  data: Record<string, JSONValue>;
  context: ExecutionContext;
  i18n: I18nProvider;
  bindings: BindingGroupValues;
  ruleState: { visible: boolean; disabled: boolean; required: boolean };
  events: {
    onChangeAttrs: (bindingPath?: string) => string;
    onClickAttrs: () => string;
    onSubmitAttrs: () => string;
  };
}

export type VueAdapterRenderFn = (component: UIComponent, ctx: VueAdapterContext) => string;

export interface VueAdapterRegistry {
  register: (prefix: string, render: VueAdapterRenderFn) => void;
  resolve: (adapterHint: string) => VueAdapterRenderFn | undefined;
  hasPrefix: (prefix: string) => boolean;
  listPrefixes: () => string[];
}

export interface RenderPageVueOptions {
  uiSchema: UISchema;
  data: Record<string, JSONValue>;
  context: ExecutionContext;
  i18n?: I18nProvider;
  target?: HTMLElement | string;
  adapterRegistry?: VueAdapterRegistry;
  onEvent?: (event: UIEventName, actions: UIEventAction[], component: UIComponent) => void;
  onAdapterEvent?: (
    event: UIEventName,
    payload: ChangeEventPayload | ClickEventPayload,
    component: UIComponent,
  ) => void;
  onDataChange?: (data: Record<string, JSONValue>) => void;
  onContextChange?: (context: ExecutionContext) => void;
  onChange?: (bindingPath: string, value: JSONValue, componentId: string) => void;
}

export interface RenderPageVueResult {
  html: string;
  data: Record<string, JSONValue>;
  context: ExecutionContext;
  dispatchEvent: (input: {
    event: UIEventName;
    componentId: string;
    value?: JSONValue;
    bindingPath?: string;
  }) => void;
}

export interface VueRenderOptions {
  uiSchema: UISchema;
  data?: Record<string, JSONValue>;
  context?: ExecutionContext;
  i18n?: I18nProvider;
  target?: HTMLElement | string;
}

// =============================================
// Hydration Types
// =============================================

export interface HydrationOptions {
  container: HTMLElement | string;
  uiSchema: UISchema;
  data: Record<string, JSONValue>;
  context: ExecutionContext;
  i18n?: I18nProvider;
  adapterRegistry?: VueAdapterRegistry;
  onEvent?: (event: UIEventName, actions: UIEventAction[], component: UIComponent) => void;
  onAdapterEvent?: (
    event: UIEventName,
    payload: ChangeEventPayload | ClickEventPayload,
    component: UIComponent,
  ) => void;
  onDataChange?: (data: Record<string, JSONValue>) => void;
  onContextChange?: (context: ExecutionContext) => void;
  onChange?: (bindingPath: string, value: JSONValue, componentId: string) => void;
}

export interface HydrationResult {
  data: Record<string, JSONValue>;
  context: ExecutionContext;
  dispatchEvent: (input: {
    event: UIEventName;
    componentId: string;
    value?: JSONValue;
    bindingPath?: string;
  }) => void;
  dispose: () => void;
  rerender: () => void;
}

// =============================================
// Event Dispatcher Service
// =============================================

export interface EventDispatcherConfig {
  onEvent?: (event: UIEventName, actions: UIEventAction[], component: UIComponent) => void;
  onAdapterEvent?: (
    event: UIEventName,
    payload: ChangeEventPayload | ClickEventPayload,
    component: UIComponent,
  ) => void;
  onChange?: (bindingPath: string, value: JSONValue, componentId: string) => void;
  onDataChange?: (data: Record<string, JSONValue>) => void;
  onContextChange?: (context: ExecutionContext) => void;
}

export interface EventDispatcher {
  dispatch: (input: {
    event: UIEventName;
    componentId: string;
    value?: JSONValue;
    bindingPath?: string;
  }) => void;
  getData: () => Record<string, JSONValue>;
  getContext: () => ExecutionContext;
}

export function createEventDispatcher(
  componentMap: Map<string, UIComponent>,
  initialData: Record<string, JSONValue>,
  initialContext: ExecutionContext,
  config: EventDispatcherConfig,
): EventDispatcher {
  let data = deepClone(initialData);
  let context = deepClone(initialContext);

  const dispatch = (input: {
    event: UIEventName;
    componentId: string;
    value?: JSONValue;
    bindingPath?: string;
  }) => {
    const component = componentMap.get(input.componentId);
    if (!component) return;

    if (input.event === 'onChange') {
      const bindingPath = input.bindingPath ?? component.bindings?.data?.value ?? 'data.value';
      const parsed = parseBindingPath(bindingPath, 'data');
      const value = input.value ?? null;

      if (parsed) {
        if (parsed.target === 'data') {
          data = setPath(data, parsed.path, value);
        } else {
          context = setPath(
            context as unknown as Record<string, JSONValue>,
            parsed.path,
            value,
          ) as unknown as ExecutionContext;
        }
      }

      config.onChange?.(bindingPath, value, component.id);
      config.onDataChange?.(data);
      config.onContextChange?.(context);
      config.onAdapterEvent?.(
        'onChange',
        { componentId: component.id, value, bindingPath },
        component,
      );
    } else {
      config.onAdapterEvent?.(input.event, { componentId: component.id }, component);
    }

    const actions = component.events?.[input.event];
    if (actions && actions.length > 0) {
      config.onEvent?.(input.event, actions, component);
    }
  };

  return {
    dispatch,
    getData: () => data,
    getContext: () => context,
  };
}

// =============================================
// DOM Listener Binder
// =============================================

export interface DomListenerBinderOptions {
  container: HTMLElement;
  dispatchEvent: (input: {
    event: UIEventName;
    componentId: string;
    value?: JSONValue;
    bindingPath?: string;
  }) => void;
}

export interface DomListenerBinderResult {
  dispose: () => void;
}

export function createDomListenerBinder(options: DomListenerBinderOptions): DomListenerBinderResult {
  const { container, dispatchEvent } = options;
  const boundElements = new Set<Element>();
  const eventHandlers = new Map<Element, { type: string; handler: EventListener }[]>();

  const bindListeners = () => {
    const elements = container.querySelectorAll('[data-rf-event]');
    elements.forEach((el) => {
      if (boundElements.has(el)) return;
      boundElements.add(el);

      const eventType = el.getAttribute('data-rf-event') as UIEventName | null;
      const componentId = el.getAttribute('data-rf-component-id');
      const bindingPath = el.getAttribute('data-rf-binding-path');

      if (!eventType || !componentId) return;

      const handlers: { type: string; handler: EventListener }[] = [];

      if (eventType === 'onChange') {
        const handler = (e: Event) => {
          const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
          let value: JSONValue = target.value;
          if (target.type === 'checkbox') {
            value = (target as HTMLInputElement).checked;
          } else if (target.type === 'number') {
            value = parseFloat(target.value) || 0;
          }
          dispatchEvent({ event: 'onChange', componentId, value, bindingPath: bindingPath ?? undefined });
        };
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
        handlers.push({ type: 'input', handler }, { type: 'change', handler });
      } else if (eventType === 'onClick') {
        const handler = (e: Event) => {
          e.preventDefault();
          dispatchEvent({ event: 'onClick', componentId });
        };
        el.addEventListener('click', handler);
        handlers.push({ type: 'click', handler });
      } else if (eventType === 'onSubmit') {
        const handler = (e: Event) => {
          e.preventDefault();
          dispatchEvent({ event: 'onSubmit', componentId });
        };
        el.addEventListener('submit', handler);
        handlers.push({ type: 'submit', handler });
      }

      eventHandlers.set(el, handlers);
    });
  };

  const dispose = () => {
    eventHandlers.forEach((handlers, el) => {
      handlers.forEach(({ type, handler }) => {
        el.removeEventListener(type, handler);
      });
    });
    eventHandlers.clear();
    boundElements.clear();
  };

  bindListeners();

  return { dispose };
}

// =============================================
// Hydration API
// =============================================

export function hydrate(options: HydrationOptions): HydrationResult {
  const container = resolveTarget(options.container);
  if (!container) {
    throw new Error('Hydration requires a valid container element');
  }

  const adapterRegistry = options.adapterRegistry ?? getDefaultAdapterRegistry();
  ensureDefaultAdapters(adapterRegistry);

  const componentMap = new Map(
    options.uiSchema.components.map((component) => [component.id, component]),
  );

  const dispatcher = createEventDispatcher(
    componentMap,
    options.data,
    options.context,
    {
      onEvent: options.onEvent,
      onAdapterEvent: options.onAdapterEvent,
      onChange: options.onChange,
      onDataChange: options.onDataChange,
      onContextChange: options.onContextChange,
    },
  );

  let listenerBinder = createDomListenerBinder({
    container,
    dispatchEvent: dispatcher.dispatch,
  });

  const rerender = () => {
    listenerBinder.dispose();

    const runtime: Runtime = {
      options: {
        uiSchema: options.uiSchema,
        data: dispatcher.getData(),
        context: dispatcher.getContext(),
        i18n: options.i18n,
        target: container,
        adapterRegistry,
        onEvent: options.onEvent,
        onAdapterEvent: options.onAdapterEvent,
        onDataChange: options.onDataChange,
        onContextChange: options.onContextChange,
        onChange: options.onChange,
      },
      adapterRegistry,
      i18n: options.i18n ?? createFallbackI18nProvider(),
      data: dispatcher.getData(),
      context: dispatcher.getContext(),
      html: '',
      componentMap,
      target: container,
    };

    runtime.html = renderRuntime(runtime);
    container.innerHTML = runtime.html;

    listenerBinder = createDomListenerBinder({
      container,
      dispatchEvent: dispatcher.dispatch,
    });
  };

  const dispose = () => {
    listenerBinder.dispose();
  };

  return {
    data: dispatcher.getData(),
    context: dispatcher.getContext(),
    dispatchEvent: (input) => {
      dispatcher.dispatch(input);
      rerender();
    },
    dispose,
    rerender,
  };
}

// =============================================
// Runtime Types and Core Functions
// =============================================

type Runtime = {
  options: RenderPageVueOptions;
  adapterRegistry: VueAdapterRegistry;
  i18n: I18nProvider;
  data: Record<string, JSONValue>;
  context: ExecutionContext;
  html: string;
  componentMap: Map<string, UIComponent>;
  target: HTMLElement | null;
};

const defaultAdapterRegistry = createAdapterRegistry();
const bootstrapped = new WeakSet<VueAdapterRegistry>();

export function createAdapterRegistry(): VueAdapterRegistry {
  const entries: Array<{ prefix: string; render: VueAdapterRenderFn }> = [];
  return {
    register: (prefix, render) => {
      const normalized = prefix.trim();
      if (!normalized) throw new Error('Adapter prefix must be a non-empty string.');
      const existing = entries.findIndex((entry) => entry.prefix === normalized);
      if (existing >= 0) entries[existing] = { prefix: normalized, render };
      else entries.push({ prefix: normalized, render });
      entries.sort((a, b) => b.prefix.length - a.prefix.length);
    },
    resolve: (adapterHint) => entries.find((entry) => adapterHint.startsWith(entry.prefix))?.render,
    hasPrefix: (prefix) => entries.some((entry) => entry.prefix === prefix),
    listPrefixes: () => entries.map((entry) => entry.prefix),
  };
}

export function registerAdapter(
  prefix: string,
  render: VueAdapterRenderFn,
  adapterRegistry: VueAdapterRegistry = defaultAdapterRegistry,
): void {
  adapterRegistry.register(prefix, render);
}

export function getDefaultAdapterRegistry(): VueAdapterRegistry {
  ensureDefaultAdapters(defaultAdapterRegistry);
  return defaultAdapterRegistry;
}

export function listRegisteredAdapterPrefixes(
  adapterRegistry: VueAdapterRegistry = defaultAdapterRegistry,
): string[] {
  ensureDefaultAdapters(adapterRegistry);
  return adapterRegistry.listPrefixes();
}

export function isAdapterRegistered(
  adapterHintOrPrefix: string,
  adapterRegistry: VueAdapterRegistry = defaultAdapterRegistry,
): boolean {
  ensureDefaultAdapters(adapterRegistry);
  const normalized = adapterHintOrPrefix.trim();
  if (!normalized) return false;
  if (normalized.endsWith('.')) return adapterRegistry.hasPrefix(normalized);
  return Boolean(adapterRegistry.resolve(normalized));
}

export function RenderPageVue(options: RenderPageVueOptions): RenderPageVueResult {
  const adapterRegistry = options.adapterRegistry ?? getDefaultAdapterRegistry();
  ensureDefaultAdapters(adapterRegistry);
  const runtime: Runtime = {
    options,
    adapterRegistry,
    i18n: options.i18n ?? createFallbackI18nProvider(),
    data: deepClone(options.data),
    context: deepClone(options.context),
    html: '',
    componentMap: new Map(options.uiSchema.components.map((component) => [component.id, component])),
    target: resolveTarget(options.target),
  };
  runtime.html = renderRuntime(runtime);

  const response: RenderPageVueResult = {
    html: runtime.html,
    data: runtime.data,
    context: runtime.context,
    dispatchEvent: (input) => {
      const component = runtime.componentMap.get(input.componentId);
      if (!component) return;
      if (input.event === 'onChange') {
        const bindingPath = input.bindingPath ?? component.bindings?.data?.value ?? 'data.value';
        const parsed = parseBindingPath(bindingPath, 'data');
        const value = input.value ?? null;
        if (parsed) {
          if (parsed.target === 'data') runtime.data = setPath(runtime.data, parsed.path, value);
          else runtime.context = setPath(runtime.context as unknown as Record<string, JSONValue>, parsed.path, value) as unknown as ExecutionContext;
        }
        runtime.options.onChange?.(bindingPath, value, component.id);
        runtime.options.onDataChange?.(runtime.data);
        runtime.options.onContextChange?.(runtime.context);
        runtime.options.onAdapterEvent?.('onChange', { componentId: component.id, value, bindingPath }, component);
      } else {
        runtime.options.onAdapterEvent?.(input.event, { componentId: component.id }, component);
      }
      const actions = component.events?.[input.event];
      if (actions && actions.length > 0) runtime.options.onEvent?.(input.event, actions, component);
      runtime.html = renderRuntime(runtime);
      response.html = runtime.html;
      response.data = runtime.data;
      response.context = runtime.context;
    },
  };
  return response;
}

export function renderVue(options: VueRenderOptions): string {
  const result = RenderPageVue({
    uiSchema: options.uiSchema,
    data: options.data ?? {},
    context: options.context ?? defaultContext(),
    i18n: options.i18n,
    target: options.target,
  });
  return result.html;
}

function renderRuntime(runtime: Runtime): string {
  const renderComponent = (componentId: string, override?: Pick<UIGridItem, 'props' | 'bindings' | 'rules'>): string => {
    const source = runtime.componentMap.get(componentId);
    if (!source) return `<div data-missing-component="true">Missing component: ${escapeHtml(componentId)}</div>`;
    const component = mergeComponent(source, override);
    assertAccessibility(component);
    const applied = applySetValueRule(component, runtime.data, runtime.context);
    runtime.data = applied.data;
    runtime.context = applied.context;
    const ruleState = resolveRuleState(component, runtime.context, runtime.data);
    if (!ruleState.visible) return '';
    const adapter = runtime.adapterRegistry.resolve(component.adapterHint);
    if (!adapter) return `<div data-unsupported="true">Unsupported adapter: ${escapeHtml(component.adapterHint)}</div>`;
    const bindings = resolveBindings(component, runtime.data, runtime.context);
    const html = adapter(component, {
      data: runtime.data,
      context: runtime.context,
      i18n: runtime.i18n,
      bindings,
      ruleState,
      events: {
        onChangeAttrs: (bindingPath) => eventAttrs('onChange', component.id, bindingPath ?? component.bindings?.data?.value),
        onClickAttrs: () => eventAttrs('onClick', component.id),
        onSubmitAttrs: () => eventAttrs('onSubmit', component.id),
      },
    });
    return `<div data-rf-component-id="${escapeHtml(component.id)}">${html}</div>`;
  };

  const getBreakpoint = (): 'lg' | 'md' | 'sm' => {
    const device = runtime.context.device;
    if (device === 'mobile') return 'sm';
    if (device === 'tablet') return 'md';
    return 'lg';
  };

  const getResponsiveGridSpec = () => {
    const breakpoint = getBreakpoint();
    const grid = runtime.options.uiSchema.grid;
    const baseColumns = grid?.columns ?? 12;
    const baseRowHeight = grid?.rowHeight ?? 56;
    const baseGap = grid?.gap ?? 12;

    if (breakpoint === 'lg') {
      return { columns: baseColumns, rowHeight: baseRowHeight, gap: baseGap };
    }

    const bp = grid?.breakpoints?.[breakpoint];
    return {
      columns: bp?.columns ?? baseColumns,
      rowHeight: bp?.rowHeight ?? baseRowHeight,
      gap: bp?.gap ?? baseGap,
    };
  };

  const renderLayout = (node: LayoutNode): string => {
    // Grid v2 layout with responsive breakpoints
    if (runtime.options.uiSchema.layoutType === 'grid' && Array.isArray(runtime.options.uiSchema.items)) {
      const spec = getResponsiveGridSpec();
      return `<div data-layout="grid-v2" style="display:grid;grid-template-columns:repeat(${spec.columns},minmax(0,1fr));gap:${spec.gap}px;grid-auto-rows:${spec.rowHeight}px">${runtime.options.uiSchema.items
        .map((item) => `<div style="grid-column:${item.x + 1} / span ${item.w};grid-row:${item.y + 1} / span ${item.h}">${renderComponent(item.componentId, item)}</div>`)
        .join('')}</div>`;
    }

    const components = node.componentIds?.map((id) => renderComponent(id)).join('') ?? '';
    const children = node.children?.map((child) => renderLayout(child)).join('') ?? '';

    // Grid layout with nested grid support
    if (node.type === 'grid') {
      const gridNode = node as { columns?: number; rows?: number };
      const cols = gridNode.columns ?? 12;
      const gap = node.props?.gap ?? 12;
      return `<div data-layout="grid" style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${gap}px">${components}${children}</div>`;
    }

    // Stack layout with flexbox support
    if (node.type === 'stack') {
      const stackNode = node as { direction?: 'vertical' | 'horizontal' };
      const direction = stackNode.direction ?? 'vertical';
      const flexDirection = direction === 'horizontal' ? 'row' : 'column';
      const gap = node.props?.gap ?? 12;
      const justify = node.props?.justify ?? 'flex-start';
      const align = node.props?.align ?? 'stretch';
      const wrap = node.props?.wrap === true ? 'wrap' : 'nowrap';
      return `<div data-layout="stack" data-direction="${direction}" style="display:flex;flex-direction:${flexDirection};gap:${gap}px;justify-content:${justify};align-items:${align};flex-wrap:${wrap}">${components}${children}</div>`;
    }

    // Tabs layout
    if (node.type === 'tabs') {
      return `<div data-layout="tabs">${node.tabs.map((tab) => `<section data-tab-id="${escapeHtml(tab.id)}"><h3>${escapeHtml(tab.label)}</h3>${renderLayout(tab.child)}</section>`).join('')}</div>`;
    }

    // Section layout with optional flexbox
    const sectionProps = node.props ?? {};
    const useFlexbox = sectionProps.flexbox === true;
    const flexDirection = sectionProps.direction === 'horizontal' ? 'row' : 'column';
    const gap = sectionProps.gap ?? 12;

    if (useFlexbox) {
      return `<section data-layout="section" data-flexbox="true" style="display:flex;flex-direction:${flexDirection};gap:${gap}px">${node.title ? `<h2>${escapeHtml(node.title)}</h2>` : ''}${components}${children}</section>`;
    }

    return `<section data-layout="section">${node.title ? `<h2>${escapeHtml(node.title)}</h2>` : ''}${components}${children}</section>`;
  };

  const html = `<div data-ui-page="${escapeHtml(runtime.options.uiSchema.pageId)}" dir="${runtime.i18n.direction}">${renderLayout(runtime.options.uiSchema.layout)}</div>`;
  if (runtime.target) runtime.target.innerHTML = html;
  return html;
}

// =============================================
// Layout Helpers - Exported for Custom Layouts
// =============================================

export function renderRowLayout(componentIds: string[], columns: number, gap = 12): string {
  return `<div data-layout="row" style="display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:${gap}px">${componentIds.map((id) => `<div data-slot="${escapeHtml(id)}"></div>`).join('')}</div>`;
}

export function renderColumnLayout(span: number): string {
  return `<div data-layout="column" style="grid-column:span ${span}"></div>`;
}

export function renderFlexboxLayout(direction: 'row' | 'column' = 'row', options?: { gap?: number; justify?: string; align?: string; wrap?: boolean }): string {
  const gap = options?.gap ?? 12;
  const justify = options?.justify ?? 'flex-start';
  const align = options?.align ?? 'stretch';
  const wrap = options?.wrap === true ? 'wrap' : 'nowrap';
  return `<div data-layout="flexbox" style="display:flex;flex-direction:${direction};gap:${gap}px;justify-content:${justify};align-items:${align};flex-wrap:${wrap}"></div>`;
}

export function renderNestedGridLayout(columns: number, gap = 12): string {
  return `<div data-layout="nested-grid" style="display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:${gap}px"></div>`;
}

function ensureDefaultAdapters(adapterRegistry: VueAdapterRegistry): void {
  if (bootstrapped.has(adapterRegistry)) return;
  bootstrapped.add(adapterRegistry);

  registerAdapter('platform.', (component, ctx) => {
    const aria = ctx.i18n.t(component.accessibility.ariaLabelKey);
    if (component.adapterHint === 'platform.textField') {
      const label = component.i18n?.labelKey ? ctx.i18n.t(component.i18n.labelKey) : String(component.props?.label ?? 'Text field');
      const value = ctx.bindings.data.value?.value ?? component.props?.value ?? '';
      return `<label><span>${escapeHtml(label)}</span><input ${ctx.events.onChangeAttrs()} aria-label="${escapeHtml(aria)}" value="${escapeHtml(String(value ?? ''))}" ${ctx.ruleState.disabled ? 'disabled' : ''} /></label>`;
    }
    if (component.adapterHint === 'platform.button') {
      const label = component.i18n?.labelKey ? ctx.i18n.t(component.i18n.labelKey) : String(component.props?.label ?? 'Button');
      return `<button ${ctx.events.onClickAttrs()} aria-label="${escapeHtml(aria)}" ${ctx.ruleState.disabled ? 'disabled' : ''}>${escapeHtml(label)}</button>`;
    }
    if (component.adapterHint === 'platform.select') {
      const options = Array.isArray(component.props?.options) ? component.props?.options : [];
      return `<select ${ctx.events.onChangeAttrs()} aria-label="${escapeHtml(aria)}" ${ctx.ruleState.disabled ? 'disabled' : ''}>${options
        .map((opt) => (typeof opt === 'object' && opt && 'value' in opt ? `<option value="${escapeHtml(String((opt as { value: unknown }).value ?? ''))}">${escapeHtml(String((opt as { label?: unknown }).label ?? (opt as { value: unknown }).value ?? ''))}</option>` : ''))
        .join('')}</select>`;
    }
    if (component.adapterHint === 'platform.section') {
      const title = component.i18n?.labelKey ? ctx.i18n.t(component.i18n.labelKey) : String(component.props?.label ?? 'Section');
      return `<section aria-label="${escapeHtml(aria)}"><h3>${escapeHtml(title)}</h3></section>`;
    }
    if (component.adapterHint === 'platform.table') {
      const cols = Array.isArray(component.props?.columns) ? component.props?.columns : [];
      const rows = Array.isArray(component.props?.rows) ? component.props?.rows : [];
      const fields = cols.map((col) => (typeof col === 'object' && col && 'field' in col ? String((col as { field: unknown }).field ?? '') : '')).filter(Boolean);
      return `<table aria-label="${escapeHtml(aria)}"><thead><tr>${fields.map((field) => `<th>${escapeHtml(field)}</th>`).join('')}</tr></thead><tbody>${rows
        .map((row) => `<tr>${fields.map((field) => `<td>${escapeHtml(String((row as Record<string, unknown>)[field] ?? ''))}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`;
    }
    return `<div data-unsupported="true">Unsupported platform component: ${escapeHtml(component.adapterHint)}</div>`;
  }, adapterRegistry);

  registerAdapter('material.', (component, ctx) => adapterRegistry.resolve('platform.')!({ ...component, adapterHint: component.adapterHint === 'material.button' ? 'platform.button' : 'platform.textField' }, ctx), adapterRegistry);
  registerAdapter('aggrid.', (component, ctx) => adapterRegistry.resolve('platform.')!({ ...component, adapterHint: 'platform.table' }, ctx), adapterRegistry);
}

function resolveRuleState(component: UIComponent, context: ExecutionContext, data: Record<string, JSONValue>) {
  const rules = component.rules;
  if (!rules) return { visible: true, disabled: false, required: false };
  return {
    visible: rules.visibleWhen ? safeEvaluate(rules.visibleWhen, context, data) : true,
    disabled: rules.disabledWhen ? safeEvaluate(rules.disabledWhen, context, data) : false,
    required: rules.requiredWhen ? safeEvaluate(rules.requiredWhen, context, data) : false,
  };
}

function applySetValueRule(component: UIComponent, data: Record<string, JSONValue>, context: ExecutionContext) {
  const rule = component.rules?.setValueWhen;
  if (!rule || !safeEvaluate(rule.when, context, data)) return { data, context };
  const parsed = parseBindingPath(rule.path ?? component.bindings?.data?.value ?? `data.${component.id}`, 'data');
  if (!parsed) return { data, context };
  if (parsed.target === 'context') return { data, context: setPath(context as unknown as Record<string, JSONValue>, parsed.path, rule.value) as unknown as ExecutionContext };
  return { data: setPath(data, parsed.path, rule.value), context };
}

function safeEvaluate(condition: RuleCondition, context: ExecutionContext, data: Record<string, JSONValue>) {
  try {
    return evaluateCondition(condition, context, data);
  } catch {
    return false;
  }
}

function resolveBindings(component: UIComponent, data: Record<string, JSONValue>, context: ExecutionContext): BindingGroupValues {
  const out: BindingGroupValues = { data: {}, context: {}, computed: {} };
  const bindings = component.bindings;
  if (!bindings) return out;
  readBindingGroup(bindings.data, 'data', data, context, out.data);
  readBindingGroup(bindings.context, 'context', data, context, out.context);
  readBindingGroup(bindings.computed, 'data', data, context, out.computed, 'computed');
  return out;
}

function readBindingGroup(
  source: Record<string, string> | undefined,
  defaultTarget: 'data' | 'context',
  data: Record<string, JSONValue>,
  context: ExecutionContext,
  out: Record<string, BindingValue>,
  targetOverride?: 'computed',
) {
  if (!source) return;
  for (const [key, raw] of Object.entries(source)) {
    const parsed = parseBindingPath(raw, defaultTarget);
    if (!parsed) continue;
    const target = parsed.target === 'context' ? (context as unknown as Record<string, JSONValue>) : data;
    out[key] = {
      target: targetOverride ?? parsed.target,
      path: `${parsed.target}.${parsed.path}`,
      value: getPath(target, parsed.path),
    };
  }
}

function mergeComponent(base: UIComponent, override?: Pick<UIGridItem, 'props' | 'bindings' | 'rules'>): UIComponent {
  if (!override) return base;
  return {
    ...base,
    props: { ...(base.props ?? {}), ...(override.props ?? {}) },
    bindings: mergeBindings(base.bindings, override.bindings),
    rules: { ...(base.rules ?? {}), ...(override.rules ?? {}) },
  };
}

function mergeBindings(base?: BindingSpec, override?: BindingSpec): BindingSpec | undefined {
  if (!base && !override) return undefined;
  return {
    ...(base ?? {}),
    ...(override ?? {}),
    data: { ...(base?.data ?? {}), ...(override?.data ?? {}) },
    context: { ...(base?.context ?? {}), ...(override?.context ?? {}) },
    computed: { ...(base?.computed ?? {}), ...(override?.computed ?? {}) },
  };
}

function parseBindingPath(bindingPath: string, defaultTarget: 'data' | 'context'): { target: 'data' | 'context'; path: string } | null {
  const raw = bindingPath.trim();
  if (!raw) return null;
  if (raw.startsWith('data.')) return { target: 'data', path: raw.slice(5) };
  if (raw.startsWith('context.')) return { target: 'context', path: raw.slice(8) };
  return { target: defaultTarget, path: raw };
}

function getPath(obj: Record<string, JSONValue>, path: string): JSONValue | undefined {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let current: JSONValue | undefined = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) current = current[Number(part)];
    else if (typeof current === 'object' && !Array.isArray(current)) current = (current as Record<string, JSONValue>)[part];
    else return undefined;
  }
  return current;
}

function setPath(obj: Record<string, JSONValue>, path: string, value: JSONValue): Record<string, JSONValue> {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  const root = deepClone(obj) as Record<string, JSONValue>;
  let current: Record<string, JSONValue> = root;
  for (let index = 0; index < parts.length; index += 1) {
    const key = parts[index];
    if (!key) continue;
    if (index === parts.length - 1) current[key] = value;
    else {
      const next = current[key];
      if (!next || typeof next !== 'object' || Array.isArray(next)) current[key] = {};
      current = current[key] as Record<string, JSONValue>;
    }
  }
  return root;
}

function eventAttrs(event: UIEventName, componentId: string, bindingPath?: string): string {
  return `data-rf-event="${event}" data-rf-component-id="${escapeHtml(componentId)}"${bindingPath ? ` data-rf-binding-path="${escapeHtml(bindingPath)}"` : ''}`;
}

function resolveTarget(target: HTMLElement | string | undefined): HTMLElement | null {
  if (!target) return null;
  if (typeof target === 'string') {
    if (typeof document === 'undefined') return null;
    return document.querySelector(target);
  }
  return target;
}

function assertAccessibility(component: UIComponent): void {
  const meta = component.accessibility;
  if (!meta || !meta.ariaLabelKey?.trim()) throw new Error(`ariaLabelKey is required for component ${component.id}`);
  if (meta.keyboardNav !== true) throw new Error(`keyboardNav must be true for component ${component.id}`);
  if (!Number.isInteger(meta.focusOrder) || (meta.focusOrder ?? 0) < 1) throw new Error(`focusOrder must be an integer >= 1 for component ${component.id}`);
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function defaultContext(): ExecutionContext {
  return {
    tenantId: 'tenant-1',
    userId: 'vue-renderer',
    role: 'Author',
    roles: ['Author'],
    country: 'US',
    locale: 'en-US',
    timezone: 'UTC',
    device: 'desktop',
    permissions: ['read'],
    featureFlags: {},
  };
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
