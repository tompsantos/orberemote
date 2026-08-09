import type http from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { PolicyEngine } from '../core/policy.js';
import { AuditLog } from '../core/audit.js';
import { DeviceRegistry } from '../gateway/device-registry.js';

function text(value: unknown) {
  return { content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] };
}

export function createOrbeMcpServer(registry: DeviceRegistry, auditPath: string): McpServer {
  const policy = new PolicyEngine();
  const audit = new AuditLog(auditPath);
  const server = new McpServer(
    { name: 'orbe-remote', version: '0.1.0-alpha.1' },
    { instructions: 'Use read-only diagnostics freely. Mutating remote commands use a two-step approval flow: run_command may return approval_required; only execute approve_action after the user has explicitly approved that exact frozen command.' }
  );

  server.registerTool('list_devices', {
    title: 'List Orbe Remote devices',
    description: 'List currently connected machines/agents. Read-only.',
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
  }, async () => text(registry.list()));

  server.registerTool('list_hosts', {
    title: 'List SSH hosts',
    description: 'List SSH host aliases visible to a connected device. Read-only.',
    inputSchema: z.object({ deviceId: z.string().min(1) }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
  }, async ({ deviceId }) => {
    const result = await registry.call(deviceId, 'list_hosts', {});
    return result.ok ? text(result.result) : { ...text(result.error ?? 'device error'), isError: true };
  });

  server.registerTool('host_info', {
    title: 'Inspect SSH host',
    description: 'Return non-secret SSH configuration metadata for a host alias. Read-only.',
    inputSchema: z.object({ deviceId: z.string().min(1), host: z.string().min(1) }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
  }, async ({ deviceId, host }) => {
    const result = await registry.call(deviceId, 'host_info', { host });
    return result.ok ? text(result.result) : { ...text(result.error ?? 'device error'), isError: true };
  });

  server.registerTool('check_connectivity', {
    title: 'Check SSH connectivity',
    description: 'Verify that a host is reachable over SSH without changing it.',
    inputSchema: z.object({ deviceId: z.string().min(1), host: z.string().min(1) }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
  }, async ({ deviceId, host }) => {
    const result = await registry.call(deviceId, 'check_connectivity', { host }, 20_000);
    return result.ok ? text(result.result) : { ...text(result.error ?? 'device error'), isError: true };
  });

  server.registerTool('run_command', {
    title: 'Run remote command',
    description: 'Run a shell command over SSH. Read-only commands execute immediately. Mutating or risky commands are frozen into a pending approval and are NOT executed until approve_action is called with the returned approvalId.',
    inputSchema: z.object({
      deviceId: z.string().min(1),
      host: z.string().min(1),
      command: z.string().min(1).max(20_000),
      timeoutMs: z.number().int().min(1_000).max(300_000).optional()
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false }
  }, async ({ deviceId, host, command, timeoutMs }) => {
    const decision = policy.evaluate(deviceId, host, command, timeoutMs);
    if (decision.decision === 'approval_required') {
      await audit.write({ actor: 'mcp-client', action: 'run_command', deviceId, host, command, risk: decision.assessment, outcome: 'approval_required', metadata: { approvalId: decision.approval.approvalId } });
      return text({
        status: 'approval_required',
        approvalId: decision.approval.approvalId,
        expiresAt: decision.approval.expiresAt,
        risk: decision.assessment,
        frozenAction: { deviceId, host, command, ...(timeoutMs !== undefined ? { timeoutMs } : {}) },
        message: 'Command was NOT executed. Ask the user to approve this exact action, then call approve_action.'
      });
    }

    await audit.write({ actor: 'mcp-client', action: 'run_command', deviceId, host, command, risk: decision.assessment, outcome: 'allowed' });
    const result = await registry.call(deviceId, 'run_command', { host, command, timeoutMs, authorization: 'auto_read' });
    await audit.write({ actor: 'mcp-client', action: 'run_command', deviceId, host, command, risk: decision.assessment, outcome: result.ok ? 'completed' : 'failed' });
    return result.ok ? text({ risk: decision.assessment, result: result.result }) : { ...text(result.error ?? 'device error'), isError: true };
  });

  server.registerTool('approve_action', {
    title: 'Approve frozen remote action',
    description: 'Execute exactly one previously frozen pending action. Only call after explicit user approval. Approval IDs are single-use and expire.',
    inputSchema: z.object({ approvalId: z.string().uuid() }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false }
  }, async ({ approvalId }) => {
    const approval = policy.consume(approvalId);
    await audit.write({ actor: 'mcp-client', action: 'approve_action', deviceId: approval.deviceId, host: approval.host, command: approval.command, risk: approval.assessment, outcome: 'approved', metadata: { approvalId } });
    const result = await registry.call(approval.deviceId, 'run_command', {
      host: approval.host,
      command: approval.command,
      timeoutMs: approval.timeoutMs,
      authorization: 'approved',
      approvalId
    });
    await audit.write({ actor: 'mcp-client', action: 'approved_run_command', deviceId: approval.deviceId, host: approval.host, command: approval.command, risk: approval.assessment, outcome: result.ok ? 'completed' : 'failed', metadata: { approvalId } });
    return result.ok ? text({ status: 'executed', approvalId, result: result.result }) : { ...text(result.error ?? 'device error'), isError: true };
  });

  server.registerTool('deny_action', {
    title: 'Deny pending remote action',
    description: 'Invalidate a pending approval without executing it.',
    inputSchema: z.object({ approvalId: z.string().uuid() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
  }, async ({ approvalId }) => {
    const approval = policy.deny(approvalId);
    await audit.write({ actor: 'mcp-client', action: 'deny_action', deviceId: approval.deviceId, host: approval.host, command: approval.command, risk: approval.assessment, outcome: 'denied', metadata: { approvalId } });
    return text({ status: 'denied', approvalId });
  });

  server.registerTool('audit_tail', {
    title: 'Read recent audit log',
    description: 'Return recent Orbe Remote security/audit events. Read-only.',
    inputSchema: z.object({ limit: z.number().int().min(1).max(200).default(50) }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
  }, async ({ limit }) => text(await audit.tail(limit)));

  return server;
}

export function createMcpHttpHandler(registry: DeviceRegistry, auditPath: string) {
  return async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const mcp = createOrbeMcpServer(registry, auditPath);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => void transport.close());
    await mcp.connect(transport);
    await transport.handleRequest(req, res);
  };
}

export async function serveStdio(registry: DeviceRegistry, auditPath: string): Promise<void> {
  const server = createOrbeMcpServer(registry, auditPath);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
