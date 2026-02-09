import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import styles from './integrations.module.css';
import { cn } from '@/lib/utils';

const snippets = [
  {
    title: 'React',
    code: `import { RenderPage } from '@platform/react-renderer';\nimport { registerMaterialAdapters } from '@platform/react-material-adapter';\n\nregisterMaterialAdapters();\n\n<RenderPage uiSchema={uiSchema} data={data} context={context} i18n={i18n} />`,
  },
  {
    title: 'Angular',
    code: `import { renderAngular } from '@platform/angular-renderer';\n\nrenderAngular({ uiSchema, target: '#root', i18n });`,
  },
  {
    title: 'Vue',
    code: `import { renderVue } from '@platform/vue-renderer';\n\nrenderVue({ uiSchema, target: '#app', i18n });`,
  },
];

export default function IntegrationsPage() {
  return (
    <div className={styles.stack}>
      <Card>
        <CardHeader>
          <CardTitle>Integration Hub</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={styles.lead}>
            Embed RuleFlow into any host UI with thin adapters. Bring your own components, i18n provider, and
            observability hooks.
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

