import type { DeclarativePlugin } from '@platform/plugin-sdk';

function WeatherBadge({ city = 'Seattle', tempC = 14 }: { city?: string; tempC?: number }) {
  return (
    <div
      style={{
        border: '1px solid var(--rf-color-border, #c6d2e1)',
        borderRadius: 10,
        padding: 12,
        display: 'grid',
        gap: 4,
        background: 'var(--rf-color-surface, #ffffff)',
      }}
    >
      <strong>{city}</strong>
      <span>{tempC} C</span>
    </div>
  );
}

export const externalWeatherPlugin: DeclarativePlugin = {
  meta: {
    id: 'external.weather',
    name: 'External Weather Plugin',
    version: '0.1.0',
    apiVersion: '1.0.0',
    description: 'Example dynamically loaded external plugin.',
  },
  components: [
    {
      type: 'external.weatherBadge',
      renderer: WeatherBadge,
      contract: {
        type: 'object',
        properties: {
          city: { type: 'string', title: 'City', default: 'Seattle' },
          tempC: { type: 'number', title: 'Temperature C', default: 14 },
        },
      },
      capabilities: ['data-binding', 'theming'],
      displayName: 'Weather Badge',
      category: 'Data Display',
      description: 'Small weather badge from an external plugin module.',
      adapterHint: 'external.weatherBadge',
    },
  ],
};
