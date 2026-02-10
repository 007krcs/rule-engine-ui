'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { SamplesGallery } from '@/components/onboarding/samples-gallery';
import { useOnboarding } from '@/components/onboarding/onboarding-provider';
import styles from './onboarding-wizard.module.css';

function stepBadge(done: boolean) {
  return <Badge variant={done ? 'success' : 'muted'}>{done ? 'Done' : 'Todo'}</Badge>;
}

export function OnboardingWizard() {
  const router = useRouter();
  const onboarding = useOnboarding();
  const versionId = onboarding.state.activeVersionId;

  const openBuilder = () => {
    if (!versionId) return;
    onboarding.close();
    router.push(`/builder?versionId=${encodeURIComponent(versionId)}`);
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

  return (
    <Modal
      open={onboarding.state.open}
      title="Getting Started"
      description="Clone a sample config and walk through Builder, Rules, Playground, and Trace with zero dead ends."
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
          Active config:{' '}
          {versionId ? <span className={styles.metaCode}>{versionId}</span> : <span className={styles.metaCode}>none</span>}
        </p>
        <div className={styles.footerRight}>
          <Link href="/samples" onClick={onboarding.close} className="rfHelperText" style={{ margin: 0 }}>
            Browse samples
          </Link>
          <span className="rfHelperText" style={{ margin: 0 }}>
            |
          </span>
          <Link href="/docs/quickstart" onClick={onboarding.close} className="rfHelperText" style={{ margin: 0 }}>
            Beginner docs
          </Link>
        </div>
      </div>

      <div className={styles.steps}>
        <section className={styles.stepCard}>
          <div className={styles.stepHeader}>
            <div>
              <p className={styles.stepTitle}>1) Clone a sample config</p>
              <p className={styles.stepText}>This creates a DRAFT config version you can safely edit.</p>
            </div>
            {stepBadge(onboarding.isComplete('cloneSample'))}
          </div>
          <div style={{ height: 12 }} />
          <SamplesGallery
            onCloned={() => {
              onboarding.close();
            }}
          />
        </section>

        <section className={styles.stepCard}>
          <div className={styles.stepHeader}>
            <div>
              <p className={styles.stepTitle}>2) Open Builder and modify the UI</p>
              <p className={styles.stepText}>
                Drag any component onto the canvas, then hit <strong>Save</strong>.
              </p>
            </div>
            {stepBadge(onboarding.isComplete('editUi'))}
          </div>
          <div className={styles.stepActions}>
            <Button size="sm" onClick={openBuilder} disabled={!versionId}>
              Open UI Builder
            </Button>
            <Link href="/docs/schemas" onClick={onboarding.close} className="rfHelperText" style={{ margin: 0 }}>
              Learn UISchema
            </Link>
          </div>
          {!versionId ? <p className={styles.stepText}>Clone a sample first to enable this step.</p> : null}
        </section>

        <section className={styles.stepCard}>
          <div className={styles.stepHeader}>
            <div>
              <p className={styles.stepTitle}>3) Add a rule and save</p>
              <p className={styles.stepText}>
                Click <strong>Add starter rule</strong>, then <strong>Save</strong>. We will use Explain mode in the next step.
              </p>
            </div>
            {stepBadge(onboarding.isComplete('editRules'))}
          </div>
          <div className={styles.stepActions}>
            <Button size="sm" onClick={openRules} disabled={!versionId}>
              Open Rules Builder
            </Button>
            <Link href="/docs/concepts" onClick={onboarding.close} className="rfHelperText" style={{ margin: 0 }}>
              Learn rules + flow
            </Link>
          </div>
        </section>

        <section className={styles.stepCard}>
          <div className={styles.stepHeader}>
            <div>
              <p className={styles.stepTitle}>4) Run in Playground</p>
              <p className={styles.stepText}>Hit Submit and you will get a full runtime trace (flow + rules + API).</p>
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
              <p className={styles.stepTitle}>5) View trace and toggle Explain mode</p>
              <p className={styles.stepText}>
                Explain mode shows a per-rule match result so beginners can answer: “What happened, and why?”
              </p>
            </div>
            {stepBadge(onboarding.isComplete('explainTrace'))}
          </div>
          <div className={styles.stepActions}>
            <Button
              size="sm"
              onClick={() => openPlayground({ autorun: 'submit', focusTrace: true, explain: true })}
              disabled={!versionId}
            >
              Open Explain mode
            </Button>
            <Link href="/docs/quickstart" onClick={onboarding.close} className="rfHelperText" style={{ margin: 0 }}>
              Read beginner docs
            </Link>
          </div>
        </section>
      </div>
    </Modal>
  );
}

