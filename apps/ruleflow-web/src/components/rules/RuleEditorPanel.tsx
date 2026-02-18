'use client';

import { useState } from 'react';
import type { RuleOperator } from '@platform/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type {
  ActionDraft,
  ActionType,
  ConditionDraft,
  OperandDraft,
  RuleDraft,
} from './rule-visual-model';
import {
  createActionDraft,
  createConditionGroupDraft,
  createConditionNotDraft,
  createDefaultConditionDraft,
} from './rule-visual-model';
import styles from './rule-editor-panel.module.scss';

type RuleEditorPanelProps = {
  rule: RuleDraft | null;
  onRuleChange: (rule: RuleDraft) => void;
};

const OPERATORS: Array<{ value: RuleOperator; label: string }> = [
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Not equals' },
  { value: 'gt', label: 'Greater than' },
  { value: 'gte', label: 'Greater or equal' },
  { value: 'lt', label: 'Less than' },
  { value: 'lte', label: 'Less or equal' },
  { value: 'dateEq', label: 'Date equals' },
  { value: 'dateBefore', label: 'Date before' },
  { value: 'dateAfter', label: 'Date after' },
  { value: 'dateBetween', label: 'Date between' },
  { value: 'in', label: 'In list' },
  { value: 'contains', label: 'Contains' },
  { value: 'startsWith', label: 'Starts with' },
  { value: 'endsWith', label: 'Ends with' },
  { value: 'exists', label: 'Exists' },
];

