'use client';

import React, { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { ComponentDefinition } from '@platform/component-registry';
import {
  PFAccordion,
  PFAlert,
  PFAutocomplete,
  PFAvatar,
  PFBackdrop,
  PFBadge,
  PFBox,
  PFBreadcrumbs,
  PFButton,
  PFCard,
  PFCardContent,
  PFCardHeader,
  PFCheckbox,
  PFChip,
  PFDialog,
  PFDivider,
  PFDrawer,
  PFGrid,
  PFMenu,
  PFMenuItem,
  PFPagination,
  PFPopover,
  PFProgressCircular,
  PFProgressLinear,
  PFRadio,
  PFSelect,
  PFSkeleton,
  PFSlider,
  PFStack,
  PFStepper,
  PFSwitch,
  PFTab,
  PFTabs,
  PFTable,
  PFTextArea,
  PFTextField,
  PFToolbar,
  PFTooltip,
  PFTypography,
  PFAppBar,
  PFContainer,
  PFDateField,
  PFTimeField,
  PFDateTimeField,
  PFCalendar,
  PFClock,
} from '@platform/ui-kit';
import styles from './UiKitPreview.module.scss';

export interface UiKitPreviewProps {
  component: ComponentDefinition | null;
  values: Record<string, unknown>;
}

type PreviewContext = {
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  popoverOpen: boolean;
  setPopoverOpen: (open: boolean) => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  tabValue: string;
  setTabValue: (value: string) => void;
};

export function UiKitPreview({ component, values }: UiKitPreviewProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tabValue, setTabValue] = useState('overview');
  const popoverAnchorRef = useRef<HTMLButtonElement | null>(null);

  const context: PreviewContext = useMemo(
    () => ({
      dialogOpen,
      setDialogOpen,
      drawerOpen,
      setDrawerOpen,
      popoverOpen,
      setPopoverOpen,
      menuOpen,
      setMenuOpen,
      tabValue,
      setTabValue,
    }),
    [dialogOpen, drawerOpen, popoverOpen, menuOpen, tabValue],
  );

  useEffect(() => {
    setDialogOpen(false);
    setDrawerOpen(false);
    setPopoverOpen(false);
    setMenuOpen(false);
  }, [component?.adapterHint]);

  if (!component) {
    return (
      <section className={styles.empty}>
        <PFTypography variant="h5">Select a component</PFTypography>
        <PFTypography variant="body2" muted>
          Choose a component from the catalog to start exploring previews, props, and docs.
        </PFTypography>
      </section>
    );
  }

  const preview = renderPreview(component, values, context, popoverAnchorRef);
  return (
    <section className={styles.preview} data-testid="ui-kit-preview">
      {preview}
    </section>
  );
}

