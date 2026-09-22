// Shared TypeScript types mirroring Rust backend models

export type NodeType =
  | 'start'
  | 'end'
  | 'http'
  | 'script'
  | 'condition'
  | 'wait'
  | 'data_source'
  | 'transform'
  | 'approval'
  | 'sub_workflow';

export interface Position {
  x: number;
  y: number;
}

export interface WorkflowPort {
  id: string;
  label: string;
  schema?: unknown;
}

export interface WorkflowNode {
  id: string;
  node_type: NodeType;
  name: string;
  description?: string;
  inputs: WorkflowPort[];
  outputs: WorkflowPort[];
  config?: unknown;
  position?: Position;
}

export interface WorkflowEdge {
  id: string;
  source_node: string;
  target_node: string;
  source_port?: string;
  target_port?: string;
  condition?: string;
}

export interface Workflow {
  id: string;
  name: string;
  version: number;
  description?: string;
  tags: string[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  global_config?: unknown;
  created_at: string;
  updated_at: string;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  version: number;
  tags: string[];
  updated_at: string;
  node_count: number;
}

export interface WorkflowInput {
  name: string;
  description?: string;
  tags?: string[];
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'timeout';

export interface NodeResult {
  node_id: string;
  status: ExecutionStatus;
  started_at?: string;
  finished_at?: string;
  output?: unknown | null;
  error?: string | null;
  attempts: number;
}

export interface Execution {
  id: string;
  workflow_id: string;
  workflow_version: number;
  status: ExecutionStatus;
  trigger?: string;
  input?: unknown;
  node_results: NodeResult[];
  error?: string | null;
  started_at: string;
  finished_at?: string | null;
  duration_ms: number;
}

export interface ExecutionSummary {
  id: string;
  workflow_id: string;
  status: ExecutionStatus;
  started_at: string;
  finished_at?: string | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