function reorderByIds<T extends { id: string }>(items: T[], fromId: string, toId: string): T[] {
  const fromIndex = items.findIndex((item) => item.id === fromId);
  const toIndex = items.findIndex((item) => item.id === toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return items;
  next.splice(toIndex, 0, moved);
  return next;
}

function splitPathSource(path: string): { source: 'data' | 'context' | 'custom'; key: string } {
  if (path.startsWith('data.')) return { source: 'data', key: path.slice('data.'.length) };
  if (path.startsWith('context.')) return { source: 'context', key: path.slice('context.'.length) };
  return { source: 'custom', key: path };
}

function buildPath(source: 'data' | 'context' | 'custom', key: string): string {
  const trimmedKey = key.trim();
  if (source === 'custom') return trimmedKey;
  return trimmedKey ? `${source}.${trimmedKey}` : `${source}.value`;
}

function OperandEditor({
  label,
  operand,
  onChange,
  testIdPrefix,
}: {
  label: string;
  operand: OperandDraft;
  onChange: (next: OperandDraft) => void;
  testIdPrefix: string;
}) {
  const sourceData = operand.kind === 'path' ? splitPathSource(operand.path) : { source: 'data' as const, key: 'value' };
  return (
    <div className={styles.operand}>
      <p className={styles.fieldLabel}>{label}</p>
      <Select
        value={operand.kind}
        onChange={(event) => {
          const mode = event.target.value as OperandDraft['kind'];
          if (mode === 'path') {
            onChange({ kind: 'path', path: 'data.value' });
          } else {
            onChange({ kind: 'value', valueText: '""' });
          }
        }}
      >
        <option value="path">Path</option>
        <option value="value">Value</option>
      </Select>

      {operand.kind === 'path' ? (
        <div className={styles.pathGrid}>
          <Select
            value={sourceData.source}
            onChange={(event) =>
              onChange({
                kind: 'path',
                path: buildPath(event.target.value as 'data' | 'context' | 'custom', sourceData.key),
              })
            }
            data-testid={`${testIdPrefix}-source`}
          >
            <option value="data">Data</option>
            <option value="context">Context</option>
            <option value="custom">Custom</option>
          </Select>
          <Input
            value={sourceData.key}
            onChange={(event) =>
              onChange({
                kind: 'path',
                path: buildPath(sourceData.source, event.target.value),
              })
            }
            placeholder={sourceData.source === 'custom' ? 'path' : 'field.path'}
            data-testid={`${testIdPrefix}-key`}
          />
        </div>
      ) : (
        <Input
          value={operand.valueText}
          onChange={(event) => onChange({ ...operand, valueText: event.target.value })}
          placeholder='JSON or plain text (e.g. "US", true, 42)'
          data-testid={`${testIdPrefix}-value`}
        />
      )}
    </div>
  );
}

function ConditionNodeEditor({
  node,
  onChange,
  onDelete,
  isRoot,
}: {
  node: ConditionDraft;
  onChange: (next: ConditionDraft) => void;
  onDelete?: () => void;
  isRoot?: boolean;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  if (node.kind === 'group') {
    return (
      <div className={styles.conditionCard} data-testid="condition-node-group">
        <div className={styles.conditionHeader}>
          <span className={styles.conditionTitle}>Condition Group</span>
          <div className={styles.conditionHeaderControls}>
            <Select
              value={node.op}
              onChange={(event) =>
                onChange({ ...node, op: event.target.value as 'all' | 'any' })
              }
            >
              <option value="all">All conditions (AND)</option>
              <option value="any">Any condition (OR)</option>
            </Select>
            {!isRoot && onDelete ? (
              <Button type="button" size="sm" variant="outline" onClick={onDelete}>
                Remove
              </Button>
            ) : null}
          </div>
        </div>

        <div className={styles.conditionChildren}>
          {node.children.map((child) => (
            <div
              key={child.id}
              className={styles.draggable}
              draggable
              onDragStart={() => setDraggingId(child.id)}
              onDragEnd={() => setDraggingId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (!draggingId || draggingId === child.id) return;
                onChange({
                  ...node,
                  children: reorderByIds(node.children, draggingId, child.id),
                });
              }}
            >
              <ConditionNodeEditor
                node={child}
                onChange={(nextChild) =>
                  onChange({
                    ...node,
                    children: node.children.map((candidate) =>
                      candidate.id === child.id ? nextChild : candidate,
                    ),
                  })
                }
                onDelete={() =>
                  onChange({
                    ...node,
                    children: node.children.filter((candidate) => candidate.id !== child.id),
                  })
                }
              />
            </div>
          ))}
        </div>

        <div className={styles.nodeActions}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onChange({ ...node, children: [...node.children, createDefaultConditionDraft()] })
            }
          >
            Add Compare
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onChange({ ...node, children: [...node.children, createConditionGroupDraft('all')] })
            }
          >
            Add AND Group
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onChange({ ...node, children: [...node.children, createConditionGroupDraft('any')] })
            }
          >
            Add OR Group
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onChange({ ...node, children: [...node.children, createConditionNotDraft()] })
            }
          >
            Add NOT
          </Button>
        </div>
      </div>
    );
  }

  if (node.kind === 'not') {
    return (
      <div className={styles.conditionCard} data-testid="condition-node-not">
        <div className={styles.conditionHeader}>
          <span className={styles.conditionTitle}>NOT</span>
          {!isRoot && onDelete ? (
            <Button type="button" size="sm" variant="outline" onClick={onDelete}>
              Remove
            </Button>
          ) : null}
        </div>
        <ConditionNodeEditor
          node={node.child}
          onChange={(nextChild) => onChange({ ...node, child: nextChild })}
        />
      </div>
    );
  }

  return (
    <div className={styles.conditionCard} data-testid="condition-node-compare">
      <div className={styles.conditionHeader}>
        <span className={styles.conditionTitle}>Compare Condition</span>
        {!isRoot && onDelete ? (
          <Button type="button" size="sm" variant="outline" onClick={onDelete}>
            Remove
          </Button>
        ) : null}
      </div>

      <div className={styles.compareGrid}>
        <div className={styles.field}>
          <p className={styles.fieldLabel}>Operator</p>
          <Select
            value={node.op}
            onChange={(event) =>
              onChange({
                ...node,
                op: event.target.value as RuleOperator,
                right:
                  event.target.value === 'exists'
                    ? undefined
                    : node.right ?? { kind: 'value', valueText: '""' },
              })
            }
            data-testid="condition-op-select"
          >
            {OPERATORS.map((operator) => (
              <option key={operator.value} value={operator.value}>
                {operator.label}
              </option>
            ))}
          </Select>
        </div>
        <OperandEditor
          label="Left"
          operand={node.left}
          onChange={(nextOperand) => onChange({ ...node, left: nextOperand })}
          testIdPrefix="condition-left"
        />
        {node.op !== 'exists' ? (
          <OperandEditor
            label="Right"
            operand={node.right ?? { kind: 'value', valueText: '""' }}
            onChange={(nextOperand) => onChange({ ...node, right: nextOperand })}
            testIdPrefix="condition-right"
          />
        ) : null}
      </div>
    </div>
  );
}

