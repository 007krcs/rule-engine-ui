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

const snippets: Array<{
  title: string;
  code: string;
  description: string;
  preview: 'react' | 'angular' | 'vue' | 'none';
}> = [
  {
    title: 'Install (Production Adapters)',
    code: `pnpm add @platform/react-aggrid-real highcharts-react-official\npnpm add @platform/react-highcharts-real highcharts`,
    description: 'Install the real adapter packages plus official chart/grid peer dependencies.',
    preview: 'none',
  },
  {
    title: 'React (Demo Adapters)',
    code: `import { RenderPage } from '@platform/react-renderer';\nimport { registerMaterialAdapters } from '@platform/react-material-adapter';\nimport { registerAgGridAdapter } from '@platform/react-aggrid-adapter';\nimport { registerHighchartsAdapter } from '@platform/react-highcharts-adapter';\n\nregisterMaterialAdapters();\nregisterAgGridAdapter();\nregisterHighchartsAdapter();\n\n<RenderPage uiSchema={uiSchema} data={data} context={context} i18n={i18n} />`,
    description: 'Demo adapters render HTML/SVG so you can ship without external UI dependencies.',
    preview: 'react',
  },
  {
    title: 'React (Production Adapters)',
    code: `import { registerAgGridRealAdapter } from '@platform/react-aggrid-real';\nimport { registerHighchartsRealAdapter } from '@platform/react-highcharts-real';\n\nregisterAgGridRealAdapter();\nregisterHighchartsRealAdapter();\n\n// Same adapterHint values, no runtime changes required.`,
    description: 'Production adapters integrate AG Grid + Highcharts with peer dependencies.',
    preview: 'none',
  },
  {
    title: 'Web Component Bridge',
    code: `import { defineRuleflowRendererElement } from '@platform/web-component-bridge';\n\ndefineRuleflowRendererElement();\n\n<ruleflow-renderer\n  ui-schema='{...}'\n  data='{...}'\n  context='{...}'\n></ruleflow-renderer>`,
    description: 'Recommended for Angular/Vue/React hosts that want a custom element bridge.',
    preview: 'none',
  },
  {
    title: 'Angular/Vue (HTML Demo)',
    code: `import { renderAngular } from '@platform/angular-renderer';\nimport { renderVue } from '@platform/vue-renderer';\n\nrenderAngular({ uiSchema, data, context, i18n, target: '#root' });\nrenderVue({ uiSchema, data, context, i18n, target: '#app' });`,
    description: 'Demo HTML renderers used for host integration validation.',
    preview: 'angular',
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
              {snippet.preview === 'none' ? null : (
                <div className={styles.preview}>
                  {snippet.preview === 'react' ? (
                    <RenderPage uiSchema={uiSchema} data={data} context={context} i18n={i18n} />
                  ) : (
                    <div
                      className={styles.previewHtml}
                      dangerouslySetInnerHTML={{ __html: snippet.preview === 'angular' ? angularHtml : vueHtml }}
                    />
                  )}
                </div>
              )}

              <p className="rfHelperText" style={{ marginTop: 10 }}>{snippet.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