function renderPreview(
  component: ComponentDefinition,
  values: Record<string, unknown>,
  context: PreviewContext,
  popoverAnchorRef: RefObject<HTMLButtonElement | null>,
) {
  const hint = component.adapterHint;
  const status = component.status ?? 'stable';
  if (status === 'planned') {
    return (
      <PFCard className={styles.placeholderCard}>
        <PFCardHeader>
          <PFTypography variant="h5">{component.displayName}</PFTypography>
          <PFChip intent="neutral">Planned</PFChip>
        </PFCardHeader>
        <PFCardContent>
          <PFTypography variant="body2" muted>
            This component is documented in the registry but not yet implemented in the platform UI kit.
          </PFTypography>
        </PFCardContent>
      </PFCard>
    );
  }

  switch (hint) {
    case 'platform.textField':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Customer Contact</PFTypography>
          </PFCardHeader>
          <PFCardContent className={styles.formContent}>
            <PFTextField
              id="preview-text-field"
              label={stringValue(values.label, 'Email')}
              placeholder={stringValue(values.placeholder, 'name@company.com')}
              helperText={stringValue(values.helperText, 'Used for incident alerts.')}
              required={booleanValue(values.required)}
            />
          </PFCardContent>
        </PFCard>
      );
    case 'platform.numberField':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Transaction Limit</PFTypography>
          </PFCardHeader>
          <PFCardContent className={styles.formContent}>
            <PFTextField
              id="preview-number-field"
              type="number"
              label={stringValue(values.label, 'Daily limit')}
              placeholder={stringValue(values.placeholder, '25000')}
              helperText={stringValue(values.helperText, 'Maximum approved amount.')}
              min={numberValue(values.min)}
              max={numberValue(values.max)}
            />
          </PFCardContent>
        </PFCard>
      );
    case 'platform.select':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Role Assignment</PFTypography>
          </PFCardHeader>
          <PFCardContent className={styles.formContent}>
            <PFTextField
              id="preview-select-label"
              label="Context"
              value="Operations Console"
              disabled
            />
            <PFSelect
              aria-label={stringValue(values.label, 'Role')}
              placeholder={stringValue(values.placeholder, 'Select role')}
              value={stringValue(values.value, '')}
              options={readOptions(values.options)}
              onChange={() => undefined}
            />
          </PFCardContent>
        </PFCard>
      );
    case 'platform.checkbox':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Policy Flags</PFTypography>
          </PFCardHeader>
          <PFCardContent className={styles.formContent}>
            <PFCheckbox
              id="preview-checkbox"
              checked={booleanValue(values.checked)}
              label={stringValue(values.label, 'Require manager approval')}
              helperText={stringValue(values.helperText, 'Applies to high-risk requests.')}
              onChange={() => undefined}
            />
          </PFCardContent>
        </PFCard>
      );
    case 'platform.radioGroup':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">{stringValue(values.label, 'Deployment mode')}</PFTypography>
          </PFCardHeader>
          <PFCardContent>
            <PFStack gap={8}>
              <PFRadio id="radio-safe" checked label="Safe rollout" onChange={() => undefined} />
              <PFRadio id="radio-balanced" label="Balanced rollout" onChange={() => undefined} />
              <PFRadio id="radio-fast" label="Fast rollout" onChange={() => undefined} />
            </PFStack>
          </PFCardContent>
        </PFCard>
      );
    case 'platform.switch':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Runtime Toggle</PFTypography>
          </PFCardHeader>
          <PFCardContent>
            <PFSwitch
              id="preview-switch"
              checked={booleanValue(values.checked, true)}
              label={stringValue(values.label, 'Enable fallback strategy')}
              onCheckedChange={() => undefined}
            />
          </PFCardContent>
        </PFCard>
      );
    case 'platform.slider':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Risk Threshold</PFTypography>
          </PFCardHeader>
          <PFCardContent>
            <PFSlider
              value={numberValue(values.value, 45)}
              min={numberValue(values.min, 0)}
              max={numberValue(values.max, 100)}
              onChange={() => undefined}
            />
          </PFCardContent>
        </PFCard>
      );
    case 'platform.autocomplete':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Search Tenants</PFTypography>
          </PFCardHeader>
          <PFCardContent>
            <PFAutocomplete
              id="preview-autocomplete"
              placeholder={stringValue(values.placeholder, 'Search tenant id')}
              options={[
                { value: 'tenant-us-west', label: 'tenant-us-west' },
                { value: 'tenant-eu-central', label: 'tenant-eu-central' },
                { value: 'tenant-ap-south', label: 'tenant-ap-south' },
              ]}
              loadOptions={
                booleanValue(values.async)
                  ? async (query) => {
                      await sleep(numberValue(values.debounceMs, 200));
                      return [
                        { value: `${query || 'tenant'}-alpha`, label: `${query || 'tenant'}-alpha` },
                        { value: `${query || 'tenant'}-beta`, label: `${query || 'tenant'}-beta` },
                      ];
                    }
                  : undefined
              }
              debounceMs={numberValue(values.debounceMs, 240)}
              onValueChange={() => undefined}
            />
          </PFCardContent>
        </PFCard>
      );
    case 'platform.dateField':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Go-Live Date</PFTypography>
          </PFCardHeader>
          <PFCardContent className={styles.formContent}>
            <PFDateField
              id="preview-date-field"
              label={stringValue(values.label, 'Effective date')}
              helperText={stringValue(values.helperText, 'Stored in ISO date format')}
              value={stringValue(values.value, '2026-03-15')}
              minDate={stringValue(values.minDate, '2026-01-01')}
              maxDate={stringValue(values.maxDate, '2026-12-31')}
              timezone={stringValue(values.timezone, 'UTC')}
              displayFormat={displayFormatValue(values.displayFormat)}
              onValueChange={() => undefined}
            />
          </PFCardContent>
        </PFCard>
      );
    case 'platform.timeField':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Cutoff Time</PFTypography>
          </PFCardHeader>
          <PFCardContent className={styles.formContent}>
            <PFTimeField
              id="preview-time-field"
              label={stringValue(values.label, 'Cutoff time')}
              helperText={stringValue(values.helperText, 'Use 24-hour format')}
              value={stringValue(values.value, '17:30')}
              minTime={stringValue(values.minTime, '08:00')}
              maxTime={stringValue(values.maxTime, '20:00')}
              step={numberValue(values.step, 300)}
              onValueChange={() => undefined}
            />
          </PFCardContent>
        </PFCard>
      );
    case 'platform.dateTimeField':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Maintenance Window</PFTypography>
          </PFCardHeader>
          <PFCardContent className={styles.formContent}>
            <PFDateTimeField
              id="preview-date-time-field"
              label={stringValue(values.label, 'Start date and time')}
              helperText={stringValue(values.helperText, 'Renderer stores ISO timestamp')}
              value={stringValue(values.value, '2026-04-18T09:30')}
              minDateTime={stringValue(values.minDateTime, '2026-01-01T00:00')}
              maxDateTime={stringValue(values.maxDateTime, '2026-12-31T23:59')}
              onValueChange={() => undefined}
            />
          </PFCardContent>
        </PFCard>
      );
    case 'platform.calendar':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Launch Calendar</PFTypography>
          </PFCardHeader>
          <PFCardContent className={styles.formContent}>
            <PFCalendar
              value={stringValue(values.value, '2026-06-15')}
              minDate={stringValue(values.minDate, '2026-01-01')}
              maxDate={stringValue(values.maxDate, '2026-12-31')}
              timezone={stringValue(values.timezone, 'UTC')}
              onValueChange={() => undefined}
            />
          </PFCardContent>
        </PFCard>
      );
    case 'platform.clock':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Regional Clock</PFTypography>
          </PFCardHeader>
          <PFCardContent className={styles.formContent}>
            <PFClock
              timezone={stringValue(values.timezone, 'America/New_York')}
              picker={booleanValue(values.picker)}
              showSeconds={booleanValue(values.showSeconds)}
              value={stringValue(values.value, '09:15')}
              onValueChange={() => undefined}
            />
          </PFCardContent>
        </PFCard>
      );
    case 'platform.textareaAutosize':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Change Notes</PFTypography>
          </PFCardHeader>
          <PFCardContent className={styles.formContent}>
            <label htmlFor="preview-textarea" className={styles.inlineLabel}>
              {stringValue(values.label, 'Release notes')}
            </label>
            <PFTextArea
              id="preview-textarea"
              defaultValue="This release improves rule latency and validation coverage."
              rows={numberValue(values.minRows, 4)}
            />
          </PFCardContent>
        </PFCard>
      );
    case 'platform.inputAdornment':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Budget Limit</PFTypography>
          </PFCardHeader>
          <PFCardContent>
            <PFTextField
              id="preview-input-adornment"
              label="Amount"
              placeholder="25000"
              startAdornment={stringValue(values.position, 'start') === 'start' ? '$' : undefined}
              endAdornment={stringValue(values.position, 'start') === 'end' ? stringValue(values.text, 'USD') : undefined}
            />
          </PFCardContent>
        </PFCard>
      );
    case 'platform.avatar':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Review Owners</PFTypography>
          </PFCardHeader>
          <PFCardContent className={styles.row}>
            <PFAvatar name={stringValue(values.name, 'Priya Shah')} src={stringValue(values.src, '') || undefined} />
            <PFAvatar name="Alex Kim" />
            <PFAvatar name="Jordan Lee" />
          </PFCardContent>
        </PFCard>
      );
    case 'platform.badge':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Queue Indicators</PFTypography>
          </PFCardHeader>
          <PFCardContent className={styles.row}>
            <PFBadge badgeContent={numberValue(values.badgeContent, 7)} intent="primary">
              <PFButton variant="outline" intent="neutral">Open Tasks</PFButton>
            </PFBadge>
          </PFCardContent>
        </PFCard>
      );
    case 'platform.chip':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Environment Status</PFTypography>
          </PFCardHeader>
          <PFCardContent className={styles.row}>
            <PFChip intent="success">Production</PFChip>
            <PFChip intent="warn">Staging</PFChip>
            <PFChip intent="neutral">Sandbox</PFChip>
          </PFCardContent>
        </PFCard>
      );
    case 'platform.divider':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Section Delimiters</PFTypography>
          </PFCardHeader>
          <PFCardContent className={styles.formContent}>
            <PFTypography variant="body2">Before divider</PFTypography>
            <PFDivider />
            <PFTypography variant="body2">After divider</PFTypography>
          </PFCardContent>
        </PFCard>
      );
    case 'platform.svgIcon':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">SVG Icon</PFTypography>
          </PFCardHeader>
          <PFCardContent className={styles.row}>
            <div className={styles.iconPreview} aria-label={stringValue(values.name, 'Icon preview')}>
              <svg
                width={numberValue(values.size, 24)}
                height={numberValue(values.size, 24)}
                viewBox="0 0 24 24"
                fill={stringValue(values.color, '#2e7d32')}
                role="img"
              >
                <path d={stringValue(values.path, 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-1 14-4-4 1.4-1.4L11 13.2l5.6-5.6L18 9z')} />
              </svg>
            </div>
            <PFTypography variant="body2" muted>
              {stringValue(values.name, 'checkCircle')}
            </PFTypography>
          </PFCardContent>
        </PFCard>
      );
    case 'platform.imageList': {
      const images = readImageItems(values.images);
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Image List</PFTypography>
          </PFCardHeader>
          <PFCardContent>
            <div
              className={styles.imageList}
              style={{
                gridTemplateColumns: `repeat(${numberValue(values.columns, 3)}, minmax(0, 1fr))`,
                gap: `${numberValue(values.gap, 10)}px`,
              }}
            >
              {images.map((image) => (
                <figure key={`${image.src}-${image.title}`} className={styles.imageTile}>
                  <img src={image.src} alt={image.alt} />
                  <figcaption>{image.title}</figcaption>
                </figure>
              ))}
            </div>
          </PFCardContent>
        </PFCard>
      );
    }
    case 'platform.table':
      return (
        <PFCard>
          <PFCardHeader className={styles.cardToolbar}>
            <PFTypography variant="h5">Policy Matrix</PFTypography>
            <PFButton size="sm" variant="outline" intent="neutral">Export CSV</PFButton>
          </PFCardHeader>
          <PFCardContent>
            <PFTable
              columns={[
                { id: 'policy', header: 'Policy' },
                { id: 'owner', header: 'Owner' },
                { id: 'status', header: 'Status', align: 'right' },
              ]}
              rows={[
                { policy: 'checkout-validation', owner: 'Ops', status: 'Active' },
                { policy: 'regional-pricing', owner: 'Finance', status: 'Review' },
                { policy: 'fraud-escalation', owner: 'Risk', status: 'Draft' },
              ]}
            />
          </PFCardContent>
        </PFCard>
      );
    case 'platform.tooltip':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Inline Help</PFTypography>
          </PFCardHeader>
          <PFCardContent className={styles.row}>
            <PFTooltip content={stringValue(values.content, 'Last sync: 2m ago')} placement={placementValue(values.placement)}>
              <PFButton size="sm" variant="ghost" intent="neutral">Hover for details</PFButton>
            </PFTooltip>
          </PFCardContent>
        </PFCard>
      );
    case 'platform.typography':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Typography Scale</PFTypography>
          </PFCardHeader>
          <PFCardContent className={styles.formContent}>
            <PFTypography variant={typographyVariant(values.variant)}>Schema Runtime Platform</PFTypography>
            <PFTypography variant="body2" muted>
              Token-driven typography keeps experiences consistent across tenant experiences.
            </PFTypography>
          </PFCardContent>
        </PFCard>
      );
    case 'platform.alert':
      return (
        <PFAlert
          intent={intentValue(values.intent)}
          title={stringValue(values.title, 'Deployment Status')}
        >
          No blocking issues detected in the last validation run.
        </PFAlert>
      );
    case 'platform.snackbar':
      return (
        <>
          <PFCard>
            <PFCardContent className={styles.row}>
              <PFButton size="sm" onClick={() => context.setDialogOpen(true)}>Trigger toast</PFButton>
            </PFCardContent>
          </PFCard>
          <PFAlert intent="neutral" title="Snackbar Preview">
            Snackbar is rendered as an overlay and auto-dismisses.
          </PFAlert>
          <PFDialog
            open={context.dialogOpen}
            title="Trigger Snackbar"
            description="Close this dialog to see snackbar example."
            onClose={() => context.setDialogOpen(false)}
            actions={(
              <PFButton size="sm" onClick={() => context.setDialogOpen(false)}>
                Continue
              </PFButton>
            )}
          >
            <PFTypography variant="body2">Use the component explorer in runtime flow for toast examples.</PFTypography>
          </PFDialog>
        </>
      );
    case 'platform.dialog': {
      const controlledOpen = booleanValue(values.open);
      const open = controlledOpen || context.dialogOpen;
      return (
        <PFCard>
          <PFCardHeader className={styles.cardToolbar}>
            <div>
              <PFTypography variant="h5">Release Confirmation</PFTypography>
              <PFTypography variant="body2" muted>
                Toggle prop <code>open</code> from right panel or use button trigger.
              </PFTypography>
            </div>
            <PFButton size="sm" onClick={() => context.setDialogOpen(true)}>
              Open dialog
            </PFButton>
          </PFCardHeader>
          <PFCardContent>
            <PFTypography variant="body2" muted>
              Dialogs keep decision actions sticky at the bottom for low-height viewports.
            </PFTypography>
          </PFCardContent>

          <PFDialog
            open={open}
            title={stringValue(values.title, 'Approval required')}
            description={stringValue(values.description, 'Review impact before publishing this configuration.')}
            size={dialogSize(values.size)}
            onClose={() => context.setDialogOpen(false)}
            actions={(
              <>
                <PFButton variant="outline" intent="neutral" onClick={() => context.setDialogOpen(false)}>
                  Cancel
                </PFButton>
                <PFButton onClick={() => context.setDialogOpen(false)}>
                  Approve
                </PFButton>
              </>
            )}
          >
            <PFStack gap={10}>
              <PFTypography variant="body2">
                This preview demonstrates sticky dialog chrome and scroll ownership.
              </PFTypography>
              <PFTypography variant="body2" muted>
                Actions remain visible on laptop-height screens.
              </PFTypography>
            </PFStack>
          </PFDialog>
        </PFCard>
      );
    }
    case 'platform.progressLinear':
      return <PFProgressLinear value={numberValue(values.value, 62)} indeterminate={booleanValue(values.indeterminate)} />;
    case 'platform.progressCircular':
      return <PFProgressCircular value={numberValue(values.value, 72)} indeterminate={booleanValue(values.indeterminate)} />;
    case 'platform.skeleton':
      return (
        <PFCard>
          <PFCardContent className={styles.formContent}>
            <PFSkeleton variant="text" width="50%" animated={booleanValue(values.animated, true)} />
            <PFSkeleton variant="rounded" height={18} animated={booleanValue(values.animated, true)} />
            <PFSkeleton variant="circular" animated={booleanValue(values.animated, true)} />
          </PFCardContent>
        </PFCard>
      );
    case 'platform.accordion':
      return (
        <PFAccordion title={stringValue(values.title, 'Regional rollout plan')} defaultExpanded={booleanValue(values.defaultExpanded, true)}>
          <PFTypography variant="body2">
            Region-specific rules are validated before activation.
          </PFTypography>
        </PFAccordion>
      );
    case 'platform.appBar':
    case 'platform.toolbar':
      return (
        <PFCard>
          <PFCardContent>
            <PFAppBar position="static">
              <PFToolbar className={styles.toolbar}>
                <PFTypography variant="h6">ECR Workspace</PFTypography>
                <PFStack direction="row" gap={8}>
                  <PFButton size="sm" variant="ghost" intent="neutral">Docs</PFButton>
                  <PFButton size="sm">Deploy</PFButton>
                </PFStack>
              </PFToolbar>
            </PFAppBar>
          </PFCardContent>
        </PFCard>
      );
    case 'platform.card':
      return (
        <PFCard elevated={booleanValue(values.elevated, true)}>
          <PFCardHeader>
            <PFTypography variant="h5">Quarterly Governance Review</PFTypography>
            <PFChip intent="primary">Q1</PFChip>
          </PFCardHeader>
          <PFCardContent>
            <PFTypography variant="body2" muted>
              This card demonstrates default spacing and typography behavior.
            </PFTypography>
          </PFCardContent>
        </PFCard>
      );
    case 'platform.paper':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Paper Surface</PFTypography>
          </PFCardHeader>
          <PFCardContent>
            <div
              className={styles.paperDemo}
              style={{
                padding: `${numberValue(values.padding, 16)}px`,
                boxShadow: numberValue(values.elevation, 1) > 0 ? '0 8px 18px rgba(20, 22, 31, 0.08)' : 'none',
                borderStyle: booleanValue(values.outlined, true) ? 'solid' : 'none',
              }}
            >
              <PFTypography variant="body2">Paper is a generic surface container for grouped content.</PFTypography>
            </div>
          </PFCardContent>
        </PFCard>
      );
    case 'platform.backdrop':
      return (
        <PFCard>
          <PFCardHeader className={styles.cardToolbar}>
            <PFTypography variant="h5">Backdrop</PFTypography>
            <PFButton size="sm" onClick={() => context.setDialogOpen(!context.dialogOpen)}>
              Toggle
            </PFButton>
          </PFCardHeader>
          <PFCardContent>
            <PFTypography variant="body2" muted>
              Backdrop provides an overlay layer for modal contexts.
            </PFTypography>
          </PFCardContent>
          <PFBackdrop open={context.dialogOpen} onClick={() => context.setDialogOpen(false)} />
        </PFCard>
      );
    case 'platform.breadcrumbs':
      return (
        <PFBreadcrumbs
          items={[
            { id: 'home', label: 'Home', href: '#' },
            { id: 'console', label: 'Console', href: '#' },
            { id: 'versions', label: 'Versions', current: true },
          ]}
        />
      );
    case 'platform.drawer': {
      const controlledOpen = booleanValue(values.open);
      const open = controlledOpen || context.drawerOpen;
      return (
        <PFCard>
          <PFCardHeader className={styles.cardToolbar}>
            <PFTypography variant="h5">Responsive Drawer</PFTypography>
            <PFButton size="sm" onClick={() => context.setDrawerOpen(true)}>
              Open drawer
            </PFButton>
          </PFCardHeader>
          <PFCardContent>
            <PFTypography variant="body2" muted>
              Drawer is constrained and keyboard dismissible.
            </PFTypography>
          </PFCardContent>
          <PFDrawer
            open={open}
            side={stringValue(values.side, 'left') === 'right' ? 'right' : 'left'}
            width={numberValue(values.width, 320)}
            title="Navigation"
            onClose={() => context.setDrawerOpen(false)}
          >
            <PFStack gap={8}>
              <PFButton variant="ghost" intent="neutral">Overview</PFButton>
              <PFButton variant="ghost" intent="neutral">Builder</PFButton>
              <PFButton variant="ghost" intent="neutral">Console</PFButton>
            </PFStack>
          </PFDrawer>
        </PFCard>
      );
    }
    case 'platform.menu':
    case 'platform.menuItem':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Context Actions</PFTypography>
          </PFCardHeader>
          <PFCardContent>
            <PFMenu
              triggerLabel={stringValue(values.triggerLabel, 'Open menu')}
              open={context.menuOpen}
              onOpenChange={context.setMenuOpen}
            >
              <li role="none"><PFMenuItem onClick={() => context.setMenuOpen(false)}>Edit</PFMenuItem></li>
              <li role="none"><PFMenuItem onClick={() => context.setMenuOpen(false)}>Duplicate</PFMenuItem></li>
              <li role="none"><PFMenuItem onClick={() => context.setMenuOpen(false)} disabled>Delete</PFMenuItem></li>
            </PFMenu>
          </PFCardContent>
        </PFCard>
      );
    case 'platform.pagination':
      return (
        <PFPagination
          count={numberValue(values.count, 12)}
          page={numberValue(values.page, 3)}
          onPageChange={() => undefined}
        />
      );
    case 'platform.bottomNavigation': {
      const items = readNavigationItems(values.items);
      const active = stringValue(values.value, items[0]?.value ?? 'home');
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Bottom Navigation</PFTypography>
          </PFCardHeader>
          <PFCardContent>
            <nav className={styles.bottomNav} aria-label="Bottom navigation preview">
              {items.map((item) => (
                <button key={item.value} type="button" className={active === item.value ? styles.bottomNavActive : ''}>
                  {item.label}
                </button>
              ))}
            </nav>
          </PFCardContent>
        </PFCard>
      );
    }
    case 'platform.link':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Link</PFTypography>
          </PFCardHeader>
          <PFCardContent>
            <a
              className={styles.linkDemo}
              href={stringValue(values.href, '/docs/tutorial-builder')}
              target={stringValue(values.target, '_self')}
              rel={stringValue(values.target, '_self') === '_blank' ? 'noreferrer' : undefined}
            >
              {stringValue(values.label, 'Open deployment runbook')}
            </a>
          </PFCardContent>
        </PFCard>
      );
    case 'platform.speedDial': {
      const actions = readSpeedDialActions(values.actions);
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Speed Dial</PFTypography>
          </PFCardHeader>
          <PFCardContent className={styles.speedDialPreview}>
            {actions.map((action) => (
              <PFButton key={action.id} size="sm" variant="outline" intent="neutral">
                {action.label}
              </PFButton>
            ))}
          </PFCardContent>
        </PFCard>
      );
    }
    case 'platform.stepper':
      return (
        <PFStepper
          activeStep={numberValue(values.activeStep, 1)}
          steps={[
            { id: 'draft', label: 'Draft' },
            { id: 'review', label: 'Review' },
            { id: 'approved', label: 'Approved' },
          ]}
        />
      );
    case 'platform.tabs':
      return (
        <PFTabs value={context.tabValue} onChange={context.setTabValue}>
          <PFTab value="overview" label="Overview">
            <PFTypography variant="body2">Overview content panel.</PFTypography>
          </PFTab>
          <PFTab value="audit" label="Audit">
            <PFTypography variant="body2">Audit history panel.</PFTypography>
          </PFTab>
          <PFTab value="history" label="History">
            <PFTypography variant="body2">Deployment history panel.</PFTypography>
          </PFTab>
        </PFTabs>
      );
    case 'platform.box':
      return (
        <PFCard>
          <PFCardContent>
            <PFBox className={styles.boxDemo}>Generic layout wrapper used as foundation for page composition.</PFBox>
          </PFCardContent>
        </PFCard>
      );
    case 'platform.container':
      return (
        <PFCard>
          <PFCardContent>
            <PFContainer className={styles.containerDemo}>
              <PFTypography variant="body2">Container constrains reading width and preserves rhythm.</PFTypography>
            </PFContainer>
          </PFCardContent>
        </PFCard>
      );
    case 'platform.grid':
      return (
        <PFGrid columns={numberValue(values.columns, 3)} gap={numberValue(values.gap, 12)}>
          <PFCard><PFCardContent><PFTypography variant="body2">Tile A</PFTypography></PFCardContent></PFCard>
          <PFCard><PFCardContent><PFTypography variant="body2">Tile B</PFTypography></PFCardContent></PFCard>
          <PFCard><PFCardContent><PFTypography variant="body2">Tile C</PFTypography></PFCardContent></PFCard>
        </PFGrid>
      );
    case 'platform.stack':
      return (
        <PFStack direction={stringValue(values.direction, 'column') === 'row' ? 'row' : 'column'} gap={numberValue(values.gap, 10)}>
          <PFAlert intent="neutral" title="First">Sequenced content block.</PFAlert>
          <PFAlert intent="primary" title="Second">Consistent spacing between children.</PFAlert>
        </PFStack>
      );
    case 'platform.masonry': {
      const items = readMasonryItems(values.items);
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Masonry</PFTypography>
          </PFCardHeader>
          <PFCardContent>
            <div
              className={styles.masonry}
              style={{
                columns: numberValue(values.columns, 3),
                columnGap: `${numberValue(values.gap, 12)}px`,
              }}
            >
              {items.map((item) => (
                <article key={item.id} className={styles.masonryItem} style={{ minHeight: `${item.height}px` }}>
                  <PFTypography variant="label">{item.title}</PFTypography>
                  <PFTypography variant="body2" muted>{item.description}</PFTypography>
                </article>
              ))}
            </div>
          </PFCardContent>
        </PFCard>
      );
    }
    case 'platform.noSsr':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">NoSSR</PFTypography>
          </PFCardHeader>
          <PFCardContent className={styles.formContent}>
            <PFTypography variant="body2" muted>{stringValue(values.fallbackText, 'Loading client-only content...')}</PFTypography>
            <PFTypography variant="body2">{stringValue(values.contentText, 'Client metrics panel ready.')}</PFTypography>
          </PFCardContent>
        </PFCard>
      );
    case 'platform.portal':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">{stringValue(values.title, 'Portal Demo')}</PFTypography>
          </PFCardHeader>
          <PFCardContent className={styles.formContent}>
            <PFTypography variant="body2" muted>Portal target: {stringValue(values.target, '#overlay-root')}</PFTypography>
            <PFAlert intent="neutral" title="Overlay Content">
              {stringValue(values.content, 'Overlay content rendered outside the layout tree.')}
            </PFAlert>
          </PFCardContent>
        </PFCard>
      );
    case 'platform.popover':
      return (
        <PFCard>
          <PFCardHeader className={styles.cardToolbar}>
            <PFTypography variant="h5">Popover</PFTypography>
            <button
              ref={popoverAnchorRef}
              type="button"
              className={styles.popoverTrigger}
              onClick={() => context.setPopoverOpen(true)}
            >
              Open popover
            </button>
          </PFCardHeader>
          <PFCardContent>
            <PFTypography variant="body2" muted>
              Use click-away or escape to close.
            </PFTypography>
          </PFCardContent>
          <PFPopover
            open={booleanValue(values.open) || context.popoverOpen}
            anchorRef={popoverAnchorRef}
            placement={placementValue(values.placement)}
            onClose={() => context.setPopoverOpen(false)}
          >
            <PFTypography variant="body2">Popover content anchored to toolbar button.</PFTypography>
          </PFPopover>
        </PFCard>
      );
    case 'platform.clickAwayListener':
      return (
        <PFCard>
          <PFCardHeader className={styles.cardToolbar}>
            <PFTypography variant="h5">Click Away Listener</PFTypography>
            <PFButton size="sm" onClick={() => context.setMenuOpen(!context.menuOpen)}>
              {context.menuOpen ? 'Hide panel' : 'Show panel'}
            </PFButton>
          </PFCardHeader>
          <PFCardContent className={styles.formContent}>
            <PFTypography variant="body2" muted>{stringValue(values.message, 'Click outside the panel to dismiss.')}</PFTypography>
            {context.menuOpen ? (
              <div className={styles.clickAwayPanel}>
                <PFTypography variant="body2">Preview panel is open. Click the button again to simulate dismissal.</PFTypography>
              </div>
            ) : null}
          </PFCardContent>
        </PFCard>
      );
    case 'platform.popper':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Popper</PFTypography>
          </PFCardHeader>
          <PFCardContent className={styles.formContent}>
            <PFButton size="sm" variant="outline" intent="neutral">Anchor element</PFButton>
            {booleanValue(values.open, true) ? (
              <div className={styles.popperDemo}>
                <PFTypography variant="caption" muted>{placementValue(values.placement).toUpperCase()}</PFTypography>
                <PFTypography variant="body2">{stringValue(values.content, 'Contextual actions for selected row.')}</PFTypography>
              </div>
            ) : null}
          </PFCardContent>
        </PFCard>
      );
    case 'platform.transitionFade':
      return (
        <PFCard>
          <PFCardHeader>
            <PFTypography variant="h5">Transition Fade</PFTypography>
          </PFCardHeader>
          <PFCardContent>
            <div
              className={styles.fadeDemo}
              style={{
                opacity: booleanValue(values.in, true) ? 1 : 0.25,
                transitionDuration: `${numberValue(values.durationMs, 240)}ms`,
              }}
            >
              {stringValue(values.label, 'Faded content block')}
            </div>
          </PFCardContent>
        </PFCard>
      );
    default:
      return (
        <PFCard className={styles.placeholderCard}>
          <PFCardHeader>
            <PFTypography variant="h5">{component.displayName}</PFTypography>
            <PFChip intent="neutral">{status}</PFChip>
          </PFCardHeader>
          <PFCardContent>
            <PFTypography variant="body2" muted>
              Preview scenario for <code>{component.adapterHint}</code> is not configured yet.
            </PFTypography>
          </PFCardContent>
        </PFCard>
      );
  }
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function booleanValue(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return fallback;
}

