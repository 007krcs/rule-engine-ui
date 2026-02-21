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
import { createMemoizedConditionEvaluator } from '@platform/rules-engine';

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
  onRenderMetrics?: (input: { durationMs: number; componentCount: number }) => void;
}

export interface RenderPageVueResult {
  html: string;
  data: Record<string, JSONValue>;
  context: ExecutionContext;
  dispatcher: RendererEventDispatcher;
  dispatchEvent: (input: {
    event: UIEventName;
    componentId: string;
    value?: JSONValue;
    bindingPath?: string;
  }) => void;
}

export interface RendererEventDispatcher {
  dispatch: (input: {
    event: UIEventName;
    componentId: string;
    value?: JSONValue;
    bindingPath?: string;
  }) => void;
  change: (componentId: string, value: JSONValue, bindingPath?: string) => void;
  click: (componentId: string) => void;
  submit: (componentId: string) => void;
}

export interface VueHydrationSession {
  dispose: () => void;
  rerender: () => void;
  dispatcher: RendererEventDispatcher;
}

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
  const dispatchCore = (input: {
    event: UIEventName;
    componentId: string;
    value?: JSONValue;
    bindingPath?: string;
  }) => {
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
  };
  const dispatcher = createVueEventDispatcher(dispatchCore);

  const response: RenderPageVueResult = {
    html: runtime.html,
    data: runtime.data,
    context: runtime.context,
    dispatcher,
    dispatchEvent: dispatchCore,
  };
  return response;
}

export interface VueRenderOptions {
  uiSchema: UISchema;
  data?: Record<string, JSONValue>;
  context?: ExecutionContext;
  i18n?: I18nProvider;
  target?: HTMLElement | string;
  onRenderMetrics?: (input: { durationMs: number; componentCount: number }) => void;
}

export function renderVue(options: VueRenderOptions): string {
  const result = RenderPageVue({
    uiSchema: options.uiSchema,
    data: options.data ?? {},
    context: options.context ?? defaultContext(),
    i18n: options.i18n,
    target: options.target,
    onRenderMetrics: options.onRenderMetrics,
  });
  return result.html;
}

