'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  ExecutionContext,
  JSONValue,
  RuleCondition,
  RuleOperator,
  UIComponent,
  UISetValueWhenRule,
} from '@platform/schema';
import type { ValidationIssue } from '@platform/validator';
import { evaluateCondition } from '@platform/rules-engine';
import { AlertTriangle, ArrowDown, ArrowUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import styles from './component-editor.module.css';
import type { ComponentDefinition, JsonSchema } from '@platform/component-registry';

function pickFieldIssues(issues: ValidationIssue[] | undefined, predicate: (path: string) => boolean) {
  if (!issues || issues.length === 0) return [];
  return issues.filter((issue) => predicate(issue.path));
}

function firstMessage(issues: ValidationIssue[]) {
  return issues.length > 0 ? issues[0]?.message : undefined;
}

function isPlainRecord(value: unknown): value is Record<string, JSONValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sanitizeI18nProps(props: Record<string, JSONValue> | undefined): Record<string, JSONValue> {
  if (!props) return {};
  const next = { ...props };
  const keys = ['label', 'helperText', 'placeholder', 'ariaLabel'];
  for (const key of keys) {
    const raw = next[key];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      delete next[key];
    }
  }
  return next;
}

function deriveType(adapterHint: string): string {
  const parts = adapterHint.split('.');
  return parts[parts.length - 1] || adapterHint;
}

const RULE_OPERATORS: RuleOperator[] = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'contains',
  'startsWith',
  'endsWith',
  'exists',
];

type JsonParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function safeParseJson<T>(raw: string): JsonParseResult<T> {
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function serializeJson(value: unknown): string {
  return value ? JSON.stringify(value, null, 2) : '';
}

function parseJsonValue(raw: string): JSONValue {
  const parsed = safeParseJson<JSONValue>(raw);
  if (parsed.ok) return parsed.value;
  return raw as JSONValue;
}

function buildComposedCondition(input: {
  leftPath: string;
  operator: RuleOperator;
  rightValueRaw: string;
}): RuleCondition {
  const leftPath = input.leftPath.trim() || 'data.value';
  if (input.operator === 'exists') {
    return {
      op: 'exists',
      left: { path: leftPath },
    };
  }
  return {
    op: input.operator,
    left: { path: leftPath },
    right: { value: parseJsonValue(input.rightValueRaw) },
  };
}

function evaluatePreviewCondition(
  condition: RuleCondition | undefined,
  previewData: Record<string, JSONValue> | undefined,
  previewContext: ExecutionContext | undefined,
): boolean | null {
  if (!condition || !previewData || !previewContext) return null;
  try {
    return evaluateCondition(condition, previewContext, previewData);
  } catch {
    return false;
  }
}

function defaultForSchema(schema: JsonSchema | undefined): JSONValue {
  if (!schema) return null;
  if (isPlainRecord(schema) && 'default' in schema) {
    const def = (schema as { default?: unknown }).default;
    if (def !== undefined) return def as JSONValue;
  }

  if (schema.type === 'string') {
    if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0] as JSONValue;
    return '';
  }
  if (schema.type === 'number' || schema.type === 'integer') {
    return 0;
  }
  if (schema.type === 'boolean') {
    return false;
  }
  if (schema.type === 'array') {
    return [];
  }
  if (schema.type === 'object') {
    const out: Record<string, JSONValue> = {};
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      const childSchema = child as JsonSchema;
      const childDefault = defaultForSchema(childSchema);
      if (childDefault !== null && childDefault !== '') {
        out[key] = childDefault;
      }
    }
    return out;
  }
  return null;
}

function SchemaEditor({
  schema,
  value,
  disabled,
  onChange,
}: {
  schema: JsonSchema;
  value: JSONValue | undefined;
  disabled?: boolean;
  onChange: (next: JSONValue | undefined) => void;
}) {
  if (schema.type === 'object') {
    const rec = isPlainRecord(value) ? (value as Record<string, JSONValue>) : {};
    const entries = Object.entries(schema.properties ?? {}).sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 0) {
      return (
        <div className={styles.field}>
          <p className={styles.helperText}>No schema properties. Use the JSON editor below.</p>
        </div>
      );
    }

    return (
      <div className={styles.schemaGrid}>
        {entries.map(([key, childSchema]) => (
          <SchemaField
            key={key}
            name={key}
            schema={childSchema as JsonSchema}
            value={rec[key]}
            disabled={disabled}
            onChange={(next) => {
              const nextRec: Record<string, JSONValue> = { ...rec };
              if (next === undefined) {
                delete nextRec[key];
              } else {
                nextRec[key] = next as JSONValue;
              }
              onChange(nextRec);
            }}
          />
        ))}
      </div>
    );
  }

  return <SchemaField name="value" schema={schema} value={value} disabled={disabled} onChange={onChange} />;
}

