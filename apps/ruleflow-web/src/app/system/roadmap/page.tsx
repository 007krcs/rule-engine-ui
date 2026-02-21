import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import styles from './roadmap.module.css';

const planned = [
  {
    title: 'Angular/Vue Hydration Parity',
    detail:
      'Harden hydration APIs and close parity gaps with React rendering lifecycle/event behavior. Interim: use HTML render + hydrateAngular/hydrateVue.',
    horizon: 'Now',
  },
  {
    title: 'Visual Flow Builder',
    detail:
      'Ship drag-and-drop flow authoring with JSON synchronization and deterministic transition editing. Interim: edit flow JSON in Builder Flow screen.',
    horizon: 'Now',
  },
  {
    title: 'Date Parsing and Arithmetic Expansion',
    detail:
      'Add richer locale-aware date parsing and native arithmetic transforms. Interim: compute plusDays/date transforms in host and pass normalized ISO values.',
    horizon: 'Next',
  },
  {
    title: 'GraphQL Orchestration Enhancements',
    detail:
      'Improve first-class GraphQL orchestration controls and mapping UX. Interim: wrap GraphQL calls in REST endpoints consumed by current API mappings.',
    horizon: 'Next',
  },
  {
    title: 'Layout Engine Expansion',
    detail:
      'Extend native layouts for deeper nested grids and responsive row/column composition. Interim: use custom layout components registered via adapterHint.',
    horizon: 'Next',
  },
  {
    title: 'Public Roadmap + Release Signals',
    detail:
      'Keep this page updated with status, expected sequencing, and migration notes so teams can plan CI/CD rollouts.',
    horizon: 'Ongoing',
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
              <p className={styles.plannedHorizon}>{item.horizon}</p>
              <p className={styles.plannedDetail}>{item.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
