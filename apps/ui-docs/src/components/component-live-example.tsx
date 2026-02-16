'use client';

import { useMemo, useState } from 'react';
import {
  PFAlert,
  PFAppBar,
  PFAppShell,
  PFAutocomplete,
  PFAvatar,
  PFBackdrop,
  PFBadge,
  PFBox,
  PFBreadcrumbs,
  PFButton,
  PFButtonGroup,
  PFCard,
  PFCardActions,
  PFCardContent,
  PFCardHeader,
  PFCheckbox,
  PFChip,
  PFContainer,
  PFDialog,
  PFDialogActions,
  PFDialogBody,
  PFDivider,
  PFDrawer,
  PFFormHelperText,
  PFFormLabel,
  PFGrid,
  PFIconButton,
  PFInput,
  PFMenu,
  PFPagination,
  PFProgress,
  PFRadio,
  PFSelect,
  PFSlider,
  PFSkeleton,
  PFSnackbar,
  PFStack,
  PFStepper,
  PFSwitch,
  PFTabs,
  PFTable,
  PFTextField,
  PFToggleButtonGroup,
  PFToolbar,
  PFTooltip,
  PFTypography,
  PlatformThemeProvider,
  usePlatformTheme,
} from '@platform/ui-kit';

export function ComponentLiveExample({ slug }: { slug: string }) {
  const [tab, setTab] = useState('overview');
  const [page, setPage] = useState(3);
  const [menuSelection, setMenuSelection] = useState('None');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [switchOn, setSwitchOn] = useState(true);
  const [toggleValue, setToggleValue] = useState<string>('day');
  const [backdropOpen, setBackdropOpen] = useState(false);

  const tableRows = useMemo(
    () => [
      { id: 'A-120', owner: 'Avery', status: 'Pending' },
      { id: 'A-121', owner: 'Jordan', status: 'Approved' },
      { id: 'A-122', owner: 'Kai', status: 'Blocked' },
    ],
    [],
  );

  if (slug === 'button') {
    return (
      <PFStack direction="row" gap="var(--pf-space-2)">
        <PFButton variant="solid">Approve</PFButton>
        <PFButton variant="outline" intent="neutral">
          Review
        </PFButton>
        <PFButton variant="ghost" loading>
          Saving
        </PFButton>
      </PFStack>
    );
  }

  if (slug === 'icon-button') {
    return (
      <PFStack direction="row" gap="var(--pf-space-2)">
        <PFIconButton label="Edit">E</PFIconButton>
        <PFIconButton label="Delete" variant="outline" intent="error">
          D
        </PFIconButton>
      </PFStack>
    );
  }

  if (slug === 'button-group') {
    return (
      <PFButtonGroup ariaLabel="Approval actions">
        <PFButton variant="solid">Approve</PFButton>
        <PFButton variant="outline">Request Changes</PFButton>
        <PFButton variant="ghost">Escalate</PFButton>
      </PFButtonGroup>
    );
  }

  if (slug === 'toggle-button-group') {
    return (
      <PFToggleButtonGroup
        options={[
          { value: 'day', label: 'Day' },
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
        ]}
        value={toggleValue}
        onChange={(value) => {
          if (typeof value === 'string') setToggleValue(value);
        }}
      />
    );
  }

  if (slug === 'input') {
    return <PFInput placeholder="Find customer..." />;
  }

  if (slug === 'text-field') {
    return <PFTextField id="customer-id" label="Customer ID" helperText="Format: CUST-0001" />;
  }

  if (slug === 'select') {
    return (
      <PFSelect
        options={[
          { value: 'low', label: 'Low Risk' },
          { value: 'medium', label: 'Medium Risk' },
          { value: 'high', label: 'High Risk' },
        ]}
        value="medium"
      />
    );
  }

  if (slug === 'checkbox') {
    return <PFCheckbox label="Enable approval workflow" helperText="Routes updates through reviewers." defaultChecked />;
  }

  if (slug === 'radio') {
    return (
      <PFStack>
        <PFRadio name="tier" label="Starter" defaultChecked />
        <PFRadio name="tier" label="Enterprise" />
      </PFStack>
    );
  }

  if (slug === 'switch') {
    return (
      <PFSwitch
        label={switchOn ? 'Kill switch is ON' : 'Kill switch is OFF'}
        checked={switchOn}
        onCheckedChange={setSwitchOn}
      />
    );
  }

  if (slug === 'slider') {
    return <PFSlider min={0} max={100} value={64} />;
  }

  if (slug === 'autocomplete') {
    return (
      <PFAutocomplete
        options={[
          { value: 'United States' },
          { value: 'United Kingdom' },
          { value: 'United Arab Emirates' },
        ]}
        placeholder="Type a country"
      />
    );
  }

  if (slug === 'form-label') {
    return (
      <div>
        <PFFormLabel htmlFor="label-demo">Environment</PFFormLabel>
        <PFInput id="label-demo" defaultValue="Production" />
      </div>
    );
  }

  if (slug === 'form-helper-text') {
    return <PFFormHelperText error>Feature flag key must start with `ff_`.</PFFormHelperText>;
  }

  if (slug === 'avatar') {
    return (
      <PFStack direction="row" gap="var(--pf-space-3)">
        <PFAvatar name="Avery Cruz" />
        <PFAvatar name="Jordan Lin" sizePx={44} />
      </PFStack>
    );
  }

  if (slug === 'badge') {
    return (
      <PFBadge badgeContent={12} intent="error">
        <PFButton variant="outline">Notifications</PFButton>
      </PFBadge>
    );
  }

  if (slug === 'chip') {
    return (
      <PFStack direction="row" gap="var(--pf-space-2)">
        <PFChip intent="primary">Policy: AML</PFChip>
        <PFChip intent="success" onDelete={() => undefined}>
          Enabled
        </PFChip>
      </PFStack>
    );
  }

  if (slug === 'table') {
    return (
      <PFTable
        columns={[
          { id: 'id', header: 'ID' },
          { id: 'owner', header: 'Owner' },
          { id: 'status', header: 'Status' },
        ]}
        rows={tableRows}
      />
    );
  }

  if (slug === 'divider') {
    return (
      <PFStack>
        <PFTypography variant="body-sm">General</PFTypography>
        <PFDivider />
        <PFTypography variant="body-sm">Advanced</PFTypography>
      </PFStack>
    );
  }

  if (slug === 'typography') {
    return (
      <PFStack gap="var(--pf-space-2)">
        <PFTypography variant="h2">Tenant Branding</PFTypography>
        <PFTypography variant="body-md">
          Update logo, color tokens, and density settings from a single console.
        </PFTypography>
        <PFTypography variant="caption">Last saved 2 minutes ago</PFTypography>
      </PFStack>
    );
  }

  if (slug === 'alert') {
    return (
      <PFAlert intent="warn" title="Validation warning">
        One or more adapters are not approved for this tenant.
      </PFAlert>
    );
  }

  if (slug === 'snackbar') {
    return (
      <PFStack gap="var(--pf-space-3)">
        <PFButton onClick={() => setSnackbarOpen(true)}>Open Snackbar</PFButton>
        <PFSnackbar open={snackbarOpen} onClose={() => setSnackbarOpen(false)} message="Theme saved." intent="success" />
      </PFStack>
    );
  }

  if (slug === 'progress') {
    return (
      <PFStack gap="var(--pf-space-3)">
        <PFProgress value={72} />
        <PFProgress variant="circular" value={72} />
      </PFStack>
    );
  }

  if (slug === 'skeleton') {
    return (
      <PFStack gap="var(--pf-space-2)">
        <PFSkeleton variant="text" width="60%" />
        <PFSkeleton variant="rounded" height={120} />
      </PFStack>
    );
  }

  if (slug === 'tooltip') {
    return (
      <PFTooltip content="Copy environment id" placement="top">
        <PFButton variant="outline">Hover me</PFButton>
      </PFTooltip>
    );
  }

  if (slug === 'backdrop') {
    return (
      <PFStack gap="var(--pf-space-3)">
        <PFButton onClick={() => setBackdropOpen(true)}>Show Backdrop</PFButton>
        <PFBackdrop open={backdropOpen} onClick={() => setBackdropOpen(false)} />
      </PFStack>
    );
  }

  if (slug === 'card') {
    return (
      <PFCard elevated>
        <PFCardHeader>
          <PFTypography variant="h3">Approval Summary</PFTypography>
        </PFCardHeader>
        <PFCardContent>
          <PFTypography variant="body-sm">4 pending approvals across 2 environments.</PFTypography>
        </PFCardContent>
        <PFCardActions>
          <PFButton size="sm">Open Queue</PFButton>
        </PFCardActions>
      </PFCard>
    );
  }

  if (slug === 'dialog') {
    return (
      <PFStack gap="var(--pf-space-3)">
        <PFButton onClick={() => setDialogOpen(true)}>Open Dialog</PFButton>
        <PFDialog
          open={dialogOpen}
          title="Promote version"
          onClose={() => setDialogOpen(false)}
          actions={
            <>
              <PFButton variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </PFButton>
              <PFButton onClick={() => setDialogOpen(false)}>Promote</PFButton>
            </>
          }
        >
          <PFDialogBody>Are you sure you want to promote this config to production?</PFDialogBody>
          <PFDialogActions />
        </PFDialog>
      </PFStack>
    );
  }

  if (slug === 'app-bar') {
    return (
      <PFAppBar>
        <PFToolbar>
          <PFTypography variant="h3">Platform Console</PFTypography>
          <PFButton variant="outline">Deploy</PFButton>
        </PFToolbar>
      </PFAppBar>
    );
  }

  if (slug === 'drawer') {
    return (
      <PFStack gap="var(--pf-space-3)">
        <PFButton onClick={() => setDrawerOpen(true)}>Open Drawer</PFButton>
        <PFDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Filters">
          <PFStack>
            <PFCheckbox label="Errors only" defaultChecked />
            <PFCheckbox label="Show archived" />
          </PFStack>
        </PFDrawer>
      </PFStack>
    );
  }

  if (slug === 'tabs') {
    return (
      <PFTabs
        tabs={[
          { id: 'overview', label: 'Overview', content: <PFTypography variant="body-sm">Overview content</PFTypography> },
          { id: 'usage', label: 'Usage', content: <PFTypography variant="body-sm">Usage metrics</PFTypography> },
          { id: 'audit', label: 'Audit', content: <PFTypography variant="body-sm">Recent changes</PFTypography> },
        ]}
        value={tab}
        onChange={setTab}
      />
    );
  }

  if (slug === 'breadcrumbs') {
    return (
      <PFBreadcrumbs
        items={[
          { id: 'home', label: 'Home', href: '#' },
          { id: 'console', label: 'Console', href: '#' },
          { id: 'branding', label: 'Branding', current: true },
        ]}
      />
    );
  }

  if (slug === 'menu') {
    return (
      <PFStack gap="var(--pf-space-3)">
        <PFMenu
          triggerLabel="Actions"
          items={[
            { id: 'edit', label: 'Edit' },
            { id: 'duplicate', label: 'Duplicate' },
            { id: 'archive', label: 'Archive' },
          ]}
          onSelect={setMenuSelection}
        />
        <PFTypography variant="caption">Last action: {menuSelection}</PFTypography>
      </PFStack>
    );
  }

  if (slug === 'pagination') {
    return <PFPagination count={20} page={page} onPageChange={setPage} />;
  }

  if (slug === 'stepper') {
    return (
      <PFStepper
        activeStep={1}
        steps={[
          { id: 'draft', label: 'Draft' },
          { id: 'review', label: 'Review' },
          { id: 'release', label: 'Release' },
        ]}
      />
    );
  }

  if (slug === 'app-shell') {
    return (
      <div className="docs-shell-frame">
        <PFAppShell
          appBar={
            <PFAppBar position="static">
              <PFToolbar>
                <PFTypography variant="h3">RuleFlow</PFTypography>
              </PFToolbar>
            </PFAppBar>
          }
          sidebar={<div className="docs-shell-sidebar">Sidebar</div>}
        >
          <PFTypography variant="body-sm">Main content area</PFTypography>
        </PFAppShell>
      </div>
    );
  }

  if (slug === 'toolbar') {
    return (
      <PFToolbar>
        <PFButton size="sm">Save</PFButton>
        <PFButton size="sm" variant="outline">
          Preview
        </PFButton>
      </PFToolbar>
    );
  }

  if (slug === 'container') {
    return (
      <PFContainer maxWidth="md">
        <PFCard>
          <PFTypography variant="body-sm">This container is constrained to the md width token.</PFTypography>
        </PFCard>
      </PFContainer>
    );
  }

  if (slug === 'grid') {
    return (
      <PFGrid columns={3} gap="var(--pf-space-3)">
        <PFCard><PFTypography variant="body-sm">One</PFTypography></PFCard>
        <PFCard><PFTypography variant="body-sm">Two</PFTypography></PFCard>
        <PFCard><PFTypography variant="body-sm">Three</PFTypography></PFCard>
      </PFGrid>
    );
  }

  if (slug === 'stack') {
    return (
      <PFStack direction="row" gap="var(--pf-space-3)">
        <PFButton variant="outline">Cancel</PFButton>
        <PFButton>Submit</PFButton>
      </PFStack>
    );
  }

  if (slug === 'box') {
    return (
      <PFBox as="section" className="pf-u-border pf-u-rounded-md pf-u-p-4">
        <PFTypography variant="body-sm">PFBox is a polymorphic wrapper for semantic layout.</PFTypography>
      </PFBox>
    );
  }

  if (slug === 'theme-provider') {
    return (
      <PlatformThemeProvider initialTheme={{ mode: 'light' }}>
        <ThemeProviderDemo />
      </PlatformThemeProvider>
    );
  }

  return (
    <PFCard>
      <PFTypography variant="body-sm">Live example pending for {slug}.</PFTypography>
    </PFCard>
  );
}

function ThemeProviderDemo() {
  const { theme, setMode, setDensity } = usePlatformTheme();
  const { mode, density } = theme;
  return (
    <PFCard>
      <PFCardHeader>
        <PFTypography variant="h3">Runtime Theme Controls</PFTypography>
      </PFCardHeader>
      <PFCardContent>
        <PFTypography variant="body-sm">Mode: {mode}</PFTypography>
        <PFTypography variant="body-sm">Density: {density}</PFTypography>
      </PFCardContent>
      <PFCardActions>
        <PFButton variant="outline" onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}>
          Toggle Mode
        </PFButton>
        <PFButton variant="ghost" onClick={() => setDensity(density === 'comfortable' ? 'compact' : 'comfortable')}>
          Toggle Density
        </PFButton>
      </PFCardActions>
    </PFCard>
  );
}
