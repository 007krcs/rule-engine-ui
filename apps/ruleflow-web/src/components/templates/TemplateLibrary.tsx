'use client';

import { useEffect, useMemo, useState } from 'react';
import { builtinComponentDefinitions } from '@platform/component-registry';
import { PFButton, PFTextField, PFTypography } from '@platform/ui-kit';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/demo/api-client';
import type { TemplateCategory, TemplateSummary } from '@/templates/types';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import styles from './TemplateLibrary.module.scss';

const CATEGORY_ORDER: TemplateCategory[] = [
  'Admin Console screens',
  'Data/Operations screens',
  'Profile/Settings screens',
  'Communication screens',
];

type GetTemplatesResponse =
  | { ok: true; templates: TemplateSummary[] }
  | { ok: false; error: string };

export function TemplateLibrary() {
  const router = useRouter();
  const { toast } = useToast();

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);

  const componentNameByHint = useMemo(
    () => new Map(builtinComponentDefinitions().map((definition) => [definition.adapterHint, definition.displayName])),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const loadTemplates = async () => {
      setLoading(true);
      try {
        const result = await apiGet<GetTemplatesResponse>('/api/templates');
        if (!result.ok) throw new Error(result.error);
        if (cancelled) return;
        setTemplates(result.templates);
      } catch (error) {
        if (cancelled) return;
        toast({
          variant: 'error',
          title: 'Unable to load templates',
          description: error instanceof Error ? error.message : String(error),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadTemplates();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return templates;
    return templates.filter((template) => {
      const blob = [
        template.name,
        template.purpose,
        template.requiredData.join(' '),
        template.components.join(' '),
        template.customizable.join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(needle);
    });
  }, [query, templates]);

  const grouped = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        items: filtered.filter((template) => template.category === category),
      })),
    [filtered],
  );

  return (
    <section className={styles.root} data-testid="template-library">
      <header className={styles.header}>
        <div>
          <PFTypography variant="h3">Template Library</PFTypography>
          <PFTypography variant="body2" muted>
            Choose a starter screen, then customize data, labels, rules, preview, and publish without writing code.
          </PFTypography>
        </div>

        <div className={styles.searchWrap}>
          <PFTextField
            id="template-search"
            label="Search templates"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try: orders, profile, files, messaging"
            data-testid="template-library-search"
          />
        </div>
      </header>

      {loading ? <p className={styles.loading}>Loading templates...</p> : null}
      {!loading && filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <PFTypography variant="h5">No matching templates</PFTypography>
          <PFTypography variant="body2" muted>
            Try a broader search term or clear the filter.
          </PFTypography>
        </div>
      ) : null}

      <div className={styles.sections}>
        {grouped.map((group) => (
          <section key={group.category} className={styles.section}>
            <div className={styles.sectionHeader}>
              <PFTypography variant="h5">{group.category}</PFTypography>
              <span className={styles.sectionCount}>{group.items.length}</span>
            </div>

            <div className={styles.cards}>
              {group.items.map((template) => (
                <article
                  key={template.id}
                  className={styles.card}
                  data-testid={`template-card-${template.id}`}
                >
                  <div className={cn(styles.preview, previewToneClass(template.screenshotTone, styles))}>
                    <p className={styles.previewTitle}>{template.name}</p>
                    <p className={styles.previewSubtitle}>Responsive preset</p>
                  </div>

                  <div className={styles.cardBody}>
                    <h3 className={styles.cardTitle}>{template.name}</h3>

                    <p className={styles.blockLabel}>What this section is for</p>
                    <p className={styles.blockText}>{template.purpose}</p>

                    <p className={styles.blockLabel}>What data it needs</p>
                    <ul className={styles.list}>
                      {template.requiredData.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>

                    <p className={styles.blockLabel}>What you can customize</p>
                    <ul className={styles.list}>
                      {template.customizable.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>

                    <p className={styles.blockLabel}>Components used</p>
                    <div className={styles.chips}>
                      {template.components.map((adapterHint) => (
                        <span key={adapterHint} className={styles.chip}>
                          {componentNameByHint.get(adapterHint) ?? adapterHint}
                        </span>
                      ))}
                    </div>
                  </div>

                  <footer className={styles.cardFooter}>
                    <PFButton
                      size="sm"
                      onClick={() => {
                        router.push(`/builder?template=${encodeURIComponent(template.id)}&checklist=1`);
                      }}
                      data-testid={`template-apply-${template.id}`}
                    >
                      Apply template
                    </PFButton>
                    <span className={styles.footerHint}>Opens Builder and starts setup checklist</span>
                  </footer>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function previewToneClass(
  tone: TemplateSummary['screenshotTone'],
  module: Record<string, string>,
): string {
  if (tone === 'orders') return module.previewOrders ?? '';
  if (tone === 'profile') return module.previewProfile ?? '';
  if (tone === 'files') return module.previewFiles ?? '';
  return module.previewMessages ?? '';
}
