'use client';

import { Badge } from '@/components/ui/badge';

export function AuditItem({
  action,
  actor,
  target,
  time,
  severity = 'info',
}: {
  action: string;
  actor: string;
  target: string;
  time: string;
  severity?: 'info' | 'warning';
}) {
  return (
    <div className="flex items-start justify-between rounded-lg border border-border p-3">
      <div>
        <p className="text-sm font-semibold">{action}</p>
        <p className="text-xs text-muted-foreground">{actor}</p>
      </div>
      <div className="text-right">
        <Badge variant={severity === 'warning' ? 'warning' : 'muted'}>{severity}</Badge>
        <p className="text-xs text-muted-foreground">{target}</p>
        <p className="text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
  );
}