function readOptions(value: unknown): Array<{ value: string; label: string }> {
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => {
        if (typeof entry === 'string') return { value: entry, label: entry };
        if (typeof entry === 'object' && entry !== null) {
          const record = entry as { value?: unknown; label?: unknown };
          if (typeof record.value === 'string') {
            return { value: record.value, label: typeof record.label === 'string' ? record.label : record.value };
          }
        }
        return null;
      })
      .filter((entry): entry is { value: string; label: string } => Boolean(entry));
    if (normalized.length > 0) return normalized;
  }
  return [
    { value: 'author', label: 'Author' },
    { value: 'approver', label: 'Approver' },
    { value: 'publisher', label: 'Publisher' },
  ];
}

function readImageItems(value: unknown): Array<{ src: string; alt: string; title: string }> {
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => {
        if (typeof entry !== 'object' || entry === null) return null;
        const record = entry as { src?: unknown; alt?: unknown; title?: unknown };
        if (typeof record.src !== 'string') return null;
        return {
          src: record.src,
          alt: typeof record.alt === 'string' ? record.alt : 'Preview image',
          title: typeof record.title === 'string' ? record.title : 'Image item',
        };
      })
      .filter((entry): entry is { src: string; alt: string; title: string } => Boolean(entry));
    if (normalized.length > 0) return normalized;
  }
  return [
    { src: 'https://picsum.photos/seed/ruleflow-1/360/220', alt: 'Server rack', title: 'Runtime cluster' },
    { src: 'https://picsum.photos/seed/ruleflow-2/360/220', alt: 'Data dashboard', title: 'Ops dashboard' },
    { src: 'https://picsum.photos/seed/ruleflow-3/360/220', alt: 'Team review', title: 'Release review' },
  ];
}

