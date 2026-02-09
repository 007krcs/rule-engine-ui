import React from 'react';
import type { I18nProvider } from '@platform/i18n';
import { createFallbackI18nProvider } from '@platform/i18n';
import type { ExecutionContext, JSONValue, UIComponent, UIEventAction, UISchema } from '@platform/schema';

export type UIEventName = 'onChange' | 'onClick' | 'onSubmit';

export interface RendererProps {
  uiSchema: UISchema;
  data: Record<string, JSONValue>;
  context: ExecutionContext;
  i18n?: I18nProvider;
  onEvent?: (event: UIEventName, actions: UIEventAction[], component: UIComponent) => void;
  componentWrapper?: (component: UIComponent, rendered: React.ReactElement) => React.ReactElement;
}

export interface AdapterContext {
  data: Record<string, JSONValue>;
  context: ExecutionContext;
  i18n: I18nProvider;
  events: {
    onChange?: () => void;
    onClick?: () => void;
    onSubmit?: () => void;
  };
}

export type AdapterRenderFn = (component: UIComponent, ctx: AdapterContext) => React.ReactElement;

const registry: Array<{ prefix: string; render: AdapterRenderFn }> = [];

export function registerAdapter(prefix: string, render: AdapterRenderFn): void {
  registry.push({ prefix, render });
  registry.sort((a, b) => b.prefix.length - a.prefix.length);
}

export function RenderPage(props: RendererProps): React.ReactElement {
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

    const events = buildEvents(component, props.onEvent);
    const rendered = (
      <div data-component-id={component.id}>
        {adapter(component, { data: props.data, context: props.context, events, i18n })}
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
              gridTemplateColumns: typeof node.columns === 'number' && node.columns > 0 ? `repeat(${node.columns}, minmax(0, 1fr))` : undefined,
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
          <div
            data-layout="stack"
            style={{ display: 'flex', flexDirection: node.direction === 'horizontal' ? 'row' : 'column', gap: 12 }}
          >
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
      default:
        {
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
  onEvent?: (event: UIEventName, actions: UIEventAction[], component: UIComponent) => void,
): AdapterContext['events'] {
  if (!onEvent || !component.events) return {};
  return {
    onChange: component.events.onChange
      ? () => onEvent('onChange', component.events?.onChange ?? [], component)
      : undefined,
    onClick: component.events.onClick
      ? () => onEvent('onClick', component.events?.onClick ?? [], component)
      : undefined,
    onSubmit: component.events.onSubmit
      ? () => onEvent('onSubmit', component.events?.onSubmit ?? [], component)
      : undefined,
  };
}
