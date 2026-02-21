'use client';

import {
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  Checkbox,
  Input,
  Select,
} from '@platform/component-system';
import type {
  ComponentContract,
  ComponentPropDefinition,
  ComponentPropValue,
} from '@platform/component-contract';
import {
  getBuilderComponentCatalog,
  getBuilderComponentRegistry,
  getBuilderRenderers,
  loadBuilderPlugins,
} from '../../../lib/plugin-host';
import styles from '../../../components/studio/Studio.module.css';

interface StudioPageProps {
  params: { componentType: string };
}

type PropState = Record<string, ComponentPropValue>;

export default function ComponentStudioDetail({ params }: StudioPageProps) {
  const router = useRouter();
  const componentType = decodeURIComponent(params.componentType);
  const [catalog, setCatalog] = useState(() => getBuilderComponentCatalog());
  const [registry, setRegistry] = useState(() => getBuilderComponentRegistry());
  const [renderers, setRenderers] = useState(() => getBuilderRenderers());

  useEffect(() => {
    let active = true;
    void loadBuilderPlugins().then(() => {
      if (!active) return;
      setCatalog(getBuilderComponentCatalog());
      setRegistry(getBuilderComponentRegistry());
      setRenderers(getBuilderRenderers());
    });
    return () => {
      active = false;
    };
  }, []);

  const contract = useMemo(() => {
    return registry.getContract(componentType) ?? catalog.find((entry) => entry.type === componentType);
  }, [catalog, componentType, registry]);

  const implementation = useMemo(() => registry.getImplementation(componentType), [componentType, registry]);
  const initialProps = useMemo(() => buildDefaultProps(contract), [contract]);

  const [propsState, setPropsState] = useState<PropState>(initialProps);
  const defaultRendererId = useMemo(() => {
    return (
      renderers.find((renderer) => renderer.framework === 'react')?.id ??
      renderers[0]?.id ??
      'renderer.react'
    );
  }, [renderers]);
  const [rendererId, setRendererId] = useState(defaultRendererId);
  const rendererMountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPropsState(initialProps);
  }, [initialProps]);

  useEffect(() => {
    if (!renderers.find((renderer) => renderer.id === rendererId)) {
      setRendererId(defaultRendererId);
    }
  }, [defaultRendererId, renderers, rendererId]);

  const componentOptions = useMemo(
    () =>
      catalog
        .map((entry) => ({
          value: entry.type,
          label: `${entry.displayName} (${entry.category})`,
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [catalog],
  );

  const rendererOptions = useMemo(
    () =>
      renderers.map((renderer) => ({
        value: renderer.id,
        label: `${renderer.name} (${renderer.framework})`,
      })),
    [renderers],
  );

  const selectedRenderer = useMemo(
    () => renderers.find((renderer) => renderer.id === rendererId) ?? renderers[0] ?? null,
    [rendererId, renderers],
  );
  const useReactPreview = !selectedRenderer || selectedRenderer.framework === 'react';

  const previewProps = useMemo(() => mapPreviewProps(contract, propsState), [contract, propsState]);
  const preview = implementation
    ? createElement(implementation as ComponentType<any>, previewProps)
    : null;

  useEffect(() => {
    if (!selectedRenderer || selectedRenderer.framework === 'react') return;
    const mount = rendererMountRef.current;
    if (!mount) return;
    selectedRenderer.render({
      mount,
      componentType: contract?.type,
      props: previewProps as Record<string, ComponentPropValue>,
      registry,
    });
    return () => {
      selectedRenderer.unmount?.(mount);
    };
  }, [contract?.type, previewProps, registry, selectedRenderer]);

  if (!contract) {
    return (
      <div className={styles.page}>
        <div className={styles.notice}>
          Component type "{componentType}" was not found. Return to the{' '}
          <a className={styles.linkButton} href="/studio">
            Component Studio
          </a>
          .
        </div>
      </div>
    );
  }

  const handlePropChange = (key: string, value: ComponentPropValue | undefined) => {
    setPropsState((current) => {
      const next = { ...current } as PropState;
      if (value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const handleReset = () => {
    setPropsState(initialProps);
  };

  const handleComponentChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextType = event.target.value;
    router.push(`/studio/${encodeURIComponent(nextType)}`);
  };

  const handleRendererChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setRendererId(event.target.value);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <span className={styles.kicker}>Component Studio</span>
          <h1 className={styles.title}>{contract.displayName}</h1>
          <p className={styles.description}>{contract.description ?? 'Preview and configure this component.'}</p>
        </div>
        <div className={styles.headerActions}>
          <Select
            label="Switch Component"
            value={componentType}
            options={componentOptions}
            onChange={handleComponentChange}
            size="sm"
          />
          {rendererOptions.length ? (
            <Select
              label="Preview Renderer"
              value={rendererId}
              options={rendererOptions}
              onChange={handleRendererChange}
              size="sm"
            />
          ) : null}
          <Button variant="secondary" onClick={handleReset}>
            Reset Props
          </Button>
        </div>
      </header>

      <div className={styles.detailGrid}>
        <aside className={styles.panel}>
          <Card title="Properties" description="Edit props based on the component contract." variant="outline">
            <div className={styles.fieldGroup}>
              {Object.entries(contract.props ?? {}).length === 0 ? (
                <p className={styles.description}>This component has no configurable properties.</p>
              ) : (
                Object.entries(contract.props ?? {})
                  .sort((left, right) => {
                    const leftLabel = left[1]?.label ?? left[0];
                    const rightLabel = right[1]?.label ?? right[0];
                    return leftLabel.localeCompare(rightLabel);
                  })
                  .map(([propKey, definition]) => (
                    <StudioPropField
                      key={propKey}
                      propKey={propKey}
                      definition={definition}
                      value={propsState[propKey]}
                      onChange={(value) => handlePropChange(propKey, value)}
                    />
                  ))
              )}
            </div>
          </Card>

          <Card title="Documentation" description="Notes from the component contract." variant="outline">
            {contract.documentation?.summary ? <p className={styles.description}>{contract.documentation.summary}</p> : null}
            {contract.documentation?.tips?.length ? (
              <div>
                <p className={styles.fieldLabel}>Tips</p>
                <ul className={styles.docList}>
                  {contract.documentation.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {contract.documentation?.examples?.length ? (
              <div>
                <p className={styles.fieldLabel}>Examples</p>
                <ul className={styles.docList}>
                  {contract.documentation.examples.map((example) => (
                    <li key={example}>{example}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {contract.events?.length ? (
              <div>
                <p className={styles.fieldLabel}>Events</p>
                <ul className={styles.docList}>
                  {contract.events.map((event) => (
                    <li key={event.name}>{event.name}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        </aside>

        <section className={styles.panel}>
          <Card title="Live Preview" description="Changes update instantly." variant="outline">
            <div
              className={styles.previewSurface}
            >
              {useReactPreview ? (
                preview ?? (
                  <p className={styles.description}>
                    No implementation registered for {contract.type}. The contract is still viewable.
                  </p>
                )
              ) : (
                <div ref={rendererMountRef} className={styles.rendererMount}>
                  <p className={styles.description}>Loading renderer preview...</p>
                </div>
              )}
            </div>
          </Card>

          <Card title="Props JSON" description="Snapshot of the current props." variant="outline">
            <pre className={styles.codeBlock}>{JSON.stringify(propsState, null, 2)}</pre>
          </Card>
        </section>
      </div>
    </div>
  );
}

interface StudioPropFieldProps {
  propKey: string;
  definition: ComponentPropDefinition;
  value: ComponentPropValue | undefined;
  onChange: (value: ComponentPropValue | undefined) => void;
}

function StudioPropField({ propKey, definition, value, onChange }: StudioPropFieldProps) {
  const editable = definition.editable !== false;
  const resolvedValue = value ?? definition.defaultValue;

  if (definition.kind === 'boolean') {
    return (
      <Checkbox
        label={definition.label}
        helperText={definition.description}
        checked={Boolean(resolvedValue)}
        onChange={(event) => onChange(event.target.checked)}
        disabled={!editable}
      />
    );
  }

  if (definition.kind === 'enum') {
    const stringValue = typeof resolvedValue === 'string' ? resolvedValue : '';
    return (
      <Select
        label={definition.label}
        helperText={definition.description}
        value={stringValue}
        options={definition.options}
        placeholder={definition.required ? undefined : 'Select option'}
        onChange={(event) => onChange(event.target.value === '' ? undefined : event.target.value)}
        disabled={!editable}
        size="sm"
      />
    );
  }

  if (definition.kind === 'number') {
    const numericValue =
      typeof resolvedValue === 'number' && Number.isFinite(resolvedValue)
        ? resolvedValue
        : resolvedValue === undefined || resolvedValue === null
          ? ''
          : Number(resolvedValue);
    return (
      <Input
        label={definition.label}
        helperText={definition.description}
        type="number"
        value={Number.isFinite(numericValue as number) ? (numericValue as number) : ''}
        min={definition.min}
        max={definition.max}
        step={definition.step}
        size="sm"
        disabled={!editable}
        onChange={(event) => {
          const nextRaw = event.target.value;
          if (nextRaw === '') {
            onChange(undefined);
            return;
          }
          const parsed = Number(nextRaw);
          onChange(Number.isFinite(parsed) ? parsed : undefined);
        }}
      />
    );
  }

  if (definition.kind === 'json') {
    return (
      <JsonEditor
        label={definition.label}
        description={definition.description}
        value={resolvedValue}
        onChange={onChange}
        propKey={propKey}
      />
    );
  }

  const stringValue = resolvedValue === undefined || resolvedValue === null ? '' : String(resolvedValue);
  return (
    <Input
      label={definition.label}
      helperText={definition.description}
      placeholder={definition.kind === 'string' ? definition.placeholder : undefined}
      value={stringValue}
      size="sm"
      disabled={!editable}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

interface JsonEditorProps {
  label: string;
  description?: string;
  value: ComponentPropValue | undefined;
  onChange: (value: ComponentPropValue | undefined) => void;
  propKey: string;
}

function JsonEditor({ label, description, value, onChange, propKey }: JsonEditorProps) {
  const [draft, setDraft] = useState(() => formatJson(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(formatJson(value));
    setError(null);
  }, [value]);

  return (
    <div>
      <label className={styles.fieldLabel} htmlFor={`json-${propKey}`}>
        {label}
      </label>
      <textarea
        id={`json-${propKey}`}
        className={styles.textArea}
        value={draft}
        onChange={(event) => {
          const nextValue = event.target.value;
          setDraft(nextValue);
          if (!nextValue.trim()) {
            onChange(undefined);
            setError(null);
            return;
          }
          try {
            const parsed = JSON.parse(nextValue);
            onChange(parsed as ComponentPropValue);
            setError(null);
          } catch {
            setError('Invalid JSON');
          }
        }}
      />
      {description ? <p className={styles.inlineHint}>{description}</p> : null}
      {error ? <p className={styles.errorText}>{error}</p> : null}
    </div>
  );
}

function buildDefaultProps(contract?: ComponentContract): PropState {
  if (!contract) return {};
  const next: PropState = {};
  for (const [key, definition] of Object.entries(contract.props ?? {})) {
    if (definition.defaultValue !== undefined) {
      next[key] = definition.defaultValue;
    }
  }
  if (contract.defaultProps) {
    for (const [key, value] of Object.entries(contract.defaultProps)) {
      if (value !== undefined) {
        next[key] = value as ComponentPropValue;
      }
    }
  }
  return next;
}

function mapPreviewProps(contract: ComponentContract | undefined, propsState: PropState) {
  const mapped: Record<string, unknown> = { ...propsState };
  if (!contract) return mapped;

  if (contract.type === 'action.button') {
    const label = propsState.label ?? contract.defaultProps?.label ?? 'Button';
    delete mapped.label;
    mapped.children = label;
    if (propsState.ariaLabel !== undefined) {
      mapped['aria-label'] = propsState.ariaLabel as string;
      delete mapped.ariaLabel;
    }
  }

  if (contract.type === 'input.text') {
    if (propsState.ariaLabel !== undefined) {
      mapped['aria-label'] = propsState.ariaLabel as string;
      delete mapped.ariaLabel;
    }
  }

  return mapped;
}

function formatJson(value: ComponentPropValue | undefined): string {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}
