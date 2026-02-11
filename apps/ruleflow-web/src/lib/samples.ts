export type SampleTemplateId =
  | 'fast-start'
  | 'orders-dashboard'
  | 'policy-gates'
  | 'checkout-flow'
  | 'loan-onboarding';

export type SampleTemplate = {
  id: SampleTemplateId;
  name: string;
  description: string;
  learn: string[];
  recommended?: boolean;
};

export const sampleTemplates: SampleTemplate[] = [
  {
    id: 'fast-start',
    name: 'Fast Start: Submit + Trace',
    description: 'Starts in the review state so you can hit Submit immediately and inspect the full trace.',
    learn: ['Clone a config', 'Run Submit', 'Read rules + API traces', 'Toggle Explain mode'],
    recommended: true,
  },
  {
    id: 'checkout-flow',
    name: 'Checkout Flow',
    description: 'A starter checkout UI that includes company components (currency input + risk badge) and rule-driven trace output.',
    learn: ['Clone into tenant', 'Edit props via JSON Schema forms', 'Run Submit and read trace'],
  },
  {
    id: 'loan-onboarding',
    name: 'Loan Onboarding',
    description: 'Loan intake + underwriting sample with company adapter components and beginner-friendly rules.',
    learn: ['Drag/drop custom components', 'Validate WCAG/i18n keys', 'Compare versions in Console'],
  },
  {
    id: 'orders-dashboard',
    name: 'Orders Dashboard',
    description: 'A fuller UI schema with table + chart adapters and the baseline flow/rules bundle.',
    learn: ['Browse adapters', 'Edit UI schema in Builder', 'Compare versions in Console'],
  },
  {
    id: 'policy-gates',
    name: 'Policy Gates: Guest Blocking',
    description: 'Shows how policy rules can set fields and then block execution with a throwError action.',
    learn: ['Add a rule', 'Trigger a rule error', 'Inspect trace errors'],
  },
];

export const sampleTemplateById: Record<SampleTemplateId, SampleTemplate> = Object.fromEntries(
  sampleTemplates.map((template) => [template.id, template]),
) as Record<SampleTemplateId, SampleTemplate>;