function ActionEditor({
  action,
  onChange,
  onDelete,
}: {
  action: ActionDraft;
  onChange: (next: ActionDraft) => void;
  onDelete: () => void;
}) {
  return (
    <div className={styles.actionCard}>
      <div className={styles.actionHeader}>
        <Select
          value={action.type}
          onChange={(event) => onChange(createActionDraft(event.target.value as ActionType))}
          data-testid="action-type-select"
        >
          <option value="setField">Set Field</option>
          <option value="setContext">Set Context</option>
          <option value="removeField">Remove Field</option>
          <option value="addItem">Add Item</option>
          <option value="mapField">Map Field</option>
          <option value="emitEvent">Emit Event</option>
          <option value="throwError">Throw Error</option>
        </Select>
        <Button type="button" size="sm" variant="outline" onClick={onDelete}>
          Remove
        </Button>
      </div>

      {(action.type === 'setField' || action.type === 'setContext' || action.type === 'addItem') ? (
        <div className={styles.fieldGrid}>
          <Input
            value={action.path}
            onChange={(event) => onChange({ ...action, path: event.target.value })}
            placeholder={action.type === 'setContext' ? 'context.path' : 'data.path'}
            data-testid="action-path-input"
          />
          <Input
            value={action.valueText}
            onChange={(event) => onChange({ ...action, valueText: event.target.value })}
            placeholder='Value (JSON allowed), e.g. true or {"ok":1}'
            data-testid="action-value-input"
          />
        </div>
      ) : null}

      {action.type === 'removeField' ? (
        <Input
          value={action.path}
          onChange={(event) => onChange({ ...action, path: event.target.value })}
          placeholder="data.path"
          data-testid="action-path-input"
        />
      ) : null}

      {action.type === 'mapField' ? (
        <div className={styles.fieldGrid}>
          <Input
            value={action.from}
            onChange={(event) => onChange({ ...action, from: event.target.value })}
            placeholder="from path"
          />
          <Input
            value={action.to}
            onChange={(event) => onChange({ ...action, to: event.target.value })}
            placeholder="to path"
          />
        </div>
      ) : null}

      {action.type === 'emitEvent' ? (
        <div className={styles.fieldGrid}>
          <Input
            value={action.event}
            onChange={(event) => onChange({ ...action, event: event.target.value })}
            placeholder="event name"
          />
          <Input
            value={action.payloadText}
            onChange={(event) => onChange({ ...action, payloadText: event.target.value })}
            placeholder="payload JSON"
          />
        </div>
      ) : null}

      {action.type === 'throwError' ? (
        <div className={styles.fieldGrid}>
          <Input
            value={action.message}
            onChange={(event) => onChange({ ...action, message: event.target.value })}
            placeholder="Error message"
          />
          <Input
            value={action.code}
            onChange={(event) => onChange({ ...action, code: event.target.value })}
            placeholder="Error code (optional)"
          />
        </div>
      ) : null}
    </div>
  );
}

