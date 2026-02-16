export type Role = 'Author' | 'Approver' | 'Publisher' | 'Viewer';

export interface Session {
  user: {
    id: string;
    name: string;
    email: string;
  };
  tenantId: string;
  roles: Role[];
}

export function getMockSession(): Session {
  const configured = (process.env.RULEFLOW_MOCK_ROLES ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is Role => value === 'Author' || value === 'Approver' || value === 'Publisher' || value === 'Viewer');

  return {
    user: { id: 'u-1', name: 'Rita Morgan', email: 'rita@ruleflow.dev' },
    tenantId: 'tenant-1',
    roles: configured.length > 0 ? configured : ['Author', 'Approver', 'Publisher'],
  };
}

export function hasRole(session: Session, role: Role): boolean {
  return session.roles.includes(role);
}
