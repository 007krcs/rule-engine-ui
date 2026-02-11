import { createRoot, type Root } from 'react-dom/client';
import type { ExecutionContext, JSONValue, UISchema } from '@platform/schema';
import type { I18nProvider } from '@platform/i18n';
import { createFallbackI18nProvider } from '@platform/i18n';
import { RenderPage } from '@platform/react-renderer';

type RuleflowElementState = {
  uiSchema?: UISchema;
  data?: Record<string, JSONValue>;
  context?: ExecutionContext;
  i18n?: I18nProvider;
};

export type RuleflowElementOptions = {
  tagName?: string;
  defaultData?: Record<string, JSONValue>;
  defaultContext?: ExecutionContext;
};

const DEFAULT_TAG = 'ruleflow-renderer';

export function defineRuleflowRendererElement(options?: RuleflowElementOptions): void {
  const tagName = options?.tagName ?? DEFAULT_TAG;
  if (customElements.get(tagName)) return;

  class RuleflowRendererElement extends HTMLElement {
    private root: Root | null = null;
    private state: RuleflowElementState = {};

    static get observedAttributes() {
      return ['ui-schema', 'data', 'context'];
    }

    connectedCallback() {
      if (!this.shadowRoot) {
        this.attachShadow({ mode: 'open' });
      }
      if (!this.root && this.shadowRoot) {
        this.root = createRoot(this.shadowRoot);
      }
      this.syncFromAttributes();
      this.render();
    }

    disconnectedCallback() {
      this.root?.unmount();
      this.root = null;
    }

    attributeChangedCallback() {
      this.syncFromAttributes();
      this.render();
    }

    set uiSchema(value: UISchema | undefined) {
      this.state.uiSchema = value;
      this.render();
    }

    get uiSchema() {
      return this.state.uiSchema;
    }

    set data(value: Record<string, JSONValue> | undefined) {
      this.state.data = value;
      this.render();
    }

    get data() {
      return this.state.data;
    }

    set context(value: ExecutionContext | undefined) {
      this.state.context = value;
      this.render();
    }

    get context() {
      return this.state.context;
    }

    set i18n(value: I18nProvider | undefined) {
      this.state.i18n = value;
      this.render();
    }

    get i18n() {
      return this.state.i18n;
    }

    private syncFromAttributes() {
      this.state.uiSchema = parseJsonAttribute<UISchema>(this.getAttribute('ui-schema')) ?? this.state.uiSchema;
      this.state.data = parseJsonAttribute<Record<string, JSONValue>>(this.getAttribute('data')) ?? this.state.data;
      this.state.context = parseJsonAttribute<ExecutionContext>(this.getAttribute('context')) ?? this.state.context;
    }

    private render() {
      if (!this.root) return;
      if (!this.state.uiSchema || !this.state.data || !this.state.context) {
        this.root.render(<div data-ruleflow-pending>Waiting for uiSchema/data/context.</div>);
        return;
      }
      const i18n = this.state.i18n ?? createFallbackI18nProvider();
      this.root.render(
        <RenderPage
          uiSchema={this.state.uiSchema}
          data={this.state.data}
          context={this.state.context}
          i18n={i18n}
        />,
      );
    }
  }

  customElements.define(tagName, RuleflowRendererElement);
}

function parseJsonAttribute<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}
