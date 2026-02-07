import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { approvalsQueue, auditEvents, configVersions } from '@/lib/mock-data';

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'muted'> = {
  ACTIVE: 'success',
  REVIEW: 'warning',
  DEPRECATED: 'muted',
};

export default function ConsolePage() {
  return (
    <div className="grid gap-6">
      <section className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Config Lifecycle</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">3 configs active · 2 in review</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {['DRAFT', 'REVIEW', 'APPROVED', 'ACTIVE', 'DEPRECATED', 'RETIRED'].map((stage) => (
                <Badge key={stage} variant={stage === 'ACTIVE' ? 'success' : 'muted'}>
                  {stage}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Governance SLA</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Average approval: 4h 22m</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Approvals pending</span>
                <span className="font-semibold">2</span>
              </div>
              <div className="flex justify-between">
                <span>High-risk changes</span>
                <span className="font-semibold">0</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Audit Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">100% traceability across tenants</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Events retained</span>
                <span className="font-semibold">13.2M</span>
              </div>
              <div className="flex justify-between">
                <span>Replays executed</span>
                <span className="font-semibold">148</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Version Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {configVersions.map((version) => (
                <div key={version.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-semibold">{version.version}</p>
                    <p className="text-xs text-muted-foreground">{version.author}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={statusVariant[version.status]}>{version.status}</Badge>
                    <Button variant="outline" size="sm">
                      Diff
                    </Button>
                    <Button size="sm">Promote</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approval Queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {approvalsQueue.map((item) => (
              <div key={item.id} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{item.config}</span>
                  <Badge variant={item.risk === 'Medium' ? 'warning' : 'muted'}>{item.risk}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Requested by {item.requestedBy}</p>
                <p className="text-xs text-muted-foreground">{item.scope}</p>
                <div className="flex gap-2">
                  <Button size="sm">Approve</Button>
                  <Button variant="outline" size="sm">
                    Request changes
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Audit Log</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {auditEvents.map((event) => (
              <div key={event.id} className="flex items-start justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-semibold">{event.action}</p>
                  <p className="text-xs text-muted-foreground">{event.actor}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{event.target}</p>
                  <p className="text-xs text-muted-foreground">{event.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>GitOps Package</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Export config bundles as signed archives with schema + rules + flows.</p>
            <div className="flex gap-2">
              <Button size="sm">Export</Button>
              <Button variant="outline" size="sm">
                Import
              </Button>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
              gitops://tenant/horizon-bank/config/2026.02.07-rc1
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}