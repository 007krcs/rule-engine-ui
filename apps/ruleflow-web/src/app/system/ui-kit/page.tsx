'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import {
  PFAlert,
  PFAvatar,
  PFBadge,
  PFBox,
  PFButton,
  PFCard,
  PFCardContent,
  PFCardHeader,
  PFChip,
  PFDialog,
  PFGrid,
  PFPagination,
  PFSelect,
  PFSkeleton,
  PFSnackbar,
  PFStack,
  PFTab,
  PFTabs,
  PFTable,
  PFTextField,
  PFTooltip,
  PFTypography,
} from '@platform/ui-kit';
import { useTheme } from '@/components/layout/theme-provider';
import styles from './ui-kit.module.css';

const groups = [
  {
    id: 'inputs',
    title: 'Inputs',
    components: ['PFTextField', 'PFSelect', 'PFCheckbox', 'PFRadio', 'PFSwitch', 'PFSlider', 'PFAutocomplete'],
    code: `<PFTextField id="email" label="Email" helperText="We'll never share this." />
<PFSelect options={[{ value: 'ops', label: 'Operations' }]} />`,
  },
  {
    id: 'data',
    title: 'Data Display',
    components: ['PFTypography', 'PFTable', 'PFAvatar', 'PFBadge', 'PFChip', 'PFDivider'],
    code: `<PFAvatar name="Alex Rivera" />
<PFChip intent="success">Active</PFChip>
<PFTable columns={columns} rows={rows} />`,
  },
  {
    id: 'feedback',
    title: 'Feedback',
    components: ['PFAlert', 'PFDialog', 'PFSnackbar', 'PFProgress', 'PFSkeleton', 'PFTooltip'],
    code: `<PFAlert intent="success" title="Saved">Deployment complete.</PFAlert>
<PFSnackbar open message="Job queued" />`,
  },
  {
    id: 'surfaces',
    title: 'Surfaces',
    components: ['PFCard', 'PFCardHeader', 'PFCardContent', 'PFCardActions'],
    code: `<PFCard>
  <PFCardHeader>Title</PFCardHeader>
  <PFCardContent>Body</PFCardContent>
</PFCard>`,
  },
  {
    id: 'navigation',
    title: 'Navigation',
    components: ['PFTabs', 'PFTab', 'PFBreadcrumbs', 'PFMenu', 'PFPagination', 'PFStepper'],
    code: `<PFTabs value={tab} onChange={setTab}>
  <PFTab value="overview" label="Overview">...</PFTab>
</PFTabs>`,
  },
  {
    id: 'layout',
    title: 'Layout',
    components: ['PFBox', 'PFContainer', 'PFGrid', 'PFStack', 'PFAppBar', 'PFDrawer', 'PFAppShell'],
    code: `<PFGrid columns={12} gap={16}>
  <PFBox className="tile" />
</PFGrid>`,
  },
  {
    id: 'utils',
    title: 'Utils',
    components: ['pf-u-sr-only', 'pf-u-truncate', 'pf-u-focus-ring'],
    code: `<span className="pf-u-truncate">Very long value...</span>
<button className="pf-u-focus-ring">Focusable</button>`,
  },
] as const;

const roleOptions = [
  { value: '', label: 'Choose role', disabled: true },
  { value: 'author', label: 'Author' },
  { value: 'approver', label: 'Approver' },
  { value: 'publisher', label: 'Publisher' },
];

const sampleRows = [
  { name: 'Avery Johnson', role: 'Author', status: 'Draft' },
  { name: 'Jordan Lee', role: 'Approver', status: 'Review' },
];

export default function UiKitCatalogPage() {
  const { theme, density, brandPrimary, setTheme, setDensity, setBrandPrimary } = useTheme();
  const [tab, setTab] = useState('overview');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [primaryInput, setPrimaryInput] = useState(brandPrimary ?? '#2f6af5');
  const [screenPreset, setScreenPreset] = useState<'default' | 'console' | 'builder' | 'playground' | 'docs' | 'system'>('system');

  useEffect(() => {
    setPrimaryInput(brandPrimary ?? '#2f6af5');
  }, [brandPrimary]);

  const updatePrimary = (value: string): void => {
    setPrimaryInput(value);
    if (isHexColor(value)) {
      setBrandPrimary(value);
    }
  };

  const handleThemeModeChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    setTheme(event.target.value as 'light' | 'dark');
  };

  const handleDensityChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    setDensity(event.target.value as 'comfortable' | 'compact');
  };

  const handlePrimaryInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    updatePrimary(event.target.value);
  };

  const handleScreenPresetChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    setScreenPreset(event.target.value as 'default' | 'console' | 'builder' | 'playground' | 'docs' | 'system');
  };

  return (
    <div className={styles.page} data-pf-screen={screenPreset}>
      <PFCard elevated>
        <PFCardHeader>
          <div className={styles.headerBlock}>
            <PFTypography variant="h2">Platform UI Kit</PFTypography>
            <PFTypography variant="body2" muted>
              Enterprise component catalog for token-driven platform UI primitives.
            </PFTypography>
          </div>
        </PFCardHeader>
        <PFCardContent className={styles.controlsGrid}>
          <PFSelect
            aria-label="Theme mode"
            value={theme}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            onChange={handleThemeModeChange}
          />
          <PFSelect
            aria-label="Density mode"
            value={density}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
            onChange={handleDensityChange}
          />
          <PFSelect
            aria-label="Screen preset"
            value={screenPreset}
            options={[
              { value: 'default', label: 'Default' },
              { value: 'console', label: 'Console' },
              { value: 'builder', label: 'Builder' },
              { value: 'playground', label: 'Playground' },
              { value: 'docs', label: 'Docs' },
              { value: 'system', label: 'System' },
            ]}
            onChange={handleScreenPresetChange}
          />
          <PFTextField
            id="brand-primary"
            label="Brand primary"
            value={primaryInput}
            onChange={handlePrimaryInputChange}
            helperText="Hex color (#RRGGBB). Applied live to --pf-color-primary-*."
            error={!isHexColor(primaryInput)}
          />
        </PFCardContent>
      </PFCard>

      <div className={styles.groupGrid}>
        {groups.map((group) => (
          <PFCard key={group.id} className={styles.groupCard}>
            <PFCardHeader>
              <PFTypography variant="h4">{group.title}</PFTypography>
            </PFCardHeader>
            <PFCardContent>
              <ul className={styles.componentList}>
                {group.components.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>

              <div className={styles.preview}>{renderPreview(group.id, tab, setTab, setDialogOpen, setSnackbarOpen)}</div>

              <pre className={styles.snippet}>
                <code>{group.code}</code>
              </pre>
            </PFCardContent>
          </PFCard>
        ))}
      </div>

      <PFDialog
        open={dialogOpen}
        title="Publish Change Set"
        description="Confirm deployment for 3 tenants."
        onClose={() => setDialogOpen(false)}
        actions={(
          <div className={styles.modalActions}>
            <PFButton variant="outline" intent="neutral" onClick={() => setDialogOpen(false)}>
              Cancel
            </PFButton>
            <PFButton onClick={() => setDialogOpen(false)}>Confirm</PFButton>
          </div>
        )}
      >
        <PFTypography variant="body2">
          This is a catalog preview for the PFDialog slot-based API.
        </PFTypography>
      </PFDialog>

      <PFSnackbar
        open={snackbarOpen}
        onClose={() => setSnackbarOpen(false)}
        title="Deployment queued"
        message="Rollout started in us-east-1"
        intent="success"
        autoHideDuration={1800}
      />
    </div>
  );
}