function SchemaField({
  name,
  schema,
  value,
  disabled,
  onChange,
}: {
  name: string;
  schema: JsonSchema;
  value: JSONValue | undefined;
  disabled?: boolean;
  onChange: (next: JSONValue | undefined) => void;
}) {
  const title = schema.title ?? name;
  const description = schema.description;

  if (schema.type === 'string') {
    const current = typeof value === 'string' ? value : '';
    const enumOptions =
      Array.isArray(schema.enum) && schema.enum.length > 0 && schema.enum.every((opt) => typeof opt === 'string')
        ? (schema.enum as string[])
        : null;
    const isEnum = Boolean(enumOptions);
    return (
      <div className={styles.field}>
        <label className="rfFieldLabel">{title}</label>
        {description ? <p className={styles.helperText}>{description}</p> : null}
        {isEnum ? (
          <Select
            value={current}
            onChange={(e) => onChange(e.target.value.trim().length === 0 ? undefined : e.target.value)}
            disabled={disabled}
          >
            <option value="">(unset)</option>
            {enumOptions!.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            value={current}
            onChange={(e) => onChange(e.target.value.trim().length === 0 ? undefined : e.target.value)}
            disabled={disabled}
          />
        )}
      </div>
    );
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    const current = typeof value === 'number' ? String(value) : '';
    return (
      <div className={styles.field}>
        <label className="rfFieldLabel">{title}</label>
        {description ? <p className={styles.helperText}>{description}</p> : null}
        <Input
          type="number"
          value={current}
          onChange={(e) => {
            const raw = e.target.value;
            if (!raw || raw.trim().length === 0) {
              onChange(undefined);
              return;
            }
            const parsed = schema.type === 'integer' ? Number.parseInt(raw, 10) : Number(raw);
            if (!Number.isFinite(parsed)) {
              onChange(undefined);
              return;
            }
            onChange(parsed);
          }}
          disabled={disabled}
        />
      </div>
    );
  }

  if (schema.type === 'boolean') {
    const checked = typeof value === 'boolean' ? value : false;
    return (
      <div className={styles.field}>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(Boolean(e.target.checked))}
            disabled={disabled}
          />
          <span>{title}</span>
        </label>
        {description ? <p className={styles.helperText}>{description}</p> : null}
      </div>
    );
  }

  if (schema.type === 'array') {
    const current = Array.isArray(value) ? (value as JSONValue[]) : [];
    const itemSchema = schema.items as JsonSchema | undefined;
    return (
      <div className={styles.field}>
        <label className="rfFieldLabel">{title}</label>
        {description ? <p className={styles.helperText}>{description}</p> : null}

        <div className={styles.arrayList}>
          {current.map((item, index) => (
            <div key={index} className={styles.arrayItem}>
              <div className={styles.arrayItemTop}>
                <span className={styles.arrayIndex}>#{index + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={styles.arrayRemove}
                  onClick={() => {
                    const next = [...current];
                    next.splice(index, 1);
                    onChange(next.length === 0 ? undefined : next);
                  }}
                  disabled={disabled}
                  aria-label={`Remove ${title} item ${index + 1}`}
                >
                  Remove
                </Button>
              </div>
              {itemSchema ? (
                <SchemaEditor
                  schema={itemSchema}
                  value={item}
                  disabled={disabled}
                  onChange={(nextItem) => {
                    const next = [...current];
                    if (nextItem === undefined) {
                      next.splice(index, 1);
                    } else {
                      next[index] = nextItem;
                    }
                    onChange(next.length === 0 ? undefined : next);
                  }}
                />
              ) : (
                <Textarea
                  value={JSON.stringify(item, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value) as JSONValue;
                      const next = [...current];
                      next[index] = parsed;
                      onChange(next);
                    } catch {
                      // ignore invalid JSON while typing
                    }
                  }}
                  disabled={disabled}
                  className={styles.textareaSm}
                />
              )}
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const nextItem = defaultForSchema(itemSchema);
            const next = [...current, nextItem];
            onChange(next);
          }}
          disabled={disabled}
        >
          Add item
        </Button>
      </div>
    );
  }

  if (schema.type === 'object') {
    return (
      <details className={styles.details} open>
        <summary className={styles.detailsSummary}>{title}</summary>
        <SchemaEditor schema={schema} value={value} disabled={disabled} onChange={onChange} />
      </details>
    );
  }

  return (
    <div className={styles.field}>
      <label className="rfFieldLabel">{title}</label>
      {description ? <p className={styles.helperText}>{description}</p> : null}
      <Textarea
        value={value === undefined ? '' : JSON.stringify(value, null, 2)}
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (!raw) {
            onChange(undefined);
            return;
          }
          try {
            onChange(JSON.parse(raw) as JSONValue);
          } catch {
            // ignore invalid JSON
          }
        }}
        disabled={disabled}
        className={styles.textareaSm}
      />
    </div>
  );
}

