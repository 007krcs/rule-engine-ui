'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SamplesGallery } from '@/components/onboarding/samples-gallery';
import styles from './samples.module.css';

export default function SamplesPage() {
  return (
    <div className={styles.page}>
      <Card>
        <CardHeader>
          <div className={styles.hero}>
            <div>
              <CardTitle>Sample Projects</CardTitle>
              <p className={styles.heroText}>
                Clone a complete UI + flow + rules bundle into a new DRAFT config version, then edit it in Builder and run it in Playground.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <SamplesGallery />
        </CardContent>
      </Card>
    </div>
  );
}