function renderPreview(
  group: (typeof groups)[number]['id'],
  tab: string,
  setTab: (value: string) => void,
  setDialogOpen: (open: boolean) => void,
  setSnackbarOpen: (open: boolean) => void,
) {
  switch (group) {
    case 'inputs':
      return (
        <PFStack gap={12}>
          <PFTextField id="catalog-email" label="Email" placeholder="name@company.com" helperText="Used for alerts." />
          <PFSelect aria-label="Role" value="" options={roleOptions} onChange={() => undefined} />
        </PFStack>
      );
    case 'data':
      return (
        <PFStack gap={12}>
          <PFStack direction="row" gap={10} align="center">
            <PFAvatar name="Alex Rivera" />
            <PFChip intent="success">Active</PFChip>
            <PFBadge badgeContent={4} intent="primary">
              <span className={styles.badgeTarget}>Tasks</span>
            </PFBadge>
          </PFStack>
          <PFTable
            columns={[
              { id: 'name', header: 'Name' },
              { id: 'role', header: 'Role' },
              { id: 'status', header: 'Status', align: 'right' },
            ]}
            rows={sampleRows}
          />
        </PFStack>
      );
    case 'feedback':
      return (
        <PFStack gap={12}>
          <PFAlert intent="success" title="Policy Sync Complete">
            18 policies were validated with no blocking issues.
          </PFAlert>
          <PFStack direction="row" gap={8}>
            <PFButton size="sm" onClick={() => setDialogOpen(true)}>
              Open Dialog
            </PFButton>
            <PFButton size="sm" variant="outline" intent="neutral" onClick={() => setSnackbarOpen(true)}>
              Trigger Snackbar
            </PFButton>
            <PFTooltip content="Latency SLO: 98ms p95">
              <PFButton size="sm" variant="ghost" intent="neutral">
                Tooltip
              </PFButton>
            </PFTooltip>
          </PFStack>
          <PFSkeleton variant="rounded" width={240} height={24} />
        </PFStack>
      );
    case 'surfaces':
      return (
        <PFCard elevated>
          <PFCardHeader>
            <PFTypography variant="h5">Quarterly Rollout</PFTypography>
            <PFChip intent="primary">Q1</PFChip>
          </PFCardHeader>
          <PFCardContent>
            <PFTypography variant="body2" muted>
              High-priority schema migration across 4 business units.
            </PFTypography>
          </PFCardContent>
        </PFCard>
      );
    case 'navigation':
      return (
        <PFStack gap={12}>
          <PFTabs value={tab} onChange={setTab}>
            <PFTab value="overview" label="Overview">
              <PFTypography variant="body2">Overview content</PFTypography>
            </PFTab>
            <PFTab value="audit" label="Audit">
              <PFTypography variant="body2">Audit content</PFTypography>
            </PFTab>
          </PFTabs>
          <PFPagination count={7} page={3} />
        </PFStack>
      );
    case 'layout':
      return (
        <PFGrid columns={3} gap={12} className={styles.layoutGrid}>
          <PFBox className={styles.layoutTile}>A</PFBox>
          <PFBox className={styles.layoutTile}>B</PFBox>
          <PFBox className={styles.layoutTile}>C</PFBox>
        </PFGrid>
      );
    case 'utils':
      return (
        <div className={styles.utilsPreview}>
          <span className={styles.utilsLabel}>Truncate:</span>
          <span className="pf-u-truncate">
            Very long branch name: tenant-eu-west-production-workflow-2026
          </span>
          <button type="button" className={styles.focusDemo}>
            Focus ring demo
          </button>
        </div>
      );
    default:
      return null;
  }
}

function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}
