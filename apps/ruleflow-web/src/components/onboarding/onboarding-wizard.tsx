'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { apiPost } from '@/lib/demo/api-client';
import { useToast } from '@/components/ui/toast';
import { SamplesGallery } from '@/components/onboarding/samples-gallery';
import { useOnboarding } from '@/components/onboarding/onboarding-provider';
import styles from './onboarding-wizard.module.css';

function stepBadge(done: boolean) {
  return <Badge variant={done ? 'success' : 'warning'}>{done ? 'PASS' : 'FAIL'}</Badge>;
}

export function OnboardingWizard() {
  const router = useRouter();
  const { toast } = useToast();
  const onboarding = useOnboarding();
  const versionId = onboarding.state.activeVersionId;

  const [creating, setCreating] = useState(false);
  const [tenantId, setTenantId] = useState('tenant-1');
  const [configId, setConfigId] = useState('my-first-config');
  const [name, setName] = useState('My First Config');

  const createDraft = async () => {
    setCreating(true);
    try {
      const result = await apiPost<{ ok: true; packageId: string; versionId: string }>('/api/config-packages', {
        name: name.trim() || 'New Config',
        configId: configId.trim() || undefined,
        tenantId: tenantId.trim() || undefined,
      });
      onboarding.setActiveVersionId(result.versionId);
      onboarding.completeStep('createConfig');
      toast({ variant: 'success', title: 'Created draft config', description: result.versionId });
      onboarding.close();
      router.push(`/builder?versionId=${encodeURIComponent(result.versionId)}`);
    } catch (error) {
      toast({ variant: 'error', title: 'Create failed', description: error instanceof Error ? error.message : String(error) });
    } finally {
      setCreating(false);
    }
  };

  const openBuilder = () => {
    if (!versionId) return;
    onboarding.close();
    router.push(`/builder?versionId=${encodeURIComponent(versionId)}`);
  };

  const openPreview = () => {
    if (!versionId) return;
    onboarding.close();
    const params = new URLSearchParams();
    params.set('versionId', versionId);
    params.set('preview', '1');
    router.push(`/builder?${params.toString()}`);
  };

  const openRules = () => {
    if (!versionId) return;
    onboarding.close();
    router.push(`/builder/rules?versionId=${encodeURIComponent(versionId)}`);
  };

  const openPlayground = (options?: { autorun?: string; focusTrace?: boolean; explain?: boolean }) => {
    if (!versionId) return;
    onboarding.close();
    const params = new URLSearchParams();
    params.set('versionId', versionId);
    if (options?.autorun) params.set('autorun', options.autorun);
    if (options?.focusTrace) params.set('focus', 'trace');
    if (options?.explain) params.set('explain', '1');
    router.push(`/playground?${params.toString()}`);
  };

  const openGitOps = () => {
    onboarding.close();
    router.push('/console?tab=versions');
  };

  return (
    <Modal
      open={onboarding.state.open}
      title="Getting Started"
      description="Create a config, build UI, add rules, save, run Playground, inspect trace, then use Console export/import."
      size="lg"
      onClose={onboarding.close}
      footer={
        <div className={styles.footerRow}>
          <div className={styles.footerLeft}>
            <Button type="button" variant="outline" onClick={onboarding.reset}>
              Reset
            </Button>
            <Button type="button" variant="outline" onClick={onboarding.dismiss}>
              Dismiss
            </Button>
          </div>
          <div className={styles.footerRight}>
            <Button type="button" variant="outline" onClick={onboarding.close}>
              Close
            </Button>
          </div>
        </div>
      }
    >
      <div className={styles.metaRow}>
        <p className={styles.metaText}>
          Active versionId:{' '}
          {versionId ? <span className={styles.metaCode}>{versionId}</span> : <span className={styles.metaCode}>none</span>}
        </p>
        <div className={styles.footerRight}>
          <Link href="/samples" onClick={onboarding.close} className="rfHelperText" style={{ margin: 0 }}>
            Browse samples
          </Link>
          <span className="rfHelperText" style={{ margin: 0 }}>
            |
          </span>
          <Link href="/docs/getting-started" onClick={onboarding.close} className="rfHelperText" style={{ margin: 0 }}>
            Getting started
          </Link>
        </div>
      </div>

      <div className={styles.steps}>
        <section className={styles.stepCard}>
          <div className={styles.stepHeader}>
            <div>
              <p className={styles.stepTitle}>1) Create a new Config (tenantId + configId)</p>
              <p className={styles.stepText}>
                Create an empty DRAFT or clone a sample. This sets a versionId that Builder/Rules/Playground can load.
              </p>
            </div>
            {stepBadge(onboarding.isComplete('createConfig'))}
          </div>

          <div className={styles.stepActions}>
            <div style={{ display: 'grid', gap: 10, width: 'min(520px, 100%)' }}>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <div>
                  <label className="rfFieldLabel">Tenant Id</label>
                  <Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} disabled={creating} />
                </div>
                <div>
                  <label className="rfFieldLabel">Config Id</label>
                  <Input value={configId} onChange={(e) => setConfigId(e.target.value)} disabled={creating} />
                </div>
              </div>
              <div>
                <label className="rfFieldLabel">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} disabled={creating} />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Button size="sm" onClick={() => void createDraft()} disabled={creating || name.trim().length === 0}>
                  {creating ? 'Creating...' : 'Create draft'}
                </Button>
                <Link href="/docs/tutorial-console" onClick={onboarding.close} className="rfHelperText" style={{ margin: 0 }}>
                  Learn configId/version
                </Link>
              </div>
            </div>
          </div>

          <div style={{ height: 16 }} />
          <SamplesGallery
            onCloned={() => {
              onboarding.close();
            }}
          />
        </section>

        <section className={styles.stepCard}>
          <div className={styles.stepHeader}>
            <div>
              <p className={styles.stepTitle}>2) Build UI in Builder</p>
              <p className={styles.stepText}>
                Drag from **Component Palette**, reorder with drag/drop or **Move up/down**, then click **Save**.
              </p>
            </div>
            {stepBadge(onboarding.isComplete('editUi'))}
          </div>
          <div className={styles.stepActions}>
            <Button size="sm" onClick={openBuilder} disabled={!versionId}>
              Open Builder
            </Button>
            <Link href="/docs/tutorial-builder" onClick={onboarding.close} className="rfHelperText" style={{ margin: 0 }}>
              Builder tutorial
            </Link>
          </div>
          {!versionId ? <p className={styles.stepText}>Create or clone a config first to enable this step.</p> : null}
        </section>

        <section className={styles.stepCard}>
          <div className={styles.stepHeader}>
            <div>
              <p className={styles.stepTitle}>3) Add a Rule</p>
              <p className={styles.stepText}>
                Use the Rules Builder. Click <strong>Add starter rule</strong> then <strong>Save</strong>.
              </p>
            </div>
            {stepBadge(onboarding.isComplete('editRules'))}
          </div>
          <div className={styles.stepActions}>
            <Button size="sm" onClick={openRules} disabled={!versionId}>
              Open Rules Builder
            </Button>
            <Link href="/docs/tutorial-rules" onClick={onboarding.close} className="rfHelperText" style={{ margin: 0 }}>
              Rules tutorial
            </Link>
          </div>
        </section>

        <section className={styles.stepCard}>
          <div className={styles.stepHeader}>
            <div>
              <p className={styles.stepTitle}>4) Preview Mode (responsive canvas)</p>
              <p className={styles.stepText}>Click **Preview**, switch Desktop/Tablet/Mobile, then return to editing.</p>
            </div>
            {stepBadge(onboarding.isComplete('previewUi'))}
          </div>
          <div className={styles.stepActions}>
            <Button size="sm" onClick={openPreview} disabled={!versionId}>
              Open Preview Mode
            </Button>
            <Link href="/docs/tutorial-builder" onClick={onboarding.close} className="rfHelperText" style={{ margin: 0 }}>
              Responsive checklist
            </Link>
          </div>
        </section>

        <section className={styles.stepCard}>
          <div className={styles.stepHeader}>
            <div>
              <p className={styles.stepTitle}>5) Save to DB (DRAFT version)</p>
              <p className={styles.stepText}>
                Save is blocked until the schema validates. Fix issues, then click <strong>Save</strong> in Builder.
              </p>
            </div>
            {stepBadge(onboarding.isComplete('saveDb'))}
          </div>
          <div className={styles.stepActions}>
            <Button size="sm" onClick={openBuilder} disabled={!versionId}>
              Back to Builder
            </Button>
            <Link href="/docs/wcag" onClick={onboarding.close} className="rfHelperText" style={{ margin: 0 }}>
              Validation gates
            </Link>
          </div>
        </section>

        <section className={styles.stepCard}>
          <div className={styles.stepHeader}>
            <div>
              <p className={styles.stepTitle}>6) Run in Playground</p>
              <p className={styles.stepText}>Change context or input values, click **Submit**, and generate a runtime trace.</p>
            </div>
            {stepBadge(onboarding.isComplete('runPlayground'))}
          </div>
          <div className={styles.stepActions}>
            <Button size="sm" onClick={() => openPlayground({ focusTrace: true })} disabled={!versionId}>
              Open Playground
            </Button>
            <Button size="sm" variant="outline" onClick={() => openPlayground({ autorun: 'submit', focusTrace: true })} disabled={!versionId}>
              Auto-run Submit
            </Button>
          </div>
        </section>

        <section className={styles.stepCard}>
          <div className={styles.stepHeader}>
            <div>
              <p className={styles.stepTitle}>7) Inspect Trace</p>
              <p className={styles.stepText}>
                Beginners should be able to answer: "What happened, and why?" Use Explain mode and inspect API calls.
              </p>
            </div>
            {stepBadge(onboarding.isComplete('inspectTrace'))}
          </div>
          <div className={styles.stepActions}>
            <Button size="sm" onClick={() => openPlayground({ autorun: 'submit', focusTrace: true, explain: true })} disabled={!versionId}>
              Open Trace + Explain
            </Button>
            <Link href="/docs/tutorial-playground" onClick={onboarding.close} className="rfHelperText" style={{ margin: 0 }}>
              Trace tutorial
            </Link>
          </div>
        </section>

        <section className={styles.stepCard}>
          <div className={styles.stepHeader}>
            <div>
              <p className={styles.stepTitle}>8) Console export/import</p>
              <p className={styles.stepText}>Open Console Versions tab, then use **Export** and **Import** in GitOps Package.</p>
            </div>
            {stepBadge(onboarding.isComplete('exportGitOps'))}
          </div>
          <div className={styles.stepActions}>
            <Button size="sm" onClick={openGitOps}>
              Open Console (Versions)
            </Button>
            <Link href="/docs/deployment" onClick={onboarding.close} className="rfHelperText" style={{ margin: 0 }}>
              GitOps docs
            </Link>
          </div>
        </section>
      </div>
    </Modal>
  );
}
