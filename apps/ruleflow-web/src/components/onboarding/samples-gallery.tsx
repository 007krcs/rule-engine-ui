'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sampleTemplates } from '@/lib/samples';
import { apiPost } from '@/lib/demo/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import styles from './samples-gallery.module.css';
import { useOnboarding } from '@/components/onboarding/onboarding-provider';

export function SamplesGallery({ onCloned }: { onCloned?: (versionId: string) => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const onboarding = useOnboarding();
  const [busyId, setBusyId] = useState<string | null>(null);

  const clone = async (templateId: string) => {
    const template = sampleTemplates.find((t) => t.id === templateId);
    if (!template) return;

    setBusyId(templateId);
    try {
      const result = await apiPost<{ ok: true; packageId: string; versionId: string }>('/api/config-packages', {
        name: template.name,
        description: template.description,
        templateId: template.id,
      });
      onboarding.setActiveVersionId(result.versionId);
      onboarding.completeStep('createConfig');
      toast({ variant: 'success', title: 'Cloned sample config', description: result.versionId });
      onCloned?.(result.versionId);
      router.push(`/builder?versionId=${encodeURIComponent(result.versionId)}`);
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Failed to clone sample',
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={styles.grid}>
      {sampleTemplates.map((template) => (
        <Card key={template.id}>
          <CardHeader>
            <div className={styles.cardHeaderRow}>
              <div>
                <CardTitle className={styles.name}>{template.name}</CardTitle>
                <p className={styles.desc}>{template.description}</p>
                <div className={styles.pillRow}>
                  {template.recommended ? <Badge variant="success">Recommended</Badge> : <Badge variant="muted">Sample</Badge>}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className={styles.learnList}>
              {template.learn.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className={styles.actionsRow}>
              <Button size="sm" onClick={() => void clone(template.id)} disabled={busyId !== null}>
                {busyId === template.id ? 'Cloning...' : 'Clone sample'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
