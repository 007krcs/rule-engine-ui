import type { ExecutionContext, JSONValue, LayoutNode, UIComponent, UISchema } from '@platform/schema';
import type { I18nProvider } from '@platform/i18n';
import { createFallbackI18nProvider } from '@platform/i18n';

export interface VueRenderOptions {
  uiSchema: UISchema;
  data?: Record<string, JSONValue>;
  context?: ExecutionContext;
  i18n?: I18nProvider;
  target?: HTMLElement | string;
}

export function renderVue(options: VueRenderOptions): string {
  const i18n = options.i18n ?? createFallbackI18nProvider();
  const data = options.data ?? {};
  const componentMap = new Map(options.uiSchema.components.map((component) => [component.id, component]));

  const html = `<div data-ui-page="${escapeHtml(options.uiSchema.pageId)}" dir="${i18n.direction}">
    ${renderLayout(options.uiSchema.layout, componentMap, { i18n, data })}
  </div>`;

  if (options.target) {
    const target = resolveTarget(options.target);
    if (target) {
      target.innerHTML = html;
    }
  }

  return html;
}

function renderLayout(
  node: LayoutNode,
  components: Map<string, UIComponent>,
  ctx: { i18n: I18nProvider; data: Record<string, JSONValue> },
): string {
  switch (node.type) {
    case 'grid':
      return wrapLayout(
        'grid',
        `display:grid;gap:12px;${node.columns ? `grid-template-columns:repeat(${node.columns},1fr);` : ''}`,
        node.componentIds?.map((id) => renderComponent(id, components, ctx)).join('') ?? '',
        node.children?.map((child) => renderLayout(child, components, ctx)).join('') ?? '',
      );
    case 'stack':
      return wrapLayout(
        'stack',
        `display:flex;gap:12px;flex-direction:${node.direction === 'horizontal' ? 'row' : 'column'};`,
        node.componentIds?.map((id) => renderComponent(id, components, ctx)).join('') ?? '',
        node.children?.map((child) => renderLayout(child, components, ctx)).join('') ?? '',
      );
    case 'tabs':
      return `<div data-layout="tabs">${node.tabs
        .map(
          (tab) => `<section><h3>${escapeHtml(tab.label)}</h3>${renderLayout(tab.child, components, ctx)}</section>`,
        )
        .join('')}</div>`;
    case 'section':
      return `<section data-layout="section">
        ${node.title ? `<h2>${escapeHtml(node.title)}</h2>` : ''}
        ${node.componentIds?.map((id) => renderComponent(id, components, ctx)).join('') ?? ''}
        ${node.children?.map((child) => renderLayout(child, components, ctx)).join('') ?? ''}
      </section>`;
  }

  return assertNever(node);
}

function wrapLayout(type: string, style: string, components: string, children: string): string {
  return `<div data-layout="${type}" style="${style}">${components}${children}</div>`;
}

