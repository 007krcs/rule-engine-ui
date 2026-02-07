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
  return {
    user: { id: 'u-1', name: 'Rita Morgan', email: 'rita@ruleflow.dev' },
    tenantId: 'tenant-1',
    roles: ['Author', 'Approver'],
  };
}

export function hasRole(session: Session, role: Role): boolean {
  return session.roles.includes(role);
}