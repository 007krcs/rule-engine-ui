'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import styles from './layout-check.module.css';

const breakpoints = [
  { name: 'Desktop', width: 1440, height: 900 },
  { name: 'Laptop', width: 1280, height: 800 },
  { name: 'Tablet', width: 768, height: 900 },
  { name: 'Mobile', width: 375, height: 812 },
];

function normalizePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '/';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export default function LayoutCheckPage() {
  const [path, setPath] = useState('/builder');

  const normalized = useMemo(() => normalizePath(path), [path]);

  return (
    <div className={styles.page}>
      <Card>
        <CardHeader>
          <CardTitle>Layout Check</CardTitle>
        </CardHeader>
        <CardContent className={styles.headerContent}>
          <div className={styles.field}>
            <label className="rfFieldLabel">Route to preview</label>
            <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/builder" />
            <p className={styles.hint}>
              Tip: try <code className="rfCodeInline">/</code>, <code className="rfCodeInline">/console</code>,{' '}
              <code className="rfCodeInline">/builder</code>, <code className="rfCodeInline">/playground</code>,{' '}
              <code className="rfCodeInline">/docs</code>.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className={styles.grid}>
        {breakpoints.map((bp) => (
          <Card key={bp.name}>
            <CardHeader>
              <CardTitle>
                {bp.name} ({bp.width}x{bp.height})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={styles.frameWrap}>
                <iframe
                  className={styles.frame}
                  title={`${bp.name} preview`}
                  src={normalized}
                  style={{ width: bp.width, height: bp.height }}
                />
              </div>
              <p className={styles.hint} style={{ marginTop: 10 }}>
                Previewing <code className="rfCodeInline">{normalized}</code>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

