import type { ComponentContract } from '@platform/component-contract';
import type { DeclarativePlugin } from '@platform/plugin-sdk';
import type { ComponentType } from 'react';

export interface RatingStarProps {
  label?: string;
  value?: number;
  max?: number;
  readOnly?: boolean;
  ariaLabel?: string;
}

export function RatingStar({
  label = 'Rating',
  value = 3,
  max = 5,
  readOnly = true,
  ariaLabel,
}: RatingStarProps) {
  const safeMax = clampNumber(max, 1, 10);
  const safeValue = clampNumber(value, 0, safeMax);
  const filled = '*'.repeat(safeValue);
  const empty = '-'.repeat(Math.max(0, safeMax - safeValue));
  const aria = ariaLabel ?? `${label}: ${safeValue} of ${safeMax}`;

  return (
    <div
      style={{
        display: 'grid',
        gap: '6px',
        padding: '12px',
        borderRadius: '10px',
        border: '1px solid var(--rf-color-border, #c6d2e1)',
        background: 'var(--rf-color-surface, #ffffff)',
        color: 'var(--rf-color-text, #13283d)',
        fontFamily: 'var(--rf-font-family, Segoe UI, sans-serif)',
      }}
    >
      <span style={{ fontWeight: 600 }}>{label}</span>
      <span role="img" aria-label={aria} style={{ letterSpacing: '2px' }}>
        {filled}
        {empty}
      </span>
      <span style={{ fontSize: '0.75rem', color: 'var(--rf-color-text-muted, #4f6680)' }}>
        {readOnly ? 'Read-only preview' : 'Interactive'}
      </span>
    </div>
  );
}

const ratingStarContract: ComponentContract<RatingStarProps> = {
  type: 'myco.ratingStar',
  displayName: 'Rating Star',
  category: 'Form Controls',
  description: 'Simple rating indicator registered via a plugin.',
  icon: 'rating',
  adapterHint: 'myco.input.ratingStar',
  props: {
    label: {
      kind: 'string',
      label: 'Label',
      description: 'Label shown above the rating value.',
      defaultValue: 'Rating',
    },
    value: {
      kind: 'number',
      label: 'Value',
      description: 'Current rating value.',
      min: 0,
      max: 10,
      defaultValue: 3,
    },
    max: {
      kind: 'number',
      label: 'Max',
      description: 'Maximum rating scale.',
      min: 1,
      max: 10,
      defaultValue: 5,
    },
    readOnly: {
      kind: 'boolean',
      label: 'Read Only',
      description: 'Locks the rating to display-only mode.',
      defaultValue: true,
    },
    ariaLabel: {
      kind: 'string',
      label: 'ARIA Label',
      description: 'Assistive label for the rating group.',
      defaultValue: '',
    },
  },
  defaultProps: {
    label: 'Rating',
    value: 3,
    max: 5,
    readOnly: true,
  },
  bindings: [
    {
      key: 'value',
      kind: 'data',
      description: 'Bind the rating value to a data source.',
    },
  ],
  events: [
    {
      name: 'onChange',
      description: 'Emitted when the rating changes.',
    },
  ],
  accessibility: {
    role: 'img',
    recommendedProps: ['ariaLabel'],
  },
  documentation: {
    summary: 'Example plugin component that renders a rating summary.',
  },
};

export const myCompanyPlugin: DeclarativePlugin<ComponentType<any>> = {
  meta: {
    id: 'myco.ui-pack',
    name: 'MyCompany UI Pack',
    version: '0.1.0',
    apiVersion: '1.0.0',
    description: 'Example external plugin that adds a custom component and theme.',
  },
  components: [
    {
      contract: ratingStarContract,
      implementation: RatingStar,
    },
  ],
  themes: [
    {
      id: 'myco.theme.light',
      name: 'MyCompany Light',
      tokens: {
        'color.primary': '#1259ff',
        'color.surface': '#ffffff',
        'color.text.primary': '#10243f',
      },
      description: 'Sample theme tokens provided by plugin.',
    },
  ],
};

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}
