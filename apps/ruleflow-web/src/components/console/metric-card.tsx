'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import styles from './metric-card.module.css';

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
      <CardContent>
        <div className={styles.content}>
          <p className={styles.value}>{value}</p>
          {caption && <p style={{ margin: 0 }}>{caption}</p>}
          {detail && <p className={styles.detail} style={{ margin: 0 }}>{detail}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
