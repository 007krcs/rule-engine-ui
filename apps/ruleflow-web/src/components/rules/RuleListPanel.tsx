'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { RuleDraft } from './rule-visual-model';
import styles from './rule-list-panel.module.scss';

type RuleListPanelProps = {
  rules: RuleDraft[];
  selectedRuleId: string | null;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  onSelectRule: (id: string) => void;
  onAddRule: () => void;
  onDuplicateRule: (id: string) => void;
  onDeleteRule: (id: string) => void;
  onReorderRules: (fromRuleId: string, toRuleId: string) => void;
};

function toSafeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function RuleListPanel({
  rules,
  selectedRuleId,
  searchText,
  onSearchTextChange,
  onSelectRule,
  onAddRule,
  onDuplicateRule,
  onDeleteRule,
  onReorderRules,
}: RuleListPanelProps) {
  const [draggingRuleId, setDraggingRuleId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    if (!needle) return rules;
    return rules.filter(
      (rule) =>
        rule.ruleId.toLowerCase().includes(needle) ||
        rule.description.toLowerCase().includes(needle),
    );
  }, [rules, searchText]);

  return (
    <section className={styles.panel} aria-label="Rule list">
      <div className={styles.header}>
        <h3 className={styles.title}>Rule List</h3>
        <Badge variant="muted">{rules.length}</Badge>
      </div>

      <div className={styles.controls}>
        <Input
          value={searchText}
          onChange={(event) => onSearchTextChange(event.target.value)}
          placeholder="Search rules"
          aria-label="Search rules"
          data-testid="rules-search-input"
        />
        <Button
          type="button"
          size="sm"
          onClick={onAddRule}
          data-testid="rules-add-rule"
        >
          Add Rule
        </Button>
      </div>

      <div className={styles.list} role="list" data-testid="rules-list-panel">
        {filtered.map((rule) => {
          const selected = rule.id === selectedRuleId;
          return (
            <div
              key={rule.id}
              role="listitem"
              draggable
              data-testid={`rule-list-item-${toSafeId(rule.ruleId)}`}
              data-selected={selected ? 'true' : 'false'}
              className={styles.item}
              onDragStart={() => setDraggingRuleId(rule.id)}
              onDragEnd={() => setDraggingRuleId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (!draggingRuleId || draggingRuleId === rule.id) return;
                onReorderRules(draggingRuleId, rule.id);
              }}
            >
              <button
                type="button"
                className={styles.itemMain}
                onClick={() => onSelectRule(rule.id)}
              >
                <span className={styles.ruleId}>{rule.ruleId}</span>
                <span className={styles.ruleMeta}>Priority {rule.priority}</span>
                {rule.description.trim() ? (
                  <span className={styles.ruleDescription}>{rule.description}</span>
                ) : (
                  <span className={styles.ruleDescriptionEmpty}>No description yet</span>
                )}
              </button>
              <div className={styles.itemActions}>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onDuplicateRule(rule.id)}
                  data-testid={`rules-duplicate-${toSafeId(rule.ruleId)}`}
                >
                  Duplicate
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onDeleteRule(rule.id)}
                  data-testid={`rules-delete-${toSafeId(rule.ruleId)}`}
                >
                  Delete
                </Button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 ? (
          <p className={styles.empty}>No rules match your search.</p>
        ) : null}
      </div>
    </section>
  );
}
