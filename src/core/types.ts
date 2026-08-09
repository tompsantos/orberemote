export type RiskLevel = 'read' | 'low' | 'medium' | 'high' | 'critical';

export type ToolName =
  | 'list_hosts'
  | 'host_info'
  | 'check_connectivity'
  | 'run_command';

export interface ToolCall {
  id: string;
  tool: ToolName;
  args: Record<string, unknown>;
  requestedAt: string;
}

export interface ToolResult {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
  completedAt: string;
}

export interface DeviceHello {
  type: 'hello';
  deviceId: string;
  hostname: string;
  version: string;
  capabilities: ToolName[];
}

export interface DeviceToolCall {
  type: 'tool_call';
  call: ToolCall;
}

export interface DeviceToolResult {
  type: 'tool_result';
  result: ToolResult;
}

export interface DevicePing { type: 'ping'; at: string }
export interface DevicePong { type: 'pong'; at: string }

export type RelayMessage = DeviceHello | DeviceToolCall | DeviceToolResult | DevicePing | DevicePong;

export interface RiskAssessment {
  level: RiskLevel;
  score: number;
  reasons: string[];
  destructive: boolean;
  elevated: boolean;
}

export interface PendingApproval {
  approvalId: string;
  deviceId: string;
  host: string;
  command: string;
  timeoutMs?: number;
  assessment: RiskAssessment;
  createdAt: string;
  expiresAt: string;
  used: boolean;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  deviceId?: string;
  host?: string;
  command?: string;
  risk?: RiskAssessment;
  outcome: 'allowed' | 'approval_required' | 'approved' | 'denied' | 'failed' | 'completed';
  metadata?: Record<string, unknown>;
}
