import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  PFAccordion,
  PFAlert,
  PFButton,
  PFDialog,
  PFMenuItem,
  PFMenu,
  PFProgressCircular,
  PFProgressLinear,
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

  it('renders accordion and progress wrappers', () => {
    const html = renderToStaticMarkup(
      <div>
        <PFAccordion title="Details" defaultExpanded>
          <p>Body</p>
        </PFAccordion>
        <PFProgressLinear value={55} />
        <PFProgressCircular value={70} />
      </div>,
    );

    expect(html).toContain('pf-accordion');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('pf-progress');
    expect(html).toContain('pf-progress-circular');
  });

  it('renders composable PFMenuItem', () => {
    const html = renderToStaticMarkup(
      <PFMenu triggerLabel="Open">
        <li role="none">
          <PFMenuItem selected>Edit</PFMenuItem>
        </li>
      </PFMenu>,
    );

    expect(html).toContain('pf-menu__item');
    expect(html).toContain('is-selected');
  });
});
