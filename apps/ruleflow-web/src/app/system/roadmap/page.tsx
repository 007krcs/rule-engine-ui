import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import styles from './roadmap.module.css';

const planned = [
  {
    title: 'Flow + Rules Editors',
    detail: 'Extend Builder to edit FlowSchema and RuleSet with field-level validation and trace replay.',
  },
  {
    title: 'Multi-Page UI Schemas',
    detail: 'Support editing multiple UISchema pages and wiring them to flow state uiPageId values.',
  },
  {
    title: 'Role-Based Guardrails',
    detail: 'Enforce RBAC in the UI (Author/Approver/Publisher) and block actions with policy explanations.',
  },
  {
    title: 'Semantic Diffs',
    detail: 'Upgrade diff viewer to semantic diffs for UI/flow/rules instead of raw deep JSON diffs.',
  },
];

export default function RoadmapPage() {
  return (
    <div className={styles.page}>
      <Card>
        <CardHeader>
          <CardTitle>Local Demo Roadmap</CardTitle>
        </CardHeader>
        <CardContent className={styles.content}>
          <p>
            This repo runs as a realistic local product demo: an in-memory config registry (with JSON persistence),
            governance actions, GitOps export/import, a schema builder, and a runtime playground.
          </p>
          <p>
            Initial findings are documented in <code className="rfCodeInline">apps/ruleflow-web/BUG_TRIAGE_REPORT.md</code>.
          </p>
          <p>
            If you see an interactive control that is disabled, it should explain why via tooltip and it should be tracked
            here.
          </p>
          <Link className={styles.link} href="/system/health">
            Run system health checks
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Planned</CardTitle>
        </CardHeader>
        <CardContent className={styles.planned}>
          {planned.map((item) => (
            <div key={item.title} className={styles.plannedItem}>
              <p className={styles.plannedTitle}>{item.title}</p>
              <p className={styles.plannedDetail}>{item.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