function renderRuntime(runtime: Runtime): string {
  const started = Date.now();
  const memoizedEvaluate = createMemoizedConditionEvaluator({ cacheSize: 512 });
  const renderComponent = (componentId: string, override?: Pick<UIGridItem, 'props' | 'bindings' | 'rules'>): string => {
    const source = runtime.componentMap.get(componentId);
    if (!source) return `<div data-missing-component="true">Missing component: ${escapeHtml(componentId)}</div>`;
    const component = mergeComponent(source, override);
    assertAccessibility(component);
    const applied = applySetValueRule(component, runtime.data, runtime.context, memoizedEvaluate);
    runtime.data = applied.data;
    runtime.context = applied.context;
    const ruleState = resolveRuleState(component, runtime.context, runtime.data, memoizedEvaluate);
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

  const renderLayout = (node: LayoutNode): string => {
    if (runtime.options.uiSchema.layoutType === 'grid' && Array.isArray(runtime.options.uiSchema.items)) {
      const cols = runtime.options.uiSchema.grid?.columns ?? 12;
      const gap = runtime.options.uiSchema.grid?.gap ?? 12;
      const rowHeight = runtime.options.uiSchema.grid?.rowHeight ?? 56;
      return `<div data-layout="grid-v2" style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${gap}px;grid-auto-rows:${rowHeight}px">${runtime.options.uiSchema.items
        .map((item) => `<div style="grid-column:${item.x + 1} / span ${item.w};grid-row:${item.y + 1} / span ${item.h}">${renderComponent(item.componentId, item)}</div>`)
        .join('')}</div>`;
    }
    const components = node.componentIds?.map((id) => renderComponent(id)).join('') ?? '';
    const children = node.children?.map((child) => renderLayout(child)).join('') ?? '';
    if (node.type === 'grid') return `<div data-layout="grid" style="${buildLayoutStyle(node, runtime.i18n.direction)}">${components}${children}</div>`;
    if (node.type === 'stack') return `<div data-layout="stack" style="${buildLayoutStyle(node, runtime.i18n.direction)}">${components}${children}</div>`;
    if (node.type === 'tabs') return `<div data-layout="tabs">${node.tabs.map((tab) => `<section><h3>${escapeHtml(tab.label)}</h3>${renderLayout(tab.child)}</section>`).join('')}</div>`;
    return `<section data-layout="section" style="${buildLayoutStyle(node, runtime.i18n.direction)}">${node.title ? `<h2>${escapeHtml(node.title)}</h2>` : ''}${components}${children}</section>`;
  };

  const themeStyle = buildLocaleThemeStyle(runtime.i18n.themeTokens);
  const html = `<div data-ui-page="${escapeHtml(runtime.options.uiSchema.pageId)}" dir="${runtime.i18n.direction}"${themeStyle ? ` style="${themeStyle}"` : ''}>${renderLayout(runtime.options.uiSchema.layout)}</div>`;
  if (runtime.target) runtime.target.innerHTML = html;
  runtime.options.onRenderMetrics?.({
    durationMs: Date.now() - started,
    componentCount: runtime.options.uiSchema.components.length,
  });
  return html;
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

function resolveRuleState(
  component: UIComponent,
  context: ExecutionContext,
  data: Record<string, JSONValue>,
  evaluate: (condition: RuleCondition, context: ExecutionContext, data: Record<string, JSONValue>) => boolean,
) {
  const rules = component.rules;
  if (!rules) return { visible: true, disabled: false, required: false };
  return {
    visible: rules.visibleWhen ? safeEvaluate(rules.visibleWhen, context, data, evaluate) : true,
    disabled: rules.disabledWhen ? safeEvaluate(rules.disabledWhen, context, data, evaluate) : false,
    required: rules.requiredWhen ? safeEvaluate(rules.requiredWhen, context, data, evaluate) : false,
  };
}

function applySetValueRule(
  component: UIComponent,
  data: Record<string, JSONValue>,
  context: ExecutionContext,
  evaluate: (condition: RuleCondition, context: ExecutionContext, data: Record<string, JSONValue>) => boolean,
) {
  const rule = component.rules?.setValueWhen;
  if (!rule || !safeEvaluate(rule.when, context, data, evaluate)) return { data, context };
  const parsed = parseBindingPath(rule.path ?? component.bindings?.data?.value ?? `data.${component.id}`, 'data');
  if (!parsed) return { data, context };
  if (parsed.target === 'context') return { data, context: setPath(context as unknown as Record<string, JSONValue>, parsed.path, rule.value) as unknown as ExecutionContext };
  return { data: setPath(data, parsed.path, rule.value), context };
}

function safeEvaluate(
  condition: RuleCondition,
  context: ExecutionContext,
  data: Record<string, JSONValue>,
  evaluate: (condition: RuleCondition, context: ExecutionContext, data: Record<string, JSONValue>) => boolean,
) {
  try {
    return evaluate(condition, context, data);
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

export function createVueEventDispatcher(
  dispatchEvent: (input: {
    event: UIEventName;
    componentId: string;
    value?: JSONValue;
    bindingPath?: string;
  }) => void,
): RendererEventDispatcher {
  return {
    dispatch: dispatchEvent,
    change: (componentId, value, bindingPath) =>
      dispatchEvent({ event: 'onChange', componentId, value, bindingPath }),
    click: (componentId) => dispatchEvent({ event: 'onClick', componentId }),
    submit: (componentId) => dispatchEvent({ event: 'onSubmit', componentId }),
  };
}

export function bindVueDomListeners(options: {
  target: HTMLElement;
  dispatcher: RendererEventDispatcher;
  rerender: () => void;
}): () => void {
  const handler = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const source = target.closest('[data-rf-event]');
    if (!source) return;
    const eventName = source.getAttribute('data-rf-event') as UIEventName | null;
    const componentId = source.getAttribute('data-rf-component-id');
    if (!eventName || !componentId) return;
    if (eventName === 'onSubmit') event.preventDefault();
    if (eventName === 'onChange') {
      const bindingPath = source.getAttribute('data-rf-binding-path') ?? undefined;
      const value = extractDomValue(target);
      options.dispatcher.change(componentId, value, bindingPath);
    } else if (eventName === 'onClick') {
      options.dispatcher.click(componentId);
    } else if (eventName === 'onSubmit') {
      options.dispatcher.submit(componentId);
    }
    options.rerender();
  };

  options.target.addEventListener('change', handler);
  options.target.addEventListener('click', handler);
  options.target.addEventListener('submit', handler);
  return () => {
    options.target.removeEventListener('change', handler);
    options.target.removeEventListener('click', handler);
    options.target.removeEventListener('submit', handler);
  };
}

export function hydrateVue(options: {
  result: RenderPageVueResult;
  target: HTMLElement | string;
}): VueHydrationSession {
  const target = resolveTarget(options.target);
  if (!target) throw new Error('Hydration target could not be resolved.');
  target.innerHTML = options.result.html;
  const rerender = () => {
    target.innerHTML = options.result.html;
  };
  const dispose = bindVueDomListeners({
    target,
    dispatcher: options.result.dispatcher,
    rerender,
  });
  return { dispose, rerender, dispatcher: options.result.dispatcher };
}

function extractDomValue(target: Element): JSONValue {
  if (target instanceof HTMLInputElement) {
    if (target.type === 'checkbox') return target.checked;
    if (target.type === 'number') {
      const parsed = Number(target.value);
      return Number.isFinite(parsed) ? parsed : target.value;
    }
    return target.value;
  }
  if (target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
    return target.value;
  }
  return null;
}

function buildLayoutStyle(node: LayoutNode, localeDirection: 'ltr' | 'rtl' = 'ltr'): string {
  const props =
    node.props && typeof node.props === 'object' && !Array.isArray(node.props)
      ? (node.props as Record<string, JSONValue>)
      : {};
  const tokens: string[] = [];
  const layoutMode = typeof props.layoutMode === 'string' ? props.layoutMode : undefined;
  const gap = asNumber(props.gap);
  const direction = typeof props.direction === 'string' ? props.direction : undefined;
  const wrap = typeof props.wrap === 'boolean' ? props.wrap : undefined;

  if (node.type === 'stack' || layoutMode === 'flex' || layoutMode === 'row' || layoutMode === 'column') {
    const flexDirection =
      layoutMode === 'row' || layoutMode === 'column'
        ? layoutMode
        : direction ?? 'column';
    const normalizedDirection =
      localeDirection === 'rtl' && flexDirection === 'row' ? 'row-reverse' : flexDirection;
    tokens.push('display:flex');
    tokens.push(`flex-direction:${normalizedDirection}`);
    tokens.push(`flex-wrap:${wrap ? 'wrap' : 'nowrap'}`);
  } else if (node.type === 'grid' || layoutMode === 'nested-grid') {
    tokens.push('display:grid');
    const nodeColumns = 'columns' in node && typeof node.columns === 'number' ? node.columns : undefined;
    const columns = asNumber(props.columns) ?? nodeColumns ?? 1;
    const minWidth = asNumber(props.minColumnWidth);
    if (minWidth && minWidth > 0) {
      tokens.push(`grid-template-columns:repeat(auto-fit,minmax(${minWidth}px,1fr))`);
    } else {
      tokens.push(`grid-template-columns:repeat(${Math.max(1, columns)},minmax(0,1fr))`);
    }
  }

  const responsiveRows = asNumber(props.responsiveRows);
  if (responsiveRows && responsiveRows > 0) {
    tokens.push(`grid-template-rows:repeat(${responsiveRows},minmax(0,auto))`);
  }
  if (localeDirection === 'rtl') tokens.push('direction:rtl');
  if (gap && gap >= 0) tokens.push(`gap:${gap}px`);
  return tokens.join(';');
}

function asNumber(value: JSONValue | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
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

function buildLocaleThemeStyle(tokens: Record<string, string | number>): string {
  const entries = Object.entries(tokens);
  if (entries.length === 0) return '';
  return entries
    .map(([key, value]) => `--rf-locale-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}:${escapeHtml(String(value))}`)
    .join(';');
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
