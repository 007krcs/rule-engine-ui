import type { Role } from '@/lib/auth';
import type { ConfigBundle } from '@/lib/demo/types';

export type PolicyCheckStage = 'save' | 'submit-for-review' | 'approve' | 'promote';

export type PolicyMetadata = Record<string, unknown>;

export type PolicyError = {
  policyKey: string;
  code: string;
  message: string;
  stage: PolicyCheckStage;
  hint: string;
  mode?: 'shadow' | 'enforce';
};

export interface PolicyEvaluationInput {
  stage: PolicyCheckStage;
  tenantId: string;
  userId: string;
  roles: readonly Role[];
  currentBundle?: ConfigBundle;
  nextBundle?: ConfigBundle;
  metadata?: PolicyMetadata;
}
