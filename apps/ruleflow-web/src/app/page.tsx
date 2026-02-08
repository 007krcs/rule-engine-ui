import Link from 'next/link';
import { ArrowRight, ShieldCheck, Workflow, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const highlights = [
  {
    title: 'Governed Configuration Lifecycle',
    description: 'DRAFT → REVIEW → APPROVED → ACTIVE → DEPRECATED → RETIRED with RBAC gating.',
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
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-grid bg-surface p-10 shadow-soft">
        <div className="absolute -right-24 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative space-y-6">
          <Badge variant="default">Enterprise-grade Headless Platform</Badge>
          <h2 className="text-4xl font-semibold leading-tight">
            RuleFlow: Configuration-driven UI + Flow + Rules for regulated enterprises
          </h2>
          <p className="max-w-2xl text-base text-muted-foreground">
            Empower business users to build apps without UI development while maintaining auditability,
            accessibility, and security. Ship controlled configuration versions across tenants with confidence.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/console" className={cn(buttonVariants({ size: 'lg' }))}>
              Explore Console <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/docs/quickstart" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}>
              Read Quickstart
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {highlights.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <span className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>What’s inside</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 text-sm text-muted-foreground">
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
            <p className="text-sm text-muted-foreground">
              Designed for banking, insurance, and public sector workloads where governance, determinism, and
              accessibility cannot be optional.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