export function ComponentEditor({
  component,
  definition,
  registry,
  issues,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onChange,
  onRemove,
  previewData,
  previewContext,
  translate,
}: {
  component: UIComponent;
  definition?: ComponentDefinition | null;
  registry?: ComponentDefinition[];
  issues?: ValidationIssue[];
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onChange: (component: UIComponent) => void;
  onRemove: () => void;
  previewData?: Record<string, JSONValue>;
  previewContext?: ExecutionContext;
  translate?: (key: string) => string;
}) {
  const adapterHintIssues = pickFieldIssues(issues, (path) => path.endsWith('.adapterHint'));
  const labelKeyIssues = pickFieldIssues(issues, (path) => path.includes('.i18n.labelKey'));
  const placeholderIssues = pickFieldIssues(issues, (path) => path.includes('.i18n.placeholderKey'));
  const helperTextIssues = pickFieldIssues(issues, (path) => path.includes('.i18n.helperTextKey'));
  const ariaIssues = pickFieldIssues(issues, (path) => path.endsWith('.accessibility.ariaLabelKey'));
  const focusIssues = pickFieldIssues(issues, (path) => path.endsWith('.accessibility.focusOrder'));

  const hasIssues = (issues?.length ?? 0) > 0;
  const showReorderControls = Boolean(onMoveUp) || Boolean(onMoveDown);

  const resolvedDefinition = useMemo(() => {
    if (definition) return definition;
    if (!registry || registry.length === 0) return null;
    return registry.find((item) => item.adapterHint === component.adapterHint) ?? null;
  }, [component.adapterHint, definition, registry]);

  const registryHasAdapterHint = useMemo(() => {
    if (!registry || registry.length === 0) return false;
    return registry.some((item) => item.adapterHint === component.adapterHint);
  }, [component.adapterHint, registry]);

  const propsSchema = resolvedDefinition?.propsSchema ?? null;
  const props = isPlainRecord(component.props) ? (component.props as Record<string, JSONValue>) : {};

  const [advancedPropsOpen, setAdvancedPropsOpen] = useState(false);
  const [propsText, setPropsText] = useState(() => JSON.stringify(props, null, 2));
  const [propsError, setPropsError] = useState<string | null>(null);
  const [activeRuleEditor, setActiveRuleEditor] = useState<'visibleWhen' | 'disabledWhen' | 'requiredWhen' | 'setValueWhen'>('visibleWhen');
  const [visibleWhenText, setVisibleWhenText] = useState(() => serializeJson(component.rules?.visibleWhen));
  const [disabledWhenText, setDisabledWhenText] = useState(() => serializeJson(component.rules?.disabledWhen));
  const [requiredWhenText, setRequiredWhenText] = useState(() => serializeJson(component.rules?.requiredWhen));
  const [setValueWhenText, setSetValueWhenText] = useState(() => serializeJson(component.rules?.setValueWhen));
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [composeLeftPath, setComposeLeftPath] = useState('data.orderTotal');
  const [composeOperator, setComposeOperator] = useState<RuleOperator>('gt');
  const [composeRightValue, setComposeRightValue] = useState('1000');
  const [composeSetValuePath, setComposeSetValuePath] = useState('data.orderTotal');
  const [composeSetValue, setComposeSetValue] = useState('1200');

  useEffect(() => {
    // When switching components, always reset the JSON editor.
    setPropsText(JSON.stringify(props, null, 2));
    setPropsError(null);
    setAdvancedPropsOpen(false);
    setVisibleWhenText(serializeJson(component.rules?.visibleWhen));
    setDisabledWhenText(serializeJson(component.rules?.disabledWhen));
    setRequiredWhenText(serializeJson(component.rules?.requiredWhen));
    setSetValueWhenText(serializeJson(component.rules?.setValueWhen));
    setRuleError(null);
    setActiveRuleEditor('visibleWhen');
  }, [component.id]);

  const propsJson = useMemo(() => JSON.stringify(props, null, 2), [props]);

  useEffect(() => {
    // Keep JSON editor in sync unless the user is actively editing it.
    if (advancedPropsOpen) return;
    setPropsText(propsJson);
    setPropsError(null);
  }, [advancedPropsOpen, propsJson]);

  const applyPropsJson = () => {
    try {
      const parsed = JSON.parse(propsText) as unknown;
      if (!isPlainRecord(parsed)) {
        setPropsError('Props JSON must be an object.');
        return;
      }
      setPropsError(null);
      onChange({ ...component, props: parsed });
    } catch (error) {
      setPropsError(error instanceof Error ? error.message : String(error));
    }
  };

  const updateBinding = (group: 'data' | 'context' | 'computed', key: string, path: string) => {
    const nextBindings = deepCloneJson(component.bindings ?? {}) as NonNullable<UIComponent['bindings']>;
    const bucket = (nextBindings[group] ?? {}) as Record<string, string>;
    const nextBucket = { ...bucket };
    const trimmed = path.trim();
    if (!trimmed) {
      delete nextBucket[key];
    } else {
      nextBucket[key] = trimmed;
    }
    const merged: NonNullable<UIComponent['bindings']> = { ...nextBindings, [group]: nextBucket };
    onChange({ ...component, bindings: merged });
  };

  const resetPropsToDefaults = () => {
    if (!resolvedDefinition?.defaultProps) return;
    onChange({ ...component, props: sanitizeI18nProps(deepCloneJson(resolvedDefinition.defaultProps)) });
  };

  const applyConditionRule = (
    key: 'visibleWhen' | 'disabledWhen' | 'requiredWhen',
    raw: string,
  ) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      const currentRules = { ...(component.rules ?? {}) };
      delete currentRules[key];
      onChange({
        ...component,
        rules: Object.keys(currentRules).length > 0 ? currentRules : undefined,
      });
      setRuleError(null);
      return;
    }

    const parsed = safeParseJson<RuleCondition>(raw);
    if (!parsed.ok) {
      setRuleError(parsed.error);
      return;
    }

    onChange({
      ...component,
      rules: {
        ...(component.rules ?? {}),
        [key]: parsed.value,
      },
    });
    setRuleError(null);
  };

  const applySetValueRuleJson = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      const currentRules = { ...(component.rules ?? {}) };
      delete currentRules.setValueWhen;
      onChange({
        ...component,
        rules: Object.keys(currentRules).length > 0 ? currentRules : undefined,
      });
      setRuleError(null);
      return;
    }

    const parsed = safeParseJson<UISetValueWhenRule>(raw);
    if (!parsed.ok) {
      setRuleError(parsed.error);
      return;
    }
    onChange({
      ...component,
      rules: {
        ...(component.rules ?? {}),
        setValueWhen: parsed.value,
      },
    });
    setRuleError(null);
  };

  const composeConditionIntoEditor = () => {
    const condition = buildComposedCondition({
      leftPath: composeLeftPath,
      operator: composeOperator,
      rightValueRaw: composeRightValue,
    });
    const serialized = JSON.stringify(condition, null, 2);
    if (activeRuleEditor === 'visibleWhen') {
      setVisibleWhenText(serialized);
      applyConditionRule('visibleWhen', serialized);
      return;
    }
    if (activeRuleEditor === 'disabledWhen') {
      setDisabledWhenText(serialized);
      applyConditionRule('disabledWhen', serialized);
      return;
    }
    if (activeRuleEditor === 'requiredWhen') {
      setRequiredWhenText(serialized);
      applyConditionRule('requiredWhen', serialized);
      return;
    }

    const composedRule: UISetValueWhenRule = {
      when: condition,
      path: composeSetValuePath.trim() || undefined,
      value: parseJsonValue(composeSetValue),
    };
    const serializedRule = JSON.stringify(composedRule, null, 2);
    setSetValueWhenText(serializedRule);
    applySetValueRuleJson(serializedRule);
  };

  const rulePreview = useMemo(() => {
    const visible = evaluatePreviewCondition(component.rules?.visibleWhen, previewData, previewContext);
    const disabled = evaluatePreviewCondition(component.rules?.disabledWhen, previewData, previewContext);
    const required = evaluatePreviewCondition(component.rules?.requiredWhen, previewData, previewContext);
    const setValueMatches = evaluatePreviewCondition(component.rules?.setValueWhen?.when, previewData, previewContext);
    return { visible, disabled, required, setValueMatches };
  }, [component.rules, previewContext, previewData]);

  return (
    <Card className={cn(hasIssues ? styles.cardIssues : undefined)}>
      <CardHeader>
        <div className={styles.headerRow}>
          <div className={styles.titleWrap}>
            <CardTitle className={styles.titleLine}>
              <span className={styles.componentId}>{component.id}</span>
              {hasIssues ? (
                <span className={styles.issuesPill}>
                  <AlertTriangle size={14} aria-hidden="true" focusable="false" />
                  {issues?.length} issue{issues?.length === 1 ? '' : 's'}
                </span>
              ) : null}
            </CardTitle>
            <p className={styles.typeText}>{component.type}</p>
          </div>

          <div className={styles.controls}>
            <Badge variant="muted" className={styles.adapterBadge}>
              {component.adapterHint}
            </Badge>
            {showReorderControls ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={styles.iconButton}
                  onClick={onMoveUp}
                  disabled={!canMoveUp}
                  aria-label="Move up"
                  title={!canMoveUp ? 'Already at top' : 'Move up'}
                >
                  <ArrowUp size={16} aria-hidden="true" focusable="false" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={styles.iconButton}
                  onClick={onMoveDown}
                  disabled={!canMoveDown}
                  aria-label="Move down"
                  title={!canMoveDown ? 'Already at bottom' : 'Move down'}
                >
                  <ArrowDown size={16} aria-hidden="true" focusable="false" />
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className={styles.content}>
        {hasIssues ? (
          <div className={styles.issuesBox} role="status" aria-live="polite">
            {issues?.slice(0, 3).map((issue) => (
              <p key={`${issue.path}-${issue.message}`}>
                <span className={styles.issuePath}>{issue.path || 'root'}</span>: {issue.message}
              </p>
            ))}
            {(issues?.length ?? 0) > 3 ? <p>...</p> : null}
          </div>
        ) : null}

        <div className={styles.sectionHeader}>
          <p className={styles.sectionTitle}>Basics</p>
          <p className={styles.sectionDesc}>Adapter selection + metadata.</p>
        </div>

        <div className={styles.field}>
          <label className="rfFieldLabel">Adapter Hint</label>
          {registry && registry.length > 0 ? (
            <Select
              value={component.adapterHint}
              onChange={(event) => {
                const nextHint = event.target.value;
                const nextDef = registry.find((item) => item.adapterHint === nextHint) ?? null;
                onChange({
                  ...component,
                  adapterHint: nextHint,
                  type: deriveType(nextHint),
                  props: nextDef?.defaultProps ? sanitizeI18nProps(deepCloneJson(nextDef.defaultProps)) : {},
                });
              }}
            >
              {!registryHasAdapterHint ? (
                <option value={component.adapterHint}>Unknown: {component.adapterHint}</option>
              ) : null}
              {registry.map((item) => (
                <option key={item.adapterHint} value={item.adapterHint}>
                  {item.category} - {item.displayName} ({item.adapterHint})
                </option>
              ))}
            </Select>
          ) : (
            <Input value={component.adapterHint} onChange={(event) => onChange({ ...component, adapterHint: event.target.value })} />
          )}
          {resolvedDefinition ? (
            <p className={styles.helperText}>
              {resolvedDefinition.displayName} in <span className={styles.mono}>{resolvedDefinition.category}</span>
            </p>
          ) : (
            <p className={styles.helperText}>
              Not found in registry. Builder can still save, but prop forms may be limited.
            </p>
          )}
          {firstMessage(adapterHintIssues) ? <p className={styles.fieldError}>{firstMessage(adapterHintIssues)}</p> : null}
        </div>

        <div className={styles.sectionHeader}>
          <p className={styles.sectionTitle}>Props</p>
          <p className={styles.sectionDesc}>Schema-driven form generated from the Component Registry.</p>
        </div>

        {propsSchema ? (
          <>
            <SchemaEditor
              schema={propsSchema}
              value={props as unknown as JSONValue}
              disabled={false}
              onChange={(next) => {
                if (!next || !isPlainRecord(next)) {
                  onChange({ ...component, props: {} });
                  return;
                }
                onChange({ ...component, props: next as Record<string, JSONValue> });
              }}
            />
            <div className={styles.inlineRow}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAdvancedPropsOpen((v) => !v)}
              >
                {advancedPropsOpen ? 'Hide JSON' : 'Edit as JSON'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetPropsToDefaults}
                disabled={!resolvedDefinition?.defaultProps}
                title={!resolvedDefinition?.defaultProps ? 'No defaultProps in registry' : undefined}
              >
                Reset to defaults
              </Button>
            </div>
            {advancedPropsOpen ? (
              <div className={styles.field}>
                <label className="rfFieldLabel">Props JSON</label>
                <Textarea
                  value={propsText}
                  onChange={(e) => {
                    setPropsText(e.target.value);
                    setPropsError(null);
                  }}
                  className={styles.textarea}
                />
                {propsError ? <p className={styles.fieldError}>{propsError}</p> : null}
                <div className={styles.inlineRow}>
                  <Button type="button" size="sm" onClick={applyPropsJson}>
                    Apply JSON
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPropsText(JSON.stringify(props, null, 2));
                      setPropsError(null);
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className={styles.field}>
            <p className={styles.helperText}>
              No props schema found for this adapter. Register a manifest in <span className={styles.mono}>Component Registry</span> to unlock
              schema-driven forms.
            </p>
          </div>
        )}

        <div className={styles.sectionHeader}>
          <p className={styles.sectionTitle}>Bindings</p>
          <p className={styles.sectionDesc}>Connect props to runtime data/context paths.</p>
        </div>

        {(resolvedDefinition?.bindings?.data?.length ?? 0) > 0 ? (
          <div className={styles.kvGrid}>
            {resolvedDefinition!.bindings!.data!.map((key) => (
              <div key={`data:${key}`} className={styles.field}>
                <label className="rfFieldLabel">data.{key}</label>
                <Input
                  value={component.bindings?.data?.[key] ?? ''}
                  onChange={(e) => updateBinding('data', key, e.target.value)}
                  placeholder="data.path.to.value"
                />
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.helperText}>No data bindings declared in registry.</p>
        )}

        {(resolvedDefinition?.bindings?.context?.length ?? 0) > 0 ? (
          <div className={styles.kvGrid}>
            {resolvedDefinition!.bindings!.context!.map((key) => (
              <div key={`context:${key}`} className={styles.field}>
                <label className="rfFieldLabel">context.{key}</label>
                <Input
                  value={component.bindings?.context?.[key] ?? ''}
                  onChange={(e) => updateBinding('context', key, e.target.value)}
                  placeholder="context.path.to.value"
                />
              </div>
            ))}
          </div>
        ) : null}

        {(resolvedDefinition?.bindings?.computed?.length ?? 0) > 0 ? (
          <div className={styles.kvGrid}>
            {resolvedDefinition!.bindings!.computed!.map((key) => (
              <div key={`computed:${key}`} className={styles.field}>
                <label className="rfFieldLabel">computed.{key}</label>
                <Input
                  value={component.bindings?.computed?.[key] ?? ''}
                  onChange={(e) => updateBinding('computed', key, e.target.value)}
                  placeholder="data.a + data.b"
                />
              </div>
            ))}
          </div>
        ) : null}

        <div className={styles.sectionHeader}>
          <p className={styles.sectionTitle}>Rules</p>
          <p className={styles.sectionDesc}>Configure visibility/disabled/required/set-value rules with the rules engine condition language.</p>
        </div>

        <div className={styles.field}>
          <label className="rfFieldLabel">Rule Type</label>
          <Select
            value={activeRuleEditor}
            onChange={(event) =>
              setActiveRuleEditor(
                event.target.value as 'visibleWhen' | 'disabledWhen' | 'requiredWhen' | 'setValueWhen',
              )
            }
            aria-label="Rule type"
            data-testid="rule-type-select"
          >
            <option value="visibleWhen">visibleWhen</option>
            <option value="disabledWhen">disabledWhen</option>
            <option value="requiredWhen">requiredWhen</option>
            <option value="setValueWhen">setValueWhen</option>
          </Select>
        </div>

        <div className={styles.validationGrid}>
          <div className={styles.field}>
            <label className="rfFieldLabel">Left Path</label>
            <Input
              value={composeLeftPath}
              onChange={(event) => setComposeLeftPath(event.target.value)}
              placeholder="data.orderTotal"
              aria-label="Rule left path"
            />
          </div>
          <div className={styles.field}>
            <label className="rfFieldLabel">Operator</label>
            <Select
              value={composeOperator}
              onChange={(event) => setComposeOperator(event.target.value as RuleOperator)}
              aria-label="Rule operator"
            >
              <option value="" disabled hidden>
                Select
              </option>
              {RULE_OPERATORS.map((operator) => (
                <option key={operator} value={operator}>
                  {operator}
                </option>
              ))}
            </Select>
          </div>
          <div className={styles.field}>
            <label className="rfFieldLabel">Right Value (JSON)</label>
            <Input
              value={composeRightValue}
              onChange={(event) => setComposeRightValue(event.target.value)}
              disabled={composeOperator === 'exists'}
              placeholder={composeOperator === 'exists' ? 'N/A' : '1000 or "US"'}
              aria-label="Rule right value"
            />
          </div>
          {activeRuleEditor === 'setValueWhen' ? (
            <>
              <div className={styles.field}>
                <label className="rfFieldLabel">Set Path</label>
                <Input
                  value={composeSetValuePath}
                  onChange={(event) => setComposeSetValuePath(event.target.value)}
                  placeholder="data.orderTotal"
                  aria-label="Rule set path"
                />
              </div>
              <div className={styles.field}>
                <label className="rfFieldLabel">Set Value (JSON)</label>
                <Input
                  value={composeSetValue}
                  onChange={(event) => setComposeSetValue(event.target.value)}
                  placeholder='1200 or "approved"'
                  aria-label="Rule set value"
                />
              </div>
            </>
          ) : null}
        </div>
        <div className={styles.inlineRow}>
          <Button type="button" size="sm" variant="outline" onClick={composeConditionIntoEditor}>
            Compose Rule
          </Button>
        </div>

        {activeRuleEditor === 'visibleWhen' ? (
          <div className={styles.field}>
            <label className="rfFieldLabel">visibleWhen (JSON)</label>
            <Textarea
              className={styles.textareaSm}
              value={visibleWhenText}
              onChange={(event) => setVisibleWhenText(event.target.value)}
              onBlur={() => applyConditionRule('visibleWhen', visibleWhenText)}
              placeholder='{"op":"gt","left":{"path":"data.orderTotal"},"right":{"value":1000}}'
              aria-label="visibleWhen JSON"
            />
          </div>
        ) : null}

        {activeRuleEditor === 'disabledWhen' ? (
          <div className={styles.field}>
            <label className="rfFieldLabel">disabledWhen (JSON)</label>
            <Textarea
              className={styles.textareaSm}
              value={disabledWhenText}
              onChange={(event) => setDisabledWhenText(event.target.value)}
              onBlur={() => applyConditionRule('disabledWhen', disabledWhenText)}
              placeholder='{"op":"eq","left":{"path":"context.role"},"right":{"value":"viewer"}}'
              aria-label="disabledWhen JSON"
            />
          </div>
        ) : null}

        {activeRuleEditor === 'requiredWhen' ? (
          <div className={styles.field}>
            <label className="rfFieldLabel">requiredWhen (JSON)</label>
            <Textarea
              className={styles.textareaSm}
              value={requiredWhenText}
              onChange={(event) => setRequiredWhenText(event.target.value)}
              onBlur={() => applyConditionRule('requiredWhen', requiredWhenText)}
              placeholder='{"op":"eq","left":{"path":"context.country"},"right":{"value":"US"}}'
              aria-label="requiredWhen JSON"
            />
          </div>
        ) : null}

        {activeRuleEditor === 'setValueWhen' ? (
          <div className={styles.field}>
            <label className="rfFieldLabel">setValueWhen (JSON)</label>
            <Textarea
              className={styles.textarea}
              value={setValueWhenText}
              onChange={(event) => setSetValueWhenText(event.target.value)}
              onBlur={() => applySetValueRuleJson(setValueWhenText)}
              placeholder='{"when":{"op":"eq","left":{"path":"context.locale"},"right":{"value":"fr"}},"path":"data.country","value":"FR"}'
              aria-label="setValueWhen JSON"
            />
          </div>
        ) : null}

        {ruleError ? <p className={styles.fieldError}>Rule JSON error: {ruleError}</p> : null}

        <div className={styles.field}>
          <label className="rfFieldLabel">Rule Preview</label>
          <p className={styles.helperText}>
            visibleWhen: {rulePreview.visible === null ? 'n/a' : rulePreview.visible ? 'true' : 'false'} | disabledWhen:{' '}
            {rulePreview.disabled === null ? 'n/a' : rulePreview.disabled ? 'true' : 'false'} | requiredWhen:{' '}
            {rulePreview.required === null ? 'n/a' : rulePreview.required ? 'true' : 'false'} | setValueWhen:{' '}
            {rulePreview.setValueMatches === null ? 'n/a' : rulePreview.setValueMatches ? 'true' : 'false'}
          </p>
          <p className={styles.helperText}>
            Preview context uses tenant/roles/locale/country from the Builder preview controls.
          </p>
        </div>

        <div className={styles.sectionHeader}>
          <p className={styles.sectionTitle}>Validations</p>
          <p className={styles.sectionDesc}>Block save/publish until the UI schema is valid.</p>
        </div>

        <div className={styles.validationGrid}>
          <label className={styles.checkboxRow} title="Mark as required">
            <input
              type="checkbox"
              checked={component.validations?.required ?? false}
              onChange={(e) => onChange({ ...component, validations: { ...(component.validations ?? {}), required: Boolean(e.target.checked) } })}
            />
            <span>Required</span>
          </label>
          <div className={styles.field}>
            <label className="rfFieldLabel">Min</label>
            <Input
              type="number"
              value={component.validations?.min ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                onChange({
                  ...component,
                  validations: { ...(component.validations ?? {}), min: raw.trim().length ? Number(raw) : undefined },
                });
              }}
            />
          </div>
          <div className={styles.field}>
            <label className="rfFieldLabel">Max</label>
            <Input
              type="number"
              value={component.validations?.max ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                onChange({
                  ...component,
                  validations: { ...(component.validations ?? {}), max: raw.trim().length ? Number(raw) : undefined },
                });
              }}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className="rfFieldLabel">Regex</label>
          <Input
            value={component.validations?.regex ?? ''}
            onChange={(e) => onChange({ ...component, validations: { ...(component.validations ?? {}), regex: e.target.value.trim() || undefined } })}
            placeholder="^[a-zA-Z\\s]+$"
          />
        </div>

        <div className={styles.sectionHeader}>
          <p className={styles.sectionTitle}>I18n</p>
          <p className={styles.sectionDesc}>Use translation keys, not hard-coded strings.</p>
        </div>

        <div className={styles.field}>
          <label className="rfFieldLabel">Label Key</label>
          <Input
            value={component.i18n?.labelKey ?? ''}
            onChange={(event) => onChange({ ...component, i18n: { ...(component.i18n ?? {}), labelKey: event.target.value } })}
          />
          {component.i18n?.labelKey ? (
            <p className={styles.helperText}>
              Preview: {translate ? translate(component.i18n.labelKey) : component.i18n.labelKey}
            </p>
          ) : null}
          {firstMessage(labelKeyIssues) ? <p className={styles.fieldError}>{firstMessage(labelKeyIssues)}</p> : null}
        </div>

        <div className={styles.field}>
          <label className="rfFieldLabel">Placeholder Key</label>
          <Input
            value={component.i18n?.placeholderKey ?? ''}
            onChange={(event) =>
              onChange({ ...component, i18n: { ...(component.i18n ?? {}), placeholderKey: event.target.value } })
            }
          />
          {component.i18n?.placeholderKey ? (
            <p className={styles.helperText}>
              Preview: {translate ? translate(component.i18n.placeholderKey) : component.i18n.placeholderKey}
            </p>
          ) : null}
          {firstMessage(placeholderIssues) ? <p className={styles.fieldError}>{firstMessage(placeholderIssues)}</p> : null}
        </div>

        <div className={styles.field}>
          <label className="rfFieldLabel">Helper Text Key</label>
          <Input
            value={component.i18n?.helperTextKey ?? ''}
            onChange={(event) =>
              onChange({ ...component, i18n: { ...(component.i18n ?? {}), helperTextKey: event.target.value } })
            }
          />
          {component.i18n?.helperTextKey ? (
            <p className={styles.helperText}>
              Preview: {translate ? translate(component.i18n.helperTextKey) : component.i18n.helperTextKey}
            </p>
          ) : null}
          {firstMessage(helperTextIssues) ? <p className={styles.fieldError}>{firstMessage(helperTextIssues)}</p> : null}
        </div>

        <div className={styles.sectionHeader}>
          <p className={styles.sectionTitle}>Accessibility</p>
          <p className={styles.sectionDesc}>WCAG: ariaLabelKey + focus order are enforced.</p>
        </div>

        <div className={styles.field}>
          <label className="rfFieldLabel">Aria Label Key</label>
          <Input
            value={component.accessibility?.ariaLabelKey ?? ''}
            onChange={(event) =>
              onChange({
                ...component,
                accessibility: {
                  ...(component.accessibility ?? {}),
                  ariaLabelKey: event.target.value,
                  keyboardNav: true,
                  focusOrder: component.accessibility?.focusOrder ?? 1,
                },
              })
            }
          />
          {component.accessibility?.ariaLabelKey ? (
            <p className={styles.helperText}>
              Preview: {translate ? translate(component.accessibility.ariaLabelKey) : component.accessibility.ariaLabelKey}
            </p>
          ) : null}
          {firstMessage(ariaIssues) ? <p className={styles.fieldError}>{firstMessage(ariaIssues)}</p> : null}
        </div>

        <div className={styles.validationGrid}>
          <div className={styles.field}>
            <label className="rfFieldLabel">Role</label>
            <Input
              value={component.accessibility?.role ?? ''}
              onChange={(e) =>
                onChange({
                  ...component,
                  accessibility: {
                    ...(component.accessibility ?? {}),
                    role: e.target.value.trim() || undefined,
                    keyboardNav: true,
                    focusOrder: component.accessibility?.focusOrder ?? 1,
                    ariaLabelKey: component.accessibility?.ariaLabelKey ?? 'runtime.aria.missing',
                  },
                })
              }
              placeholder="textbox"
            />
          </div>
          <div className={styles.field}>
            <label className="rfFieldLabel">Tab Index</label>
            <Input
              type="number"
              value={component.accessibility?.tabIndex ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                onChange({
                  ...component,
                  accessibility: {
                    ...(component.accessibility ?? {}),
                    tabIndex: raw.trim().length ? Number(raw) : undefined,
                    keyboardNav: true,
                    focusOrder: component.accessibility?.focusOrder ?? 1,
                    ariaLabelKey: component.accessibility?.ariaLabelKey ?? 'runtime.aria.missing',
                  },
                });
              }}
              placeholder="0"
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className="rfFieldLabel">Focus Order</label>
          <Input
            type="number"
            value={component.accessibility?.focusOrder ?? 1}
            onChange={(event) =>
              onChange({
                ...component,
                accessibility: {
                  ...(component.accessibility ?? {}),
                  focusOrder: Number(event.target.value) || 1,
                  keyboardNav: true,
                  ariaLabelKey: component.accessibility?.ariaLabelKey ?? 'runtime.aria.missing',
                },
              })
            }
          />
          {firstMessage(focusIssues) ? <p className={styles.fieldError}>{firstMessage(focusIssues)}</p> : null}
        </div>

        <div className={styles.removeRow}>
          <Button variant="outline" size="sm" onClick={onRemove}>
            Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
