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
  | 'sub_workflow'
  | 'file_read'
  | 'sql_transform'
  | 'sql_execute'
  | 'notify';

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

// === M2: New types ===

export interface CustomRule {
  name: string;
  pattern: string;
  replacement: string;
  enabled: boolean;
}

export interface SqlTransformResult {
  sql: string;
  sourceDialect: string;
  targetDialect: string;
}

export interface Dialect {
  id: string;
  name: string;
}

export interface NotifyConfig {
  type: string;
  webhookUrl?: string;
  message?: string;
}

export interface Schedule {
  id: string;
  workflow_id: string;
  cron_expression: string;
  enabled: boolean;
  last_triggered_at?: string;
  next_trigger_at?: string;
}

export interface ScheduleInput {
  workflow_id: string;
  cron_expression: string;
  enabled?: boolean;
}

// === M3: Connection types ===

export interface DbConnection {
  id: string;
  name: string;
  driver: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  status?: 'connected' | 'disconnected' | 'error';
  createdAt?: string;
  updatedAt?: string;
}

export interface DbConnectionInput {
  name: string;
  driver: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message?: string;
}

// Execution logs
export interface ExecutionLogItem {
  nodeId: string;
  status: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  output?: unknown;
  error?: string;
  attempts?: number;
}

export interface ExecutionLogs {
  executionId: string;
  workflowId: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  logs: ExecutionLogItem[];
}

// Event types for execution progress
export interface ExecutionEvent {
  executionId: string;
  workflowId?: string;
  nodeId?: string;
  nodeName?: string;
  status?: string;
  output?: unknown;
  error?: string;
}