function readNavigationItems(value: unknown): Array<{ value: string; label: string }> {
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => {
        if (typeof entry !== 'object' || entry === null) return null;
        const record = entry as { value?: unknown; label?: unknown };
        if (typeof record.value !== 'string') return null;
        return {
          value: record.value,
          label: typeof record.label === 'string' ? record.label : record.value,
        };
      })
      .filter((entry): entry is { value: string; label: string } => Boolean(entry));
    if (normalized.length > 0) return normalized;
  }
  return [
    { value: 'home', label: 'Home' },
    { value: 'flows', label: 'Flows' },
    { value: 'alerts', label: 'Alerts' },
  ];
}

function readSpeedDialActions(value: unknown): Array<{ id: string; label: string }> {
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => {
        if (typeof entry !== 'object' || entry === null) return null;
        const record = entry as { id?: unknown; label?: unknown };
        if (typeof record.id !== 'string') return null;
        return {
          id: record.id,
          label: typeof record.label === 'string' ? record.label : record.id,
        };
      })
      .filter((entry): entry is { id: string; label: string } => Boolean(entry));
    if (normalized.length > 0) return normalized;
  }
  return [
    { id: 'new-rule', label: 'New Rule' },
    { id: 'clone-screen', label: 'Clone Screen' },
    { id: 'export-json', label: 'Export JSON' },
  ];
}

