import type { FlowSchema, Rule, UISchema } from '@platform/schema';

export type FlowNode = {
  id: string;
  position: { x: number; y: number };
  label?: string;
};

export type FlowEdge = {
  id: string;
  from: string;
  to: string;
  onEvent?: string;
  guardRuleId?: string;
};

export interface BuilderState {
  screens: Record<string, UISchema>;
  activeScreenId: string | null;
  flow: {
    startNodeId: string | null;
    nodes: FlowNode[];
    edges: FlowEdge[];
    schema?: FlowSchema;
  };
  rules: Record<string, Rule>;
  metadata: {
    version: string;
    status: 'draft' | 'published';
    updatedAt: number;
  };
}