export function RuleEditorPanel({ rule, onRuleChange }: RuleEditorPanelProps) {
  const [draggingActionId, setDraggingActionId] = useState<string | null>(null);

  if (!rule) {
    return <p className={styles.empty}>Select a rule to edit details.</p>;
  }

  return (
    <section className={styles.panel} aria-label="Rule editor">
      <div className={styles.header}>
        <h3 className={styles.title}>Rule Editor</h3>
      </div>

      <div className={styles.block}>
        <p className={styles.blockTitle}>Basics</p>
        <div className={styles.fieldGrid}>
          <Input
            value={rule.ruleId}
            onChange={(event) => onRuleChange({ ...rule, ruleId: event.target.value })}
            placeholder="RULE_ID"
            data-testid="rule-id-input"
          />
          <Input
            type="number"
            value={rule.priority}
            onChange={(event) =>
              onRuleChange({
                ...rule,
                priority: Number.isFinite(Number(event.target.value))
                  ? Math.trunc(Number(event.target.value))
                  : rule.priority,
              })
            }
            placeholder="Priority"
          />
        </div>
        <Textarea
          value={rule.description}
          onChange={(event) => onRuleChange({ ...rule, description: event.target.value })}
          placeholder="Describe what this rule does in plain language."
          rows={3}
        />
      </div>

      <div className={styles.block}>
        <p className={styles.blockTitle}>Scope</p>
        <p className={styles.helper}>Optional filters (comma-separated): apply rule only for these values.</p>
        <div className={styles.fieldGridTriple}>
          <Input
            value={rule.scope.countriesText}
            onChange={(event) =>
              onRuleChange({ ...rule, scope: { ...rule.scope, countriesText: event.target.value } })
            }
            placeholder="Countries (US, IN)"
          />
          <Input
            value={rule.scope.rolesText}
            onChange={(event) =>
              onRuleChange({ ...rule, scope: { ...rule.scope, rolesText: event.target.value } })
            }
            placeholder="Roles (author, admin)"
          />
          <Input
            value={rule.scope.tenantsText}
            onChange={(event) =>
              onRuleChange({ ...rule, scope: { ...rule.scope, tenantsText: event.target.value } })
            }
            placeholder="Tenants"
          />
          <Input
            value={rule.scope.orgsText}
            onChange={(event) =>
              onRuleChange({ ...rule, scope: { ...rule.scope, orgsText: event.target.value } })
            }
            placeholder="Orgs"
          />
          <Input
            value={rule.scope.programsText}
            onChange={(event) =>
              onRuleChange({ ...rule, scope: { ...rule.scope, programsText: event.target.value } })
            }
            placeholder="Programs"
          />
          <Input
            value={rule.scope.issuersText}
            onChange={(event) =>
              onRuleChange({ ...rule, scope: { ...rule.scope, issuersText: event.target.value } })
            }
            placeholder="Issuers"
          />
        </div>
      </div>

      <div className={styles.block}>
        <p className={styles.blockTitle}>Condition Builder</p>
        <p className={styles.helper}>Build nested AND / OR / NOT logic. Drag condition cards to reorder sibling conditions.</p>
        <ConditionNodeEditor
          node={rule.when}
          onChange={(nextWhen) => onRuleChange({ ...rule, when: nextWhen })}
          isRoot
        />
      </div>

      <div className={styles.block}>
        <div className={styles.actionsHeader}>
          <p className={styles.blockTitle}>Actions Builder</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onRuleChange({ ...rule, actions: [...rule.actions, createActionDraft('setField')] })}
            data-testid="action-add-button"
          >
            Add Action
          </Button>
        </div>
        <p className={styles.helper}>Define what happens when this rule matches. Drag action cards to reorder execution.</p>

        <div className={styles.actionList}>
          {rule.actions.map((action) => (
            <div
              key={action.id}
              draggable
              className={styles.draggable}
              onDragStart={() => setDraggingActionId(action.id)}
              onDragEnd={() => setDraggingActionId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (!draggingActionId || draggingActionId === action.id) return;
                onRuleChange({
                  ...rule,
                  actions: reorderByIds(rule.actions, draggingActionId, action.id),
                });
              }}
            >
              <ActionEditor
                action={action}
                onChange={(nextAction) =>
                  onRuleChange({
                    ...rule,
                    actions: rule.actions.map((candidate) =>
                      candidate.id === action.id ? nextAction : candidate,
                    ),
                  })
                }
                onDelete={() =>
                  onRuleChange({
                    ...rule,
                    actions: rule.actions.filter((candidate) => candidate.id !== action.id),
                  })
                }
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
