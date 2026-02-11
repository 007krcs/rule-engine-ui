'use client';

import { useEffect, useMemo } from 'react';
import type { ExecutionContext, JSONValue, UISchema } from '@platform/schema';
import { RenderPage } from '@platform/react-renderer';
import { registerMaterialAdapters } from '@platform/react-material-adapter';
import { registerAgGridAdapter } from '@platform/react-aggrid-adapter';
import { registerHighchartsAdapter } from '@platform/react-highcharts-adapter';
import { registerD3Adapter } from '@platform/react-d3-adapter';
import { registerCompanyAdapter } from '@platform/react-company-adapter';
import { renderAngular } from '@platform/angular-renderer';
import { renderVue } from '@platform/vue-renderer';
import { createProviderFromBundles, EXAMPLE_TENANT_BUNDLES, PLATFORM_BUNDLES } from '@platform/i18n';
import exampleUi from '@platform/schema/examples/example.ui.json';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import styles from './integrations.module.css';
import { cn } from '@/lib/utils';

const context: ExecutionContext = {
  tenantId: 'tenant-1',
  userId: 'integration-demo',
  role: 'user',
  roles: ['user'],
  country: 'US',
  locale: 'en-US',
  timezone: 'America/New_York',
  device: 'desktop',
  permissions: ['read'],
  featureFlags: { demo: true },
};

const data: Record<string, JSONValue> = {
  orders: [
    { orderId: 'A-100', customer: 'Maya', total: 1200 },
    { orderId: 'B-200', customer: 'Sam', total: 430 },
  ],
  revenueSeries: [2, 7, 4, 9],
  customViz: [],
};

const snippets = [
  {
    title: 'React',
    code: `import { RenderPage } from '@platform/react-renderer';\nimport { registerMaterialAdapters } from '@platform/react-material-adapter';\n\nregisterMaterialAdapters();\n\n<RenderPage uiSchema={uiSchema} data={data} context={context} i18n={i18n} />`,
  },
  {
    title: 'Angular',
    code: `import { renderAngular } from '@platform/angular-renderer';\n\nrenderAngular({ uiSchema, data, context, i18n, target: '#root' });`,
  },
  {
    title: 'Vue',
    code: `import { renderVue } from '@platform/vue-renderer';\n\nrenderVue({ uiSchema, data, context, i18n, target: '#app' });`,
  },
];

export default function IntegrationsPage() {
  useEffect(() => {
    registerMaterialAdapters();
    registerAgGridAdapter();
    registerHighchartsAdapter();
    registerD3Adapter();
    registerCompanyAdapter();
  }, []);

  const uiSchema = exampleUi as unknown as UISchema;
  const i18n = useMemo(
    () =>
      createProviderFromBundles({
        locale: 'en',
        fallbackLocale: 'en',
        bundles: [...PLATFORM_BUNDLES, ...EXAMPLE_TENANT_BUNDLES],
        mode: 'dev',
      }),
    [],
  );

  const angularHtml = useMemo(() => renderAngular({ uiSchema, data, context, i18n }), [i18n, uiSchema]);
  const vueHtml = useMemo(() => renderVue({ uiSchema, data, context, i18n }), [i18n, uiSchema]);

  return (
    <div className={styles.stack}>
      <Card>
        <CardHeader>
          <CardTitle>Integration Hub</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={styles.lead}>
            Embed RuleFlow into any host UI with thin adapters. The runtime is headless; UI is rendered by adapters selected via{' '}
            <span className="rfCodeInline">adapterHint</span>.
          </p>
        </CardContent>
      </Card>

      <div className={styles.grid}>
        {snippets.map((snippet) => (
          <Card key={snippet.title}>
            <CardHeader>
              <CardTitle>{snippet.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className={cn(styles.snippet, 'rfScrollbar')}>{snippet.code}</pre>

              <div style={{ height: 12 }} />
              <div className={styles.preview}>
                {snippet.title === 'React' ? (
                  <RenderPage uiSchema={uiSchema} data={data} context={context} i18n={i18n} />
                ) : (
                  <div
                    className={styles.previewHtml}
                    dangerouslySetInnerHTML={{ __html: snippet.title === 'Angular' ? angularHtml : vueHtml }}
                  />
                )}
              </div>

              <p className="rfHelperText" style={{ marginTop: 10 }}>
                {snippet.title === 'React'
                  ? 'React uses adapters to render real components.'
                  : 'Angular/Vue packages in this repo are minimal HTML renderers for host integration demos.'}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

