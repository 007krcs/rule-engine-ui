export type SampleTemplateId = 'fast-start' | 'orders-dashboard' | 'policy-gates';

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

