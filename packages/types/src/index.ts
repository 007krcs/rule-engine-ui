export type JSONSchema = {
  type?: string;
  title?: string;
  description?: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
};

export type PlatformComponentCategory =
  | 'input'
  | 'display'
  | 'layout'
  | 'navigation'
  | 'feedback';

export type PlatformComponentAvailability =
  | 'implemented'
  | 'planned'
  | 'external';

export interface PlatformComponentMeta {
  id: string;
  category: PlatformComponentCategory;
  availability: PlatformComponentAvailability;
  propsSchema: JSONSchema;
  supportsDrag: boolean;
}