function readMasonryItems(value: unknown): Array<{ id: string; title: string; description: string; height: number }> {
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => {
        if (typeof entry !== 'object' || entry === null) return null;
        const record = entry as { id?: unknown; title?: unknown; description?: unknown; height?: unknown };
        if (typeof record.id !== 'string') return null;
        return {
          id: record.id,
          title: typeof record.title === 'string' ? record.title : 'Card',
          description: typeof record.description === 'string' ? record.description : '',
          height: numberValue(record.height, 110),
        };
      })
      .filter((entry): entry is { id: string; title: string; description: string; height: number } => Boolean(entry));
    if (normalized.length > 0) return normalized;
  }
  return [
    { id: '1', title: 'Cluster health', description: '99.9% availability', height: 110 },
    { id: '2', title: 'Queue depth', description: '124 pending jobs', height: 160 },
    { id: '3', title: 'SLA warnings', description: '2 workflows near limit', height: 130 },
    { id: '4', title: 'Rules latency', description: 'P95 44ms', height: 90 },
  ];
}

function placementValue(value: unknown): 'top' | 'bottom' | 'left' | 'right' {
  if (value === 'top' || value === 'bottom' || value === 'left' || value === 'right') return value;
  return 'bottom';
}

function intentValue(value: unknown): 'neutral' | 'primary' | 'success' | 'warn' | 'error' {
  if (value === 'neutral' || value === 'primary' || value === 'success' || value === 'warn' || value === 'error') return value;
  return 'success';
}

function dialogSize(value: unknown): 'sm' | 'md' | 'lg' {
  if (value === 'sm' || value === 'md' || value === 'lg') return value;
  return 'md';
}

function typographyVariant(value: unknown): 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body1' | 'body2' | 'caption' | 'label' | 'code' {
  if (
    value === 'h1' ||
    value === 'h2' ||
    value === 'h3' ||
    value === 'h4' ||
    value === 'h5' ||
    value === 'h6' ||
    value === 'body1' ||
    value === 'body2' ||
    value === 'caption' ||
    value === 'label' ||
    value === 'code'
  ) {
    return value;
  }
  return 'body1';
}

function displayFormatValue(value: unknown): 'short' | 'medium' | 'long' {
  if (value === 'short' || value === 'medium' || value === 'long') return value;
  return 'medium';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
