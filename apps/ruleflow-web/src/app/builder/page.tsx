'use client';

import { useMemo, useState } from 'react';
import type { UIComponent, UISchema } from '@platform/schema';
import { validateUISchema } from '@platform/validator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ComponentEditor } from '@/components/builder/component-editor';
import { SchemaPreview } from '@/components/builder/schema-preview';

const palette = [
  { label: 'Text Field', adapterHint: 'material.input' },
  { label: 'Button', adapterHint: 'material.button' },
  { label: 'AG-Grid Table', adapterHint: 'aggrid.table' },
  { label: 'Highcharts', adapterHint: 'highcharts.chart' },
  { label: 'D3 Custom', adapterHint: 'd3.chart' },
];

const baseComponents: UIComponent[] = [
  {
    id: 'customerName',
    type: 'input',
    adapterHint: 'material.input',
    props: { label: 'Customer name' },
    i18n: {
      labelKey: 'runtime.filters.customerName.label',
      placeholderKey: 'runtime.filters.customerName.placeholder',
      helperTextKey: 'runtime.filters.customerName.helper',
    },
    accessibility: {
      ariaLabelKey: 'runtime.filters.customerName.aria',
      keyboardNav: true,
      focusOrder: 1,
    },
  },
  {
    id: 'ordersTable',
    type: 'table',
    adapterHint: 'aggrid.table',
    props: {
      columns: [
        { field: 'orderId', headerKey: 'runtime.orders.table.columns.orderId' },
        { field: 'customer', headerKey: 'runtime.orders.table.columns.customer' },
        { field: 'total', headerKey: 'runtime.orders.table.columns.total' },
      ],
      rows: [],
    },
    i18n: {
      labelKey: 'runtime.orders.table.label',
    },
    accessibility: {
      ariaLabelKey: 'runtime.orders.table.aria',
      keyboardNav: true,
      focusOrder: 2,
    },
  },
];

export default function BuilderPage() {
  const [components, setComponents] = useState<UIComponent[]>(baseComponents);
  const [draft, setDraft] = useState({
    id: '',
    adapterHint: palette[0]?.adapterHint ?? 'material.input',
    labelKey: 'runtime.filters.customerName.label',
    ariaLabelKey: 'runtime.filters.customerName.aria',
  });

  const schema: UISchema = useMemo(
    () => ({
      version: '1.0.0',
      pageId: 'builder-preview',
      layout: {
        id: 'root',
        type: 'grid',
        columns: 1,
        componentIds: components.map((component) => component.id),
      },
      components,
    }),
    [components],
  );

  const validation = useMemo(() => validateUISchema(schema), [schema]);

  const addComponent = () => {
    const trimmedId = draft.id.trim();
    if (!trimmedId) return;
    if (components.some((component) => component.id === trimmedId)) return;

    const nextComponent: UIComponent = {
      id: trimmedId,
      type: deriveType(draft.adapterHint),
      adapterHint: draft.adapterHint,
      i18n: {
        labelKey: draft.labelKey,
      },
      accessibility: {
        ariaLabelKey: draft.ariaLabelKey,
        keyboardNav: true,
        focusOrder: components.length + 1,
      },
    };
    setComponents((current) => [...current, nextComponent]);
    setDraft((current) => ({ ...current, id: '' }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Component Palette</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {palette.map((item) => (
            <button
              key={item.adapterHint}
              type="button"
              className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left hover:bg-muted/40"
              onClick={() => setDraft((current) => ({ ...current, adapterHint: item.adapterHint }))}
            >
              <span>{item.label}</span>
              <Badge variant="muted">{item.adapterHint}</Badge>
            </button>
          ))}
          <div className="pt-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Add Component</p>
            <div className="mt-2 space-y-2">
              <Input
                placeholder="Component id"
                value={draft.id}
                onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))}
              />
              <Input
                placeholder="Label key"
                value={draft.labelKey}
                onChange={(event) => setDraft((current) => ({ ...current, labelKey: event.target.value }))}
              />
              <Input
                placeholder="Aria label key"
                value={draft.ariaLabelKey}
                onChange={(event) => setDraft((current) => ({ ...current, ariaLabelKey: event.target.value }))}
              />
              <Button size="sm" onClick={addComponent}>
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Canvas</CardTitle>
              <Badge variant={validation.valid ? 'success' : 'warning'}>
                {validation.valid ? 'Valid' : 'Needs Attention'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {components.map((component) => (
              <ComponentEditor
                key={component.id}
                component={component}
                onChange={(next) =>
                  setComponents((current) => current.map((item) => (item.id === next.id ? next : item)))
                }
                onRemove={() => setComponents((current) => current.filter((item) => item.id !== component.id))}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      <SchemaPreview schema={schema} issues={validation.issues} />
    </div>
  );
}

function deriveType(adapterHint: string): string {
  const parts = adapterHint.split('.');
  return parts[parts.length - 1] || adapterHint;
}
