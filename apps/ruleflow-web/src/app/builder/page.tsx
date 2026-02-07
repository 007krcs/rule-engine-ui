import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const palette = ['Text Field', 'Select', 'Date Picker', 'AG-Grid Table', 'Highcharts', 'D3 Custom'];

export default function BuilderPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle>Component Palette</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {palette.map((item) => (
            <div key={item} className="rounded-lg border border-border px-3 py-2 text-sm">
              {item}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Canvas</CardTitle>
            <Badge variant="default">Layout: Grid</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid min-h-[360px] place-items-center rounded-xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
            Drag components here to build the UI schema
          </div>
          <div className="mt-6 grid gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm font-semibold">material.input</p>
              <p className="text-xs text-muted-foreground">Label: runtime.filters.customerName.label</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm font-semibold">aggrid.table</p>
              <p className="text-xs text-muted-foreground">Rows: data.orders</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Properties</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Accessibility</p>
            <Input placeholder="ariaLabelKey" defaultValue="runtime.filters.customerName.aria" />
            <div className="mt-2 flex items-center gap-2 text-xs">
              <Badge variant="success">Keyboard Nav</Badge>
              <Badge variant="success">Focus Order 1</Badge>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">I18n Keys</p>
            <div className="space-y-2">
              <Input placeholder="labelKey" defaultValue="runtime.filters.customerName.label" />
              <Input placeholder="placeholderKey" defaultValue="runtime.filters.customerName.placeholder" />
              <Input placeholder="helperTextKey" defaultValue="runtime.filters.customerName.helper" />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Bindings</p>
            <Input placeholder="data.value" defaultValue="data.filters.customerName" />
          </div>
          <div className="flex gap-2">
            <Button size="sm">Save</Button>
            <Button variant="outline" size="sm">
              Validate
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}