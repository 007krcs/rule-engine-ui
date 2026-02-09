'use client';

import { Badge } from '@/components/ui/badge';
import styles from './audit-item.module.css';

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
    <div className={styles.row}>
      <div className={styles.left}>
        <p className={styles.action}>{action}</p>
        <p className={styles.meta}>{actor}</p>
      </div>
      <div className={styles.right}>
        <Badge variant={severity === 'warning' ? 'warning' : 'muted'}>{severity}</Badge>
        <p className={styles.rightMeta}>{target}</p>
        <p className={styles.rightMeta}>{time}</p>
      </div>
    </div>
  );
}