function renderComponent(
  componentId: string,
  components: Map<string, UIComponent>,
  ctx: { i18n: I18nProvider; data: Record<string, JSONValue> },
): string {
  const component = components.get(componentId);
  if (!component) {
    return `<div data-missing-component="true">Missing component: ${escapeHtml(componentId)}</div>`;
  }

  assertAccessibility(component);
  const ariaLabel = ctx.i18n.t(component.accessibility.ariaLabelKey);

  switch (component.adapterHint) {
    case 'material.input': {
      const label = component.i18n?.labelKey
        ? ctx.i18n.t(component.i18n.labelKey)
        : String(component.props?.label ?? 'Input');
      const placeholder = component.i18n?.placeholderKey
        ? ctx.i18n.t(component.i18n.placeholderKey)
        : String(component.props?.placeholder ?? '');
      return `<label style="display:flex;flex-direction:column;gap:4px">
        <span>${escapeHtml(label)}</span>
        <input aria-label="${escapeHtml(ariaLabel)}" placeholder="${escapeHtml(placeholder)}" />
      </label>`;
    }
    case 'material.button': {
      const label = component.i18n?.labelKey
        ? ctx.i18n.t(component.i18n.labelKey)
        : String(component.props?.label ?? 'Button');
      return `<button aria-label="${escapeHtml(ariaLabel)}">${escapeHtml(label)}</button>`;
    }
    case 'aggrid.table': {
      const columns = parseColumns(component);
      const rows = parseRows(component);
      const header = columns
        .map((col) => `<th style="text-align:left;border-bottom:1px solid #ccc">${escapeHtml(col)}</th>`)
        .join('');
      const body =
        rows.length === 0
          ? `<tr><td colspan="${Math.max(columns.length, 1)}" style="padding:8px;color:#666">No rows</td></tr>`
          : rows
              .map(
                (row) =>
                  `<tr>${columns
                    .map((col) => `<td style="padding:6px;border-bottom:1px solid #eee">${escapeHtml(row[col])}</td>`)
                    .join('')}</tr>`,
              )
              .join('');
      return `<div aria-label="${escapeHtml(ariaLabel)}">
        <table style="width:100%;border-collapse:collapse"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
      </div>`;
    }
    case 'company.currencyInput': {
      const currency = typeof component.props?.currency === 'string' ? component.props.currency : 'USD';
      const labelText = component.i18n?.labelKey
        ? ctx.i18n.t(component.i18n.labelKey)
        : String(component.props?.label ?? 'Amount');
      return `<label style="display:flex;flex-direction:column;gap:4px">
        <span>${escapeHtml(labelText)} (${escapeHtml(currency)})</span>
        <input aria-label="${escapeHtml(ariaLabel)}" type="number" placeholder="0.00" />
      </label>`;
    }
    case 'company.riskBadge': {
      const level = typeof component.props?.level === 'string' ? component.props.level : 'Low';
      const labelText = component.i18n?.labelKey
        ? ctx.i18n.t(component.i18n.labelKey)
        : String(component.props?.label ?? 'Risk');
      return `<div aria-label="${escapeHtml(ariaLabel)}" style="display:flex;align-items:center;justify-content:space-between;gap:12px">
        <span>${escapeHtml(labelText)}</span>
        <span style="padding:4px 10px;border-radius:999px;border:1px solid #ddd">${escapeHtml(level)}</span>
      </div>`;
    }
    case 'highcharts.chart':
    case 'd3.chart':
    case 'company.card': {
      const label = component.i18n?.labelKey
        ? ctx.i18n.t(component.i18n.labelKey)
        : String(component.props?.label ?? component.id);
      return `<div aria-label="${escapeHtml(ariaLabel)}" style="padding:12px;border:1px solid #ddd;border-radius:8px">
        <div style="font-size:12px;color:#666">${escapeHtml(component.adapterHint)}</div>
        <div style="font-size:14px;font-weight:600">${escapeHtml(label)}</div>
      </div>`;
    }
    default:
      return `<div data-unsupported="true">Unsupported adapter: ${escapeHtml(component.adapterHint)}</div>`;
  }
}

function parseColumns(component: UIComponent): string[] {
  const columnsSource = component.props?.columns;
  if (!Array.isArray(columnsSource)) return [];
  return columnsSource
    .map((item) => (isPlainRecord(item) && typeof item.field === 'string' ? item.field : null))
    .filter((value): value is string => value !== null);
}

function parseRows(component: UIComponent): Array<Record<string, string>> {
  const rowsSource = component.props?.rows;
  if (!Array.isArray(rowsSource)) return [];

  const out: Array<Record<string, string>> = [];
  for (const row of rowsSource) {
    if (!isPlainRecord(row)) continue;
    const record = row as Record<string, JSONValue>;
    out.push(
      Object.fromEntries(Object.entries(record).map(([key, value]) => [key, value === undefined ? '' : String(value)])),
    );
  }
  return out;
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

function resolveTarget(target: HTMLElement | string): HTMLElement | null {
  if (typeof target === 'string') {
    if (typeof document === 'undefined') return null;
    return document.querySelector(target);
  }
  return target;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertNever(value: never): never {
  const nodeType =
    typeof value === 'object' && value !== null && 'type' in value
      ? (value as { type?: unknown }).type
      : undefined;
  throw new Error(`Unsupported layout node type: ${String(nodeType ?? value)}`);
}
