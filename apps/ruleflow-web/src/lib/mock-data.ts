export const configVersions = [
  {
    id: 'cfg-2026.02.07-rc1',
    version: '2026.02.07-rc1',
    status: 'REVIEW',
    author: 'Rita Morgan',
    createdAt: '2026-02-07 08:42 UTC',
  },
  {
    id: 'cfg-2026.01.30',
    version: '2026.01.30',
    status: 'ACTIVE',
    author: 'Yuki Tanaka',
    createdAt: '2026-01-30 19:10 UTC',
  },
  {
    id: 'cfg-2025.12.18',
    version: '2025.12.18',
    status: 'DEPRECATED',
    author: 'Alex Chen',
    createdAt: '2025-12-18 14:05 UTC',
  },
];

export const approvalsQueue = [
  {
    id: 'apr-1072',
    config: 'cfg-2026.02.07-rc1',
    requestedBy: 'Rita Morgan',
    scope: 'Tenant: Horizon Bank',
    risk: 'Medium',
  },
  {
    id: 'apr-1071',
    config: 'cfg-2026.02.07-rc1',
    requestedBy: 'Rita Morgan',
    scope: 'Tenant: Nova Credit',
    risk: 'Low',
  },
];

export const auditEvents = [
  {
    id: 'evt-9911',
    actor: 'Yuki Tanaka',
    action: 'Promoted config to ACTIVE',
    target: 'cfg-2026.01.30',
    time: '2h ago',
  },
  {
    id: 'evt-9910',
    actor: 'System',
    action: 'Replay executed',
    target: 'flow:checkout v1.8.2',
    time: '4h ago',
  },
  {
    id: 'evt-9907',
    actor: 'Alex Chen',
    action: 'Deprecated config',
    target: 'cfg-2025.12.18',
    time: '1d ago',
  },
];

export const flows = [
  { id: 'flow-checkout', name: 'Checkout Flow', version: '1.8.2' },
  { id: 'flow-onboarding', name: 'Onboarding Flow', version: '3.4.0' },
  { id: 'flow-claims', name: 'Claims Intake', version: '2.1.5' },
];

export const roles = ['Author', 'Approver', 'Publisher', 'Viewer'] as const;