'use client';

import { useMemo, useState } from 'react';
import type { JSONValue } from '@platform/schema';
import type { ChangeEventPayload as AngularChangePayload } from '@platform/angular-renderer';
import { RenderPageAngular } from '@platform/angular-renderer';
import type { ChangeEventPayload as VueChangePayload } from '@platform/vue-renderer';
import { RenderPageVue } from '@platform/vue-renderer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  adapterDemoContext,
  adapterDemoSchema,
  cloneDemoData,
} from './demo-schema';
import styles from './RendererAdapterDemo.module.scss';

type AdapterKind = 'vue' | 'angular';

type RuntimeResult = {
  html: string;
  data: Record<string, JSONValue>;
  dispatchEvent: (input: {
    event: 'onChange' | 'onClick' | 'onSubmit';
    componentId: string;
    value?: JSONValue;
    bindingPath?: string;
  }) => void;
};

type AdapterEvent = VueChangePayload | AngularChangePayload | { componentId: string };

export function RendererAdapterDemo({
  adapter,
  title,
}: {
  adapter: AdapterKind;
  title: string;
}) {
  const [eventLog, setEventLog] = useState<string[]>([]);

  const runtime = useMemo((): RuntimeResult => {
    const onAdapterEvent = (
      eventName: 'onChange' | 'onClick' | 'onSubmit',
      payload: AdapterEvent,
    ) => {
      setEventLog((prev) =>
        [`${eventName} ${JSON.stringify(payload)}`, ...prev].slice(0, 8),
      );
    };
    if (adapter === 'vue') {
      return RenderPageVue({
        uiSchema: adapterDemoSchema,
        data: cloneDemoData(),
        context: adapterDemoContext,
        onAdapterEvent,
      });
    }
    return RenderPageAngular({
      uiSchema: adapterDemoSchema,
      data: cloneDemoData(),
      context: adapterDemoContext,
      onAdapterEvent,
    });
  }, [adapter]);

  const [html, setHtml] = useState(runtime.html);
  const [dataSnapshot, setDataSnapshot] = useState(runtime.data);

  const runNameChange = () => {
    runtime.dispatchEvent({
      event: 'onChange',
      componentId: 'customerName',
      bindingPath: 'data.customer.name',
      value: 'Katherine Johnson',
    });
    setHtml(runtime.html);
    setDataSnapshot(runtime.data);
  };

  const runButtonClick = () => {
    runtime.dispatchEvent({
      event: 'onClick',
      componentId: 'saveButton',
    });
    setHtml(runtime.html);
  };

  return (
    <div className={styles.page}>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className={styles.stack}>
          <p>
            Fixed UISchema render demo using the shared adapter contract. This verifies rule evaluation,
            binding resolution, and event dispatch parity for <strong>{adapter}</strong>.
          </p>
          <div className={styles.actions}>
            <Button type="button" onClick={runNameChange}>
              Trigger onChange
            </Button>
            <Button type="button" variant="outline" onClick={runButtonClick}>
              Trigger onClick
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className={styles.grid}>
        <Card>
          <CardHeader>
            <CardTitle>Rendered Output</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={styles.preview}
              data-testid={`${adapter}-renderer-preview`}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Runtime Snapshot</CardTitle>
          </CardHeader>
          <CardContent className={styles.stack}>
            <pre className={styles.pre}>{JSON.stringify(dataSnapshot, null, 2)}</pre>
            <p className={styles.logTitle}>Recent Events</p>
            <ul className={styles.logList}>
              {eventLog.length === 0 ? <li>No events yet.</li> : null}
              {eventLog.map((line, idx) => (
                <li key={`${line}-${idx}`}>{line}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
