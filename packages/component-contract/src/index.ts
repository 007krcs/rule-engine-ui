export type ComponentCategory = 'input' | 'display' | 'layout' | 'action';

export type Primitive = string | number | boolean | null;

export interface ComponentBinding {
  source: string;
  target: string;
  transform?: string;
  defaultValue?: Primitive;
}

export interface ComponentEvent {
  name: string;
  description?: string;
  payloadSchema?: Record<string, unknown>;
}

export interface ComponentContract {
  type: string;
  displayName: string;
  category: ComponentCategory;
  bindings: ComponentBinding[];
  events: ComponentEvent[];
  propsSchema: Record<string, unknown>;
}

export function isComponentContract(value: unknown): value is ComponentContract {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<ComponentContract>;
  return (
    typeof candidate.type === 'string' &&
    candidate.type.length > 0 &&
    typeof candidate.displayName === 'string' &&
    candidate.displayName.length > 0 &&
    Array.isArray(candidate.bindings) &&
    Array.isArray(candidate.events)
  );
}
