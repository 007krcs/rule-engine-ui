import Link from 'next/link';
import { ArrowRight, ShieldCheck, Workflow, Wand2 } from 'lucide-react';
import styles from './home.module.css';
import { Badge } from '@/components/ui/badge';
import { buttonClassName } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const highlights = [
  {
    title: 'Governed Configuration Lifecycle',
    description: 'DRAFT -> REVIEW -> APPROVED -> ACTIVE -> DEPRECATED -> RETIRED with RBAC gating.',
    icon: ShieldCheck,
  },
  {
    title: 'Deterministic Runtime',
    description: 'Replayable execution with full trace, audit logs, and circuit breakers.',
    icon: Workflow,
  },
  {
    title: 'No UI Lock-in',
    description: 'Adapters for React, Angular, Vue, and company-owned design systems.',
    icon: Wand2,
  },
];

export default function HomePage() {
  return (
    <div className={styles.stack}>
      <section className={`${styles.hero} rfGridBg`}>
        <div className={styles.glowA} aria-hidden="true" />
        <div className={styles.glowB} aria-hidden="true" />

        <div className={styles.heroInner}>
          <Badge variant="default">Enterprise-grade Headless Platform</Badge>
          <h2 className={styles.heroTitle}>ECR: Configuration-driven UI + Flow + Rules for regulated enterprises</h2>
          <p className={styles.heroText}>
            Empower business users to build apps without UI development while maintaining auditability, accessibility,
            and security. Ship controlled configuration versions across tenants with confidence.
          </p>
          <div className={styles.heroActions}>
            <Link href="/console" className={buttonClassName({ size: 'lg' })}>
              Explore Console <ArrowRight width={16} height={16} aria-hidden="true" focusable="false" />
            </Link>
            <Link href="/docs/quickstart" className={buttonClassName({ variant: 'outline', size: 'lg' })}>
              Read Quickstart
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.highlights}>
        {highlights.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title}>
              <CardHeader>
                <CardTitle className={styles.highlightTitle}>
                  <span className={styles.iconBadge} aria-hidden="true">
                    <Icon width={20} height={20} />
                  </span>
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={styles.cardText}>{item.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className={styles.twoUp}>
        <Card>
          <CardHeader>
            <CardTitle>What's inside</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className={styles.list}>
              <li>Composable runtime: flow engine + rules engine + API orchestrator</li>
              <li>Config registry with GitOps export, version diffs, and rollback</li>
              <li>Builder tools for UI, flow, and rules with validation gates</li>
              <li>Observability dashboards for traces, metrics, and rule hit rates</li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Trusted for regulated workflows</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={styles.cardText}>
              Designed for banking, insurance, and public sector workloads where governance, determinism, and
              accessibility cannot be optional.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
