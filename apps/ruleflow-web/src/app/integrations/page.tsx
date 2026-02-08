import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Integration Hub</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Embed RuleFlow into any host UI with thin adapters. Bring your own components, i18n provider,
          and observability hooks.
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {snippets.map((snippet) => (
          <Card key={snippet.title}>
            <CardHeader>
              <CardTitle>{snippet.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[360px] overflow-auto rounded-lg bg-muted/40 p-3 text-xs">{snippet.code}</pre>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
