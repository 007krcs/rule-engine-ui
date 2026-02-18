'use client';

import { useState } from 'react';
import type { RuleOperator } from '@platform/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { ConditionDraft, OperandDraft } from './rule-visual-model';
import {
  createConditionGroupDraft,
  createConditionNotDraft,
  createDefaultConditionDraft,
} from './rule-visual-model';
import styles from './condition-builder.module.scss';

export const CONDITION_OPERATORS: Array<{ value: RuleOperator; label: string }> = [
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
}: {
  label: string;
  operand: OperandDraft;
  onChange: (next: OperandDraft) => void;
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
          />
        </div>
      ) : (
        <Input
          value={operand.valueText}
          onChange={(event) => onChange({ ...operand, valueText: event.target.value })}
          placeholder='JSON or plain text (e.g. "US", true, 42)'
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
          >
            {CONDITION_OPERATORS.map((operator) => (
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
        />
        {node.op !== 'exists' ? (
          <OperandEditor
            label="Right"
            operand={node.right ?? { kind: 'value', valueText: '""' }}
            onChange={(nextOperand) => onChange({ ...node, right: nextOperand })}
          />
        ) : null}
      </div>
    </div>
  );
}

export function ConditionBuilder({
  value,
  onChange,
}: {
  value: ConditionDraft;
  onChange: (next: ConditionDraft) => void;
}) {
  return <ConditionNodeEditor node={value} onChange={onChange} isRoot />;
}
