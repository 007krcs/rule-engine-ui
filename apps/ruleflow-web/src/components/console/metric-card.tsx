'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function MetricCard({
  title,
  value,
  caption,
  detail,
}: {
  title: string;
  value: string;
  caption?: string;
  detail?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        {caption && <p>{caption}</p>}
        {detail && <p className="text-xs">{detail}</p>}
      </CardContent>
    </Card>
  );
}
