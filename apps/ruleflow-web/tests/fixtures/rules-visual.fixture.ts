import type { ExecutionContext, JSONValue } from '@platform/schema';

export const rulesVisualFixtureContext: ExecutionContext = {
  tenantId: 'tenant-1',
  userId: 'analyst-1',
  role: 'author',
  roles: ['author'],
  country: 'US',
  locale: 'en-US',
  timezone: 'America/New_York',
  device: 'desktop',
  permissions: ['read'],
  featureFlags: { demo: true },
};

export const rulesVisualFixtureData: Record<string, JSONValue> = {
  acceptedTerms: true,
  formValid: true,
  readyToSubmit: true,
  orderTotal: 1200,
  loanAmount: 250000,
  riskLevel: 'Medium',
};
