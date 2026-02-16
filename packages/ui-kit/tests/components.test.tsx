import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  PFAlert,
  PFButton,
  PFDialog,
  PFMenu,
  PFSwitch,
  PFTable,
  PFTextField,
} from '../src';

describe('@platform/ui-kit components', () => {
  it('renders key component contracts', () => {
    const html = renderToStaticMarkup(
      <div className="pf-root">
        <PFButton variant="solid" size="md" startIcon={<span>*</span>} loading>
          Save
        </PFButton>
        <PFTextField id="name" label="Name" helperText="Required field" />
        <PFSwitch id="is-active" checked label="Active" onChange={() => undefined} />
        <PFAlert intent="warn" title="Heads up">
          Validate this form.
        </PFAlert>
      </div>,
    );

    expect(html).toContain('pf-button');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Required field');
    expect(html).toContain('role="switch"');
    expect(html).toContain('Heads up');
  });

  it('marks PFButton disabled while loading', () => {
    const loadingHtml = renderToStaticMarkup(
      <PFButton loading>
        Save
      </PFButton>,
    );
    const disabledHtml = renderToStaticMarkup(
      <PFButton disabled>
        Save
      </PFButton>,
    );

    expect(loadingHtml).toContain('disabled=""');
    expect(loadingHtml).toContain('aria-busy="true"');
    expect(disabledHtml).toContain('disabled=""');
  });

  it('renders dialog and table with semantics', () => {
    const html = renderToStaticMarkup(
      <div>
        <PFDialog open title="Review" actions={<button type="button">Approve</button>}>
          Confirm the release package.
        </PFDialog>
        <PFTable
          columns={[
            { id: 'name', header: 'Name' },
            { id: 'role', header: 'Role' },
          ]}
          rows={[
            { name: 'Avery', role: 'Admin' },
            { name: 'Jordan', role: 'Reviewer' },
          ]}
        />
      </div>,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('Confirm the release package.');
    expect(html).toContain('<table');
    expect(html).toContain('Avery');
  });

  it('renders menu closed by default', () => {
    const html = renderToStaticMarkup(
      <PFMenu
        triggerLabel="Actions"
        items={[
          { id: 'edit', label: 'Edit' },
          { id: 'delete', label: 'Delete' },
        ]}
      />,
    );

    expect(html).toContain('aria-haspopup="menu"');
    expect(html).not.toContain('role="menuitem"');
  });
});
