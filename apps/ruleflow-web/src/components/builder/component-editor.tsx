'use client';

import type { UIComponent } from '@platform/schema';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function ComponentEditor({
  component,
  onChange,
  onRemove,
}: {
  component: UIComponent;
  onChange: (component: UIComponent) => void;
  onRemove: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{component.id}</CardTitle>
          <Badge variant="muted">{component.adapterHint}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground">Adapter Hint</label>
          <Input
            value={component.adapterHint}
            onChange={(event) => onChange({ ...component, adapterHint: event.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground">Label Key</label>
          <Input
            value={component.i18n?.labelKey ?? ''}
            onChange={(event) =>
              onChange({
                ...component,
                i18n: { ...(component.i18n ?? {}), labelKey: event.target.value },
              })
            }
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground">Placeholder Key</label>
          <Input
            value={component.i18n?.placeholderKey ?? ''}
            onChange={(event) =>
              onChange({
                ...component,
                i18n: { ...(component.i18n ?? {}), placeholderKey: event.target.value },
              })
            }
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground">Aria Label Key</label>
          <Input
            value={component.accessibility.ariaLabelKey}
            onChange={(event) =>
              onChange({
                ...component,
                accessibility: { ...component.accessibility, ariaLabelKey: event.target.value },
              })
            }
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground">Focus Order</label>
          <Input
            type="number"
            value={component.accessibility.focusOrder ?? 1}
            onChange={(event) =>
              onChange({
                ...component,
                accessibility: {
                  ...component.accessibility,
                  focusOrder: Number(event.target.value) || 1,
                  keyboardNav: true,
                },
              })
            }
          />
        </div>
        <Button variant="outline" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </CardContent>
    </Card>
  );
}
